import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/contact.js";

const gatewayToken = "test-gateway-token-that-is-at-least-32-characters";
const origin = "https://test-contact.wattcombien.pages.dev";

function request(options = {}) {
  return new Request(`${origin}/api/contact`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.42",
      "X-Contact-Client-IP": "spoofed-client-ip",
      "X-Contact-Gateway-Token": "spoofed-token",
      Cookie: "client-cookie=must-not-be-forwarded",
      ...(options.headers ?? {})
    },
    body: JSON.stringify({ message: "no personal data" })
  });
}

test("the Pages gateway forwards only the trusted origin, IP, and server token", async () => {
  let forwarded;
  const response = await onRequest({
    request: request(),
    env: {
      CONTACT_GATEWAY_TOKEN: gatewayToken,
      CONTACT_API: {
        fetch: async (serviceRequest) => {
          forwarded = serviceRequest;
          return Response.json({ error: "service_unavailable" }, { status: 503 });
        }
      }
    }
  });

  assert.equal(response.status, 503);
  assert.equal(await response.json().then((body) => body.error), "service_unavailable");
  assert.equal(forwarded.headers.get("Origin"), origin);
  assert.equal(forwarded.headers.get("X-Contact-Client-IP"), "203.0.113.42");
  assert.equal(forwarded.headers.get("X-Contact-Gateway-Token"), gatewayToken);
  assert.equal(forwarded.headers.get("Cookie"), null);
  assert.equal(forwarded.headers.get("X-Forwarded-For"), null);
  assert.deepEqual(await forwarded.json(), { message: "no personal data" });
});

test("the Pages gateway fails closed without a binding, gateway secret, or trusted IP", async () => {
  const noBinding = await onRequest({
    request: request(),
    env: { CONTACT_GATEWAY_TOKEN: gatewayToken }
  });
  assert.equal(noBinding.status, 503);

  const noToken = await onRequest({
    request: request(),
    env: { CONTACT_API: { fetch: async () => assert.fail("must not invoke binding") } }
  });
  assert.equal(noToken.status, 503);

  const noIp = await onRequest({
    request: request({ headers: { "CF-Connecting-IP": "" } }),
    env: { CONTACT_GATEWAY_TOKEN: gatewayToken, CONTACT_API: { fetch: async () => assert.fail("must not invoke binding") } }
  });
  assert.equal(noIp.status, 503);
});

test("the Pages gateway returns 503 when its private Worker binding fails", async () => {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args);
  try {
    const response = await onRequest({
      request: request(),
      env: {
        CONTACT_GATEWAY_TOKEN: gatewayToken,
        CONTACT_API: { fetch: async () => { throw new Error("private Worker detail"); } }
      }
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "service_unavailable" });
    assert.deepEqual(errors, [["[contact-gateway] private contact Worker request failed"]]);
  } finally {
    console.error = originalError;
  }
});
