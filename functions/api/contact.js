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

function allowedOrigins(env, requestUrl) {
  const configuredOrigins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestOrigin = new URL(requestUrl).origin;
  const requestProtocol = new URL(requestUrl).protocol;
  const localDevelopment = new URL(requestUrl).hostname === "localhost"
    || new URL(requestUrl).hostname === "127.0.0.1";
  if (requestProtocol === "https:" || localDevelopment) configuredOrigins.push(requestOrigin);
  return [...new Set(configuredOrigins)];
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
  const messageLength = Array.from(message).length;
  if (messageLength < MIN_MESSAGE_LENGTH || messageLength > MAX_MESSAGE_LENGTH) return false;
  if (typeof payload.turnstileToken !== "string"
    || payload.turnstileToken.length === 0 || payload.turnstileToken.length > 2048) return false;

  if (payload.email !== null && payload.email !== undefined) {
    if (typeof payload.email !== "string") return false;
    const email = payload.email.trim();
    if (Array.from(email).length > 254) return false;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  }
  return true;
}

function validSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname.endsWith(".supabase.co")
      && !url.username
      && !url.password
      && !url.port
      && (url.pathname === "/" || url.pathname === "" || /^\/rest\/v1\/?$/.test(url.pathname))
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

function missingConfiguration(env) {
  const missing = [];
  if (env.CONTACT_ENABLED !== "true") missing.push("CONTACT_ENABLED");
  if (!env.TURNSTILE_SECRET) missing.push("TURNSTILE_SECRET");
  if (expectedHostnames(env).length === 0) missing.push("TURNSTILE_EXPECTED_HOSTNAMES");
  if (!validSupabaseUrl(env.SUPABASE_URL)) missing.push("SUPABASE_URL");
  if (!env.SUPABASE_SECRET_KEY) missing.push("SUPABASE_SECRET_KEY");
  return missing;
}

async function handleContact(request, env, fetchImpl = fetch) {
  const origin = request.headers.get("Origin");
  const origins = allowedOrigins(env, request.url);
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
  if (request.method !== "POST") {
    const response = jsonResponse({ error: "method_not_allowed" }, 405, corsOrigin);
    response.headers.set("Allow", "POST, OPTIONS");
    return response;
  }
  const missing = missingConfiguration(env);
  if (missing.length > 0) {
    console.error("[contact] incomplete production configuration", missing);
    return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ error: "invalid_request" }, 400, corsOrigin);
  }

  const ip = request.headers.get("CF-Connecting-IP");
  if (env.CONTACT_LIMITER && ip) {
    try {
      const limit = await env.CONTACT_LIMITER.limit({ key: ip });
      if (!limit.success) return jsonResponse({ error: "rate_limited" }, 429, corsOrigin);
    } catch {
      console.error("[contact] rate limiter failed");
      return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
    }
  }

  const payload = await readJson(request);
  if (!validPayload(payload)) return jsonResponse({ error: "invalid_request" }, 400, corsOrigin);

  let captcha;
  try {
    const verification = await fetchImpl(TURNSTILE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: payload.turnstileToken
      })
    });
    if (!verification.ok) {
      console.error("[contact] Turnstile Siteverify returned HTTP", verification.status);
      return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
    }
    captcha = await verification.json();
  } catch {
    console.error("[contact] Turnstile Siteverify request failed");
    return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
  }

  if (!captcha.success
    || !expectedHostnames(env).includes(String(captcha.hostname ?? "").toLowerCase())
    || captcha.action !== "contact") {
    console.error("[contact] Turnstile validation rejected");
    return jsonResponse({ error: "captcha_failed" }, 400, corsOrigin);
  }

  try {
    const supabaseUrl = new URL("/rest/v1/contact_messages", env.SUPABASE_URL);
    const secretKey = env.SUPABASE_SECRET_KEY;
    const headers = {
      apikey: secretKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    };
    if (secretKey.startsWith("eyJ")) headers.Authorization = `Bearer ${secretKey}`;
    const insertion = await fetchImpl(supabaseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        reason: payload.reason,
        email: typeof payload.email === "string" && payload.email.trim() ? payload.email.trim() : null,
        message: payload.message.trim(),
        status: "new"
      })
    });
    if (!insertion.ok) {
      console.error("[contact] Supabase insertion returned HTTP", insertion.status);
      return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
    }
  } catch {
    console.error("[contact] Supabase insertion request failed");
    return jsonResponse({ error: "service_unavailable" }, 503, corsOrigin);
  }

  return jsonResponse({ ok: true }, 201, corsOrigin);
}

export async function onRequest(context) {
  try {
    return await handleContact(context.request, context.env);
  } catch {
    console.error("[contact] unexpected request failure");
    const origin = context.request.headers.get("Origin");
    const allowed = allowedOrigins(context.env, context.request.url);
    return jsonResponse({ error: "service_unavailable" }, 503, origin && allowed.includes(origin) ? origin : null);
  }
}

export const __test = { handleContact, validPayload, validSupabaseUrl, missingConfiguration };
