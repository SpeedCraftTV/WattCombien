const TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_BODY_BYTES = 24 * 1024;
const MAX_MESSAGE_LENGTH = 5000;
const MIN_MESSAGE_LENGTH = 10;
const ALLOWED_REASONS = new Set(["question", "calculation_error", "privacy_request", "other"]);

function jsonResponse(body, status, origin) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function expectedHostnames(env) {
  return (env.TURNSTILE_EXPECTED_HOSTNAMES ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return null;
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

function validPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  if (!ALLOWED_REASONS.has(payload.reason)) return false;
  if (typeof payload.message !== "string") return false;
  const message = payload.message.trim();
  if (message.length < MIN_MESSAGE_LENGTH || message.length > MAX_MESSAGE_LENGTH) return false;
  if (typeof payload.turnstileToken !== "string"
    || payload.turnstileToken.length === 0 || payload.turnstileToken.length > 2048) return false;

  if (payload.email !== null && payload.email !== undefined && payload.email !== "") {
    if (typeof payload.email !== "string" || payload.email.length > 254) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) return false;
  }
  return true;
}

function configured(env) {
  return env.CONTACT_ENABLED === "true"
    && Boolean(env.TURNSTILE_SECRET_KEY)
    && expectedHostnames(env).length > 0
    && Boolean(env.SUPABASE_URL)
    && Boolean(env.SUPABASE_SERVICE_ROLE_KEY)
    && Boolean(env.CONTACT_LIMITER)
    && allowedOrigins(env).length > 0;
}

export async function handleRequest(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const origins = allowedOrigins(env);
  const corsOrigin = origin && origins.includes(origin) ? origin : null;

  if (request.method === "OPTIONS") {
    if (!corsOrigin) return jsonResponse({ error: "forbidden" }, 403);
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
      }
    });
  }

  if (!corsOrigin) return jsonResponse({ error: "forbidden" }, 403);
  if (url.pathname !== "/api/contact") return jsonResponse({ error: "not_found" }, 404, corsOrigin);
  if (request.method !== "POST") {
    const response = jsonResponse({ error: "method_not_allowed" }, 405, corsOrigin);
    response.headers.set("Allow", "POST, OPTIONS");
    return response;
  }
  if (!configured(env)) {
    return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ error: "invalid_request" }, 400, corsOrigin);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  let limit;
  try {
    limit = await env.CONTACT_LIMITER.limit({ key: ip });
  } catch {
    return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
  }
  if (!limit.success) return jsonResponse({ error: "rate_limited" }, 429, corsOrigin);

  const payload = await readJson(request);
  if (!validPayload(payload)) return jsonResponse({ error: "invalid_request" }, 400, corsOrigin);

  let captcha;
  try {
    const verification = await fetchImpl(TURNSTILE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: payload.turnstileToken
      })
    });
    if (!verification.ok) return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
    captcha = await verification.json();
  } catch {
    return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
  }

  if (!captcha.success
    || !expectedHostnames(env).includes(String(captcha.hostname ?? "").toLowerCase())
    || captcha.action !== "contact") {
    return jsonResponse({ error: "captcha_failed" }, 400, corsOrigin);
  }

  let supabaseUrl;
  try {
    supabaseUrl = new URL(env.SUPABASE_URL);
  } catch {
    return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
  }
  if (supabaseUrl.protocol !== "https:") {
    return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
  }

  try {
    const insertion = await fetchImpl(new URL("/rest/v1/contact_messages", supabaseUrl), {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        reason: payload.reason,
        email: typeof payload.email === "string" && payload.email.trim() ? payload.email.trim() : null,
        message: payload.message.trim(),
        status: "new"
      })
    });
    if (!insertion.ok) return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
  } catch {
    return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
  }

  return jsonResponse({ ok: true }, 201, corsOrigin);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
