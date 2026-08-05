import { Hono } from "hono";
import type { AppEnv, Dict } from "../types";
import { hashPassword, makeToken, requireUser, verifyPassword } from "../security";
import { nowISO } from "../lib/util";

const auth = new Hono<AppEnv>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

const publicUser = (u: Dict) => ({
  id: u.id,
  name: u.name,
  company: u.company,
  email: u.email,
  created_at: u.created_at,
});

auth.post("/register", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Dict;
  const name = String(body.name ?? "").trim();
  const company = String(body.company ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!name || name.length > 120) return c.json({ detail: "Name is required (max 120 characters)" }, 422);
  if (company.length > 160) return c.json({ detail: "Company is too long (max 160 characters)" }, 422);
  if (!EMAIL_RE.test(email)) return c.json({ detail: "Enter a valid email address" }, 422);
  if (password.length < 8 || password.length > 128)
    return c.json({ detail: "Password must be 8–128 characters" }, 422);

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return c.json({ detail: "An account with this email already exists" }, 409);

  const user = {
    id: crypto.randomUUID(),
    name,
    company,
    email,
    created_at: nowISO(),
  };
  await c.env.DB.prepare(
    "INSERT INTO users (id, email, name, company, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(user.id, user.email, user.name, user.company, await hashPassword(password), user.created_at)
    .run();

  return c.json({ token: await makeToken(user.id, c.env), user: publicUser(user) });
});

auth.post("/login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Dict;
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const user = await c.env.DB.prepare(
    "SELECT id, email, name, company, password_hash, created_at FROM users WHERE email = ?",
  )
    .bind(email)
    .first<Dict>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ detail: "Invalid email or password" }, 401);
  }
  return c.json({ token: await makeToken(user.id, c.env), user: publicUser(user) });
});

auth.get("/me", requireUser, (c) => c.json(publicUser(c.get("user"))));

export default auth;
