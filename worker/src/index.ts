/**
 * Obelix Property Management API on Cloudflare Workers.
 *
 * The Worker owns /api/*; every other path is served from the built React app
 * in ../frontend/build via Workers Static Assets (see wrangler.jsonc:
 * run_worker_first limits the Worker to /api/*, single-page-application
 * fallback handles client-side routing).
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ApiError } from "./lib/db";
import { requireUser } from "./security";
import type { AppEnv } from "./types";
import auth from "./routes/auth";
import buildings from "./routes/buildings";
import dashboard from "./routes/dashboard";
import entities from "./routes/entities";
import finance from "./routes/finance";
import overview from "./routes/overview";
import violations from "./routes/violations";

const app = new Hono<AppEnv>({ strict: false }).basePath("/api");

app.use("*", async (c, next) => {
  const allowed = (c.env.CORS_ORIGINS || "*").split(",").map((s) => s.trim());
  const handler = cors({
    origin: (origin) => (allowed.includes("*") || allowed.includes(origin) ? origin : ""),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
  });
  return handler(c, next);
});

app.get("/", (c) => c.json({ message: "Obelix Property Management API", status: "ok" }));

app.route("/auth", auth);

// Everything below requires a valid bearer token; running the guard once here
// keeps it to a single user lookup per request.
app.use("*", requireUser);
app.route("/", buildings);
app.route("/", dashboard);
app.route("/", entities);
app.route("/", finance);
app.route("/", overview);
app.route("/violations", violations);

app.notFound((c) => c.json({ detail: "Not Found" }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ detail: err.message }, err.status as 400);
  }
  console.error(err);
  return c.json({ detail: "Internal server error" }, 500);
});

export default app;
