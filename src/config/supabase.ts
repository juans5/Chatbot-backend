// import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "dotenv";
import { Pool } from "pg";
import * as schema from "../db/schema.js";

config({ path: ".env" });

const connectionString = process.env.SUPABASE_URL_PG;

// if there is not SUPABASE URL
if (!connectionString) {
  throw new Error("Supabase Url not found");
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const db = drizzle(pool, {
  schema,
});
