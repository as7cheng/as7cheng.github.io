interface SendEmail {
  send(message: {
    to: string;
    from: string;
    replyTo?: string;
    subject: string;
    text: string;
  }): Promise<{ messageId: string }>;
}

interface Env {
  EMAIL: SendEmail;
  CONTACT_FROM: string;
  CONTACT_TO: string;
  TURNSTILE_SECRET_KEY: string;
}

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  website?: unknown;
  turnstileToken?: unknown;
}

interface TurnstileResult {
  success: boolean;
  hostname?: string;
  "error-codes"?: string[];
}

const allowedOrigins = new Set([
  "https://anthonysc.com",
  "https://www.anthonysc.com",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

const allowedHostnames = new Set([
  "anthonysc.com",
  "www.anthonysc.com",
  "127.0.0.1",
  "localhost",
]);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: Record<string, unknown>, status = 200, origin?: string) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });

  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Vary", "Origin");
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function verifyTurnstile(token: string, secret: string, remoteIp: string | null) {
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret,
      response: token,
      remoteip: remoteIp || undefined,
    }),
  });

  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as TurnstileResult;
  return result.success && (!result.hostname || allowedHostnames.has(result.hostname));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return allowedOrigins.has(origin)
        ? json({ ok: true }, 204, origin)
        : json({ ok: false }, 403);
    }

    if (request.method !== "POST") {
      return json({ ok: false, message: "Method not allowed." }, 405, origin);
    }

    if (!allowedOrigins.has(origin)) {
      return json({ ok: false, message: "Origin not allowed." }, 403);
    }

    if (!request.headers.get("Content-Type")?.includes("application/json")) {
      return json({ ok: false, message: "Expected JSON." }, 415, origin);
    }

    let payload: ContactPayload;

    try {
      payload = (await request.json()) as ContactPayload;
    } catch {
      return json({ ok: false, message: "Invalid request." }, 400, origin);
    }

    const name = normalizeString(payload.name);
    const email = normalizeString(payload.email).toLowerCase();
    const message = normalizeString(payload.message);
    const website = normalizeString(payload.website);
    const turnstileToken = normalizeString(payload.turnstileToken);

    if (website) {
      return json({ ok: true }, 200, origin);
    }

    if (
      name.length < 2 ||
      name.length > 80 ||
      email.length > 254 ||
      !emailPattern.test(email) ||
      message.length < 10 ||
      message.length > 4000 ||
      !turnstileToken
    ) {
      return json({ ok: false, message: "Please check the form fields." }, 400, origin);
    }

    const turnstilePassed = await verifyTurnstile(
      turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      request.headers.get("CF-Connecting-IP"),
    );

    if (!turnstilePassed) {
      return json({ ok: false, message: "Verification failed." }, 400, origin);
    }

    const safeName = name.replace(/[\r\n]+/g, " ");

    try {
      await env.EMAIL.send({
        to: env.CONTACT_TO,
        from: env.CONTACT_FROM,
        replyTo: email,
        subject: `Studio inquiry from ${safeName}`,
        text: [
          "New message from anthonysc.com/studio",
          "",
          `Name: ${name}`,
          `Reply to: ${email}`,
          "",
          message,
        ].join("\n"),
      });
    } catch (error) {
      console.error("Contact email failed", error);
      return json(
        { ok: false, message: "Unable to send your message right now." },
        502,
        origin,
      );
    }

    return json({ ok: true }, 200, origin);
  },
};
