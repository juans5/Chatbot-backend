import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
// import StreamChat from "stream-chat";
import { StreamChat } from "stream-chat";
import OpenAI from "openai";

import { db } from "./config/supabase.js";
import { eq } from "drizzle-orm";
import { chats, users } from "./db/schema.js";
import { ChatCompletionMessageParam } from "openai/resources";

dotenv.config();
const app = express();

app.use(cors({}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initilize Stream Client

// const chatClient = StreamChat.getInstance(
//   process.env.STREAM_API_KEY!,
//   process.env.STREAM_API_SECRET!
// );

const chatClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
);

// Initilize OpenAi

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

//  Register user with Stream Chat (solo se usara email y name)
app.post(
  "/register-user",
  async (req: Request, res: Response): Promise<any> => {
    const { name, email } = req.body || {};

    if (!name || !email) {
      return res
        .status(400)
        .json({ error: "There are neither name or email sent" });
    }

    try {
      // Create userId manually with the email
      const userId = email.replace(/[^a-zA-Z0-9_-]/g, "_");

      // Check if user id exist
      const userResponse = await chatClient.queryUsers({
        id: { $eq: userId },
      });

      if (!userResponse.users.length) {
        // Si no hay usuarios en el array
        // Agregaremos un usuario ya que no hay.
        await chatClient.upsertUser({
          id: userId,
          name: name,
          email: email,
          role: "user",
        });
      }

      // Verify if Users exist in Database
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.userId, userId));

      if (!existingUser.length) {
        console.log(
          `The user ${userId} is not in the database. Adding theme...`
        );
        // create user in database if not exist
        await db.insert(users).values({ userId, name, email });
      }

      res.status(200).json({ userId, name, email });
    } catch (error) {
      res.status(500).json({ err: "Internal Server Error" });
    }
  }
);

// Send message to AI
app.post("/chat", async (req: Request, res: Response): Promise<any> => {
  const { message, userId } = req.body;
  if (!message || !userId) {
    return res.status(400).json({ message: "message or userId are required" });
  }

  try {
    // Verify user exists
    const userResponse = await chatClient.queryUsers({ id: { $eq: userId } });
    if (!userResponse.users.length) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify users is in DATABASE
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId));

    if (!existingUser.length) {
      return res.status(404).json({ error: "user not found in the database" });
    }

    //  Message to OpenAI
    const response = await openai.chat.completions.create({
      messages: [{ role: "user", content: message }],
      model: "openai/gpt-oss-120b",
    });

    //operador de coalescencia Nula ??
    const aiMessage: string =
      response.choices[0]?.message?.content ?? "No responde from AI";

    // Save Chats to database if not exist
    await db.insert(chats).values({ userId, message, reply: aiMessage });

    // Create or GET channel for conversation with the AI
    const channel = chatClient.channel("messaging", `chat-${userId}`, {
      name: "AI Chat",
      created_by_id: "ai_bot",
    });
    await channel.create();
    await channel.sendMessage({ text: aiMessage, user_id: "ai_bot" });

    res.status(200).json({ reply: aiMessage });
  } catch (err) {
    console.error("Error generating AI message", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get Chat History

app.post("/get-messages", async (req: Request, res: Response): Promise<any> => {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ message: " The userId is required" });
  }

  try {
    const chatHistory = await db
      .select()
      .from(chats)
      .where(eq(chats.userId, userId));

    res.status(200).json({ message: chatHistory });
  } catch (error) {
    console.log("Error Fetching user history", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server Running on Port ${PORT}`));
