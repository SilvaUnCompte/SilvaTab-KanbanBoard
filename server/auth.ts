import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { FastifyReply, FastifyRequest } from "fastify";

const SESSION_COOKIE = "silva_session";
const SESSION_MAX_AGE_S = 30 * 24 * 3600;

const sha256 = (value: string) => createHash("sha256").update(value).digest();
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keyLength: number) => Promise<Buffer>;

/** Constant-time comparison that also hides the length of the secret. */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

/** Derived from the password so that changing the password invalidates every session. */
export function cookieSecret(password: string): string {
  return sha256(`silvas-tab-session:${password}`).toString("hex");
}

/** Salted scrypt hash, stored as `salt:hash` (hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":").map((hex) => Buffer.from(hex, "hex"));
  return timingSafeEqual(await scryptAsync(password, salt, hash.length), hash);
}

/** 12 URL-safe characters (72 random bits), easy to copy and paste. */
export const generatePassword = () => randomBytes(9).toString("base64url");

export interface SessionInfo {
  userId: string;
  /** Epoch ms, compared with the account's last password change. */
  issuedAt: number;
}

export function openSession(reply: FastifyReply, userId: string): void {
  reply.setCookie(SESSION_COOKIE, `${userId}:${Date.now()}`, {
    signed: true,
    httpOnly: true,
    sameSite: "strict",
    secure: "auto",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export function closeSession(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function readSession(req: FastifyRequest): SessionInfo | null {
  const raw = req.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const { valid, value } = req.unsignCookie(raw);
  const [userId, issued] = (value ?? "").split(":");
  const issuedAt = Number(issued);
  return valid && userId && Date.now() - issuedAt < SESSION_MAX_AGE_S * 1000 ? { userId, issuedAt } : null;
}

/** Token from `Authorization: Bearer <token>`, or `?token=` for clients that cannot send headers. */
export function requestToken(req: FastifyRequest): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return (req.query as { token?: string } | undefined)?.token;
}
