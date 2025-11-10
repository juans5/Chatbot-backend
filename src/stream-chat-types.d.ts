import "stream-chat";

declare module "stream-chat" {
  // Module augmentation para los generics usados por la librería
  interface CustomChannelData {
    name?: string;
  }

  interface CustomUserData {
    email?: string;
  }
}
