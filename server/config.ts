import { fileURLToPath } from "node:url";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUrl: process.env.MONGO_URL ?? "mongodb://localhost:27017",
  mongoDb: process.env.MONGO_DB ?? "silvas-tab",
  /** Login of the admin account, the only one that manages projects and accounts. */
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  /** Password of the admin account. */
  password: required("SILVA_PASSWORD"),
  /** Bearer token used by MCP clients. Kept separate so it can be rotated without touching the UI password. */
  mcpToken: required("MCP_TOKEN"),
  webDir: fileURLToPath(new URL("../web", import.meta.url)),
};
