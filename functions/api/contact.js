const GATEWAY_TOKEN_HEADER = "X-Contact-Gateway-Token";
const CLIENT_IP_HEADER = "X-Contact-Client-IP";

function serviceUnavailable() {
  return Response.json(
    { error: "service_unavailable" },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}

function validClientIp(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 64
    && value.trim() === value
    && !/[\s,]/.test(value);
}

export async function onRequest(context) {
  const { request, env } = context;
  const contactApi = env.CONTACT_API;
  const gatewayToken = env.CONTACT_GATEWAY_TOKEN;
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (typeof contactApi?.fetch !== "function"
    || typeof gatewayToken !== "string" || gatewayToken.length < 32
    || !validClientIp(clientIp)) {
    console.error("[contact-gateway] required service binding, secret, or trusted client IP is unavailable");
    return serviceUnavailable();
  }

  const headers = new Headers();
  for (const name of ["Content-Type", "Origin"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set(GATEWAY_TOKEN_HEADER, gatewayToken);
  headers.set(CLIENT_IP_HEADER, clientIp);

  try {
    const hasBody = !["GET", "HEAD"].includes(request.method);
    const forwardedRequest = new Request(request.url, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      ...(hasBody ? { duplex: "half" } : {}),
      redirect: "manual"
    });
    return await contactApi.fetch(forwardedRequest);
  } catch {
    console.error("[contact-gateway] private contact Worker request failed");
    return serviceUnavailable();
  }
}
