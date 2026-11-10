import test from "node:test";
import assert from "node:assert/strict";
import { __test, onRequest } from "../functions/api/contact.js";

const origin = "https://wattcombien.pages.dev";
const env = {
  CONTACT_ENABLED: "true",
  TURNSTILE_SECRET: "test-secret",
  TURNSTILE_EXPECTED_HOSTNAMES: "wattcombien.pages.dev",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "server-only-test-key",
  ALLOWED_ORIGINS: origin
};

function request(payload, options = {}) {
  return new Request("https://wattcombien.pages.dev/api/contact", {
    method: options.method ?? "POST",
    headers: {
      Origin: options.origin ?? origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.10",
      ...(options.headers ?? {})
    },
    body: ["OPTIONS", "GET", "HEAD"].includes(options.method) ? undefined : JSON.stringify(payload)
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

test("the Pages Function verifies Turnstile before inserting only the submitted columns", async () => {
  const calls = [];
  const response = await __test.handleContact(request(payload), env, successfulFetch(calls));

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /turnstile\/v0\/siteverify$/);
  assert.equal(JSON.parse(calls[0].init.body).secret, env.TURNSTILE_SECRET);
  assert.equal("remoteip" in JSON.parse(calls[0].init.body), false);
  assert.equal(calls[1].url, "https://example.supabase.co/rest/v1/contact_messages");
  assert.equal(calls[1].init.headers.apikey, env.SUPABASE_SECRET_KEY);
  assert.equal(calls[1].init.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    reason: payload.reason,
    email: payload.email,
    message: payload.message,
    status: "new"
  });
});

test("legacy Supabase service role JWTs are sent as the authorization bearer token", async () => {
  const legacyKey = "eyJservice-role-legacy-key";
  const calls = [];
  const response = await __test.handleContact(request(payload), {
    ...env,
    SUPABASE_SECRET_KEY: legacyKey
  }, successfulFetch(calls));
  assert.equal(response.status, 201);
  assert.equal(calls[1].init.headers.apikey, legacyKey);
  assert.equal(calls[1].init.headers.Authorization, `Bearer ${legacyKey}`);
});

test("the function validates the Supabase base URL and rejects duplicated REST paths", () => {
  assert.equal(__test.validSupabaseUrl("https://example.supabase.co"), true);
  assert.equal(__test.validSupabaseUrl("https://example.supabase.co/"), true);
  assert.equal(__test.validSupabaseUrl("https://example.supabase.co/rest/v1"), true);
  assert.equal(__test.validSupabaseUrl("https://example.supabase.co/rest/v1/"), true);
  assert.equal(__test.validSupabaseUrl("http://example.supabase.co"), false);
  assert.equal(__test.validSupabaseUrl("https://example.invalid"), false);
  assert.equal(__test.validSupabaseUrl("https://example.supabase.co/rest/v1/contact_messages"), false);
});

test("the function builds one REST path when SUPABASE_URL already ends in /rest/v1", async () => {
  const calls = [];
  const response = await __test.handleContact(request(payload), {
    ...env,
    SUPABASE_URL: "https://example.supabase.co/rest/v1/"
  }, successfulFetch(calls));
  assert.equal(response.status, 201);
  assert.equal(calls[1].url, "https://example.supabase.co/rest/v1/contact_messages");
});

test("the function accepts a 5000 character UTF-8 message", async () => {
  const calls = [];
  const longPayload = { ...payload, message: "é".repeat(5000) };
  const response = await __test.handleContact(request(longPayload), env, successfulFetch(calls));
  assert.equal(response.status, 201);
  assert.equal(JSON.parse(calls[1].init.body).message.length, 5000);
});

test("the function rejects disallowed origins and refuses submissions when disabled", async () => {
  const forbidden = await __test.handleContact(request(payload, { origin: "https://attacker.example" }), env);
  assert.equal(forbidden.status, 403);

  const disabled = await __test.handleContact(request(payload), { ...env, CONTACT_ENABLED: "false" });
  assert.equal(disabled.status, 503);
});

test("invalid payloads, rate-limited requests, and failed challenges never reach Supabase", async () => {
  assert.equal((await __test.handleContact(request({ ...payload, reason: "unknown" }), env)).status, 400);
  assert.equal((await __test.handleContact(request({ ...payload, email: "bad-email" }), env)).status, 400);
  assert.equal((await __test.handleContact(request({ ...payload, message: "  " }), env)).status, 400);
  assert.equal((await __test.handleContact(request({ ...payload, turnstileToken: "" }), env)).status, 400);
  assert.equal((await __test.handleContact(request({ ...payload, turnstileToken: undefined }), env)).status, 400);

  let inserted = false;
  const badChallenge = await __test.handleContact(request(payload), env, async (url) => {
    if (String(url).includes("siteverify")) {
      return Response.json({ success: false, hostname: "wattcombien.pages.dev", action: "contact" });
    }
    inserted = true;
    return new Response(null, { status: 201 });
  });
  assert.equal(badChallenge.status, 400);
  assert.equal(inserted, false);

  const limited = await __test.handleContact(request(payload), {
    ...env,
    CONTACT_LIMITER: { limit: async () => ({ success: false }) }
  }, successfulFetch([]));
  assert.equal(limited.status, 429);
});

test("the function allows a blank optional email and keeps the message as plain text", async () => {
  const calls = [];
  const plainText = "<script>alert(1)</script> ceci reste du texte";
  const response = await __test.handleContact(request({
    ...payload,
    email: " ",
    message: plainText
  }), env, successfulFetch(calls));
  assert.equal(response.status, 201);
  assert.equal(JSON.parse(calls[1].init.body).email, null);
  assert.equal(JSON.parse(calls[1].init.body).message, plainText);
});

test("same-origin Pages requests are allowed while other origins remain rejected", async () => {
  const response = await __test.handleContact(request(payload), {
    ...env,
    ALLOWED_ORIGINS: ""
  }, successfulFetch([]));
  assert.equal(response.status, 201);
});

test("the hostname and action from Turnstile must match the configured widget", async () => {
  const response = await __test.handleContact(request(payload), env, async () =>
    Response.json({ success: true, hostname: "other.example", action: "contact" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "captcha_failed" });
});

test("Supabase failures return a generic response and do not disclose upstream details", async () => {
  const response = await __test.handleContact(request(payload), env, async (url) => {
    if (String(url).includes("siteverify")) {
      return Response.json({ success: true, hostname: "wattcombien.pages.dev", action: "contact" });
    }
    return new Response("sensitive database diagnostics", { status: 500 });
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "service_unavailable" });
});

test("the Pages Function validates HTTP methods and handles allowed preflight requests", async () => {
  const method = await __test.handleContact(request(payload, { method: "GET" }), env);
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("Allow"), "POST, OPTIONS");

  const preflight = await __test.handleContact(request(null, { method: "OPTIONS" }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
});

test("the Pages Function entry point rejects an unconfigured endpoint", async () => {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args);
  try {
    const response = await onRequest({
      request: request(payload),
      env: {
        ...env,
        CONTACT_ENABLED: "false",
        TURNSTILE_SECRET: "",
        SUPABASE_URL: "invalid",
        SUPABASE_SECRET_KEY: ""
      }
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "service_unavailable" });
    assert.deepEqual(__test.missingConfiguration({
      ...env,
      CONTACT_ENABLED: "false",
      TURNSTILE_SECRET: "",
      SUPABASE_URL: "invalid",
      SUPABASE_SECRET_KEY: ""
    }), ["CONTACT_ENABLED", "TURNSTILE_SECRET", "SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
    assert.deepEqual(errors, [[
      "[contact] incomplete production configuration",
      ["CONTACT_ENABLED", "TURNSTILE_SECRET", "SUPABASE_URL", "SUPABASE_SECRET_KEY"]
    ]]);
  } finally {
    console.error = originalError;
  }
});
