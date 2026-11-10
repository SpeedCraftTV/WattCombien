import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../worker/src/index.js";

const origin = "https://wattcombien.pages.dev";
const env = {
  CONTACT_ENABLED: "true",
  TURNSTILE_SECRET_KEY: "test-secret",
  TURNSTILE_EXPECTED_HOSTNAMES: "wattcombien.pages.dev",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
  ALLOWED_ORIGINS: origin,
  CONTACT_LIMITER: { limit: async () => ({ success: true }) }
};

function request(payload, options = {}) {
  return new Request("https://contact.example.workers.dev/api/contact", {
    method: options.method ?? "POST",
    headers: {
      Origin: options.origin ?? origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.10"
    },
    body: options.method === "OPTIONS" ? undefined : JSON.stringify(payload)
  });
}

const payload = {
  reason: "question",
  email: "person@example.com",
  message: "Bonjour, j’ai une question sur le calculateur.",
  turnstileToken: "turnstile-test-token"
};

function successfulFetch(calls) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("siteverify")) {
      return Response.json({ success: true, hostname: "wattcombien.pages.dev", action: "contact" });
    }
    return new Response(null, { status: 201 });
  };
}

test("the contact worker verifies Turnstile before inserting only the submitted fields", async () => {
  const calls = [];
  const response = await handleRequest(request(payload), env, successfulFetch(calls));

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /turnstile\/v0\/siteverify$/);
  assert.equal(JSON.parse(calls[0].init.body).secret, env.TURNSTILE_SECRET_KEY);
  assert.equal("remoteip" in JSON.parse(calls[0].init.body), false);
  assert.match(calls[1].url, /\/rest\/v1\/contact_messages$/);
  assert.equal(calls[1].init.headers.Authorization, `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    reason: payload.reason,
    email: payload.email,
    message: payload.message,
    status: "new"
  });
});

test("the worker accepts the full message limit with multibyte French text", async () => {
  const calls = [];
  const longPayload = { ...payload, message: "é".repeat(5000) };
  const response = await handleRequest(request(longPayload), env, successfulFetch(calls));
  assert.equal(response.status, 201);
  assert.equal(JSON.parse(calls[1].init.body).message.length, 5000);
});

test("the worker rejects disallowed origins and refuses submissions when disabled", async () => {
  const forbidden = await handleRequest(request(payload, { origin: "https://attacker.example" }), env);
  assert.equal(forbidden.status, 403);

  const disabled = await handleRequest(request(payload), { ...env, CONTACT_ENABLED: "false" });
  assert.equal(disabled.status, 503);
});

test("invalid payloads, rate-limited requests, and failed challenges never reach Supabase", async () => {
  const invalid = await handleRequest(request({ ...payload, reason: "unknown" }), env);
  assert.equal(invalid.status, 400);
  const invalidEmail = await handleRequest(request({ ...payload, email: "not-an-email" }), env);
  assert.equal(invalidEmail.status, 400);

  const limited = await handleRequest(request(payload), {
    ...env,
    CONTACT_LIMITER: { limit: async () => ({ success: false }) }
  });
  assert.equal(limited.status, 429);

  let inserted = false;
  const badChallenge = await handleRequest(request(payload), env, async (url) => {
    if (String(url).includes("siteverify")) {
      return Response.json({ success: false, hostname: "wattcombien.pages.dev", action: "contact" });
    }
    inserted = true;
    return new Response(null, { status: 201 });
  });
  assert.equal(badChallenge.status, 400);
  assert.equal(inserted, false);
});

test("upstream failures return a generic unavailable error without exposing database details", async () => {
  const response = await handleRequest(request(payload), env, async (url) => {
    if (String(url).includes("siteverify")) {
      return Response.json({ success: true, hostname: "wattcombien.pages.dev", action: "contact" });
    }
    return new Response("sensitive database diagnostics", { status: 500 });
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "service_unavailable" });
});

test("Turnstile verification is bound to the configured site and action", async () => {
  const response = await handleRequest(request(payload), env, async () =>
    Response.json({ success: true, hostname: "other.example", action: "contact" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "captcha_failed" });
});

test("the worker returns an allowed CORS preflight without contacting integrations", async () => {
  let called = false;
  const response = await handleRequest(request(null, { method: "OPTIONS" }), env, async () => {
    called = true;
    return Response.json({});
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assert.equal(called, false);
});
