import { createMiddleware } from "hono/factory";
import { sign, verify } from "hono/jwt";
import type { AppEnv, User } from "./types";

const TOKEN_TTL_DAYS = 7;
const PBKDF2_ITERATIONS = 100_000; // Workers' WebCrypto cap
const DEV_SECRET = "obelix-dev-secret";

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const ub64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = (stored || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 1 || iterations > 1_000_000) return false;
  let salt: Uint8Array, expected: Uint8Array;
  try {
    salt = ub64(parts[2]);
    expected = ub64(parts[3]);
  } catch {
    return false;
  }
  const actual = await pbkdf2(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

const secretOf = (env: { JWT_SECRET?: string }) => env.JWT_SECRET || DEV_SECRET;

export async function makeToken(userId: string, env: { JWT_SECRET?: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: userId,
      iat: now,
      exp: now + TOKEN_TTL_DAYS * 24 * 60 * 60,
      jti: crypto.randomUUID(),
    },
    secretOf(env),
  );
}

/** Bearer-token guard; loads the user row and stores it on the context. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return c.json({ detail: "Not authenticated" }, 401);

  let payload: { sub?: string };
  try {
    payload = (await verify(match[1], secretOf(c.env), "HS256")) as { sub?: string };
  } catch {
    return c.json({ detail: "Invalid or expired token" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id, email, name, company, created_at FROM users WHERE id = ?",
  )
    .bind(payload.sub ?? "")
    .first<User>();
  if (!user) return c.json({ detail: "User not found" }, 401);

  c.set("user", user);
  await next();
});
