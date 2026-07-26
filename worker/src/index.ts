interface SendEmail {
  send(message: {
    to: string;
    from: string;
    replyTo?: string;
    subject: string;
    text: string;
  }): Promise<{ messageId: string }>;
}

interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface DurableObjectTransaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

interface DurableObjectStorage {
  transaction<T>(callback: (transaction: DurableObjectTransaction) => Promise<T>): Promise<T>;
}

interface DurableObjectState {
  storage: DurableObjectStorage;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStub;
}

interface Env {
  EMAIL: SendEmail;
  CONTACT_GUARD: DurableObjectNamespace;
  CONTACT_RATE_LIMITER: RateLimit;
  CONTACT_FROM: string;
  CONTACT_HASH_SALT: string;
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
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
}

interface GuardState {
  day: string;
  total: number;
  perIp: Record<string, number>;
  rates: Record<
    string,
    {
      count: number;
      windowStartedAt: number;
    }
  >;
  recent: Record<
    string,
    {
      at: number;
      ipHash: string;
      reservationId: string;
    }
  >;
}

type GuardRequest =
  | {
      action: "rate";
      ipHash: string;
      now: number;
    }
  | {
      action: "reserve" | "release";
      day: string;
      ipHash: string;
      messageHash: string;
      now: number;
      reservationId: string;
    };

interface GuardResult {
  allowed: boolean;
  duplicate?: boolean;
  reason?: "daily_limit" | "ip_limit" | "minute_limit";
}

const MAX_BODY_BYTES = 16 * 1024;
const TURNSTILE_ACTION = "contact";
const MINUTE_IP_LIMIT = 3;
const MINUTE_WINDOW_MS = 60 * 1000;
const DAILY_TOTAL_LIMIT = 25;
const DAILY_IP_LIMIT = 5;
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

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

class PayloadTooLargeError extends Error {}

async function readJsonBody(request: Request): Promise<ContactPayload> {
  const declaredLength = Number(request.headers.get("Content-Length") || "0");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new PayloadTooLargeError();
  }

  if (!request.body) {
    return {};
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }

    chunks.push(value);
  }

  const body = new Uint8Array(received);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(body)) as ContactPayload;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
  return (
    result.success &&
    result.action === TURNSTILE_ACTION &&
    (!result.hostname || allowedHostnames.has(result.hostname))
  );
}

function guardStub(env: Env) {
  return env.CONTACT_GUARD.get(env.CONTACT_GUARD.idFromName("contact-email-guard"));
}

async function checkExactRateLimit(env: Env, ipHash: string) {
  const response = await guardStub(env).fetch(
    new Request("https://contact-guard/rate", {
      method: "POST",
      body: JSON.stringify({
        action: "rate",
        ipHash,
        now: Date.now(),
      } satisfies GuardRequest),
    }),
  );

  return (await response.json()) as GuardResult;
}

async function reserveEmail(
  env: Env,
  ipHash: string,
  messageHash: string,
  reservationId: string,
) {
  const now = Date.now();
  const response = await guardStub(env).fetch(
    new Request("https://contact-guard/reserve", {
      method: "POST",
      body: JSON.stringify({
        action: "reserve",
        day: new Date(now).toISOString().slice(0, 10),
        ipHash,
        messageHash,
        now,
        reservationId,
      } satisfies GuardRequest),
    }),
  );

  return (await response.json()) as GuardResult;
}

async function releaseEmail(
  env: Env,
  ipHash: string,
  messageHash: string,
  reservationId: string,
) {
  const now = Date.now();

  await guardStub(env).fetch(
    new Request("https://contact-guard/release", {
      method: "POST",
      body: JSON.stringify({
        action: "release",
        day: new Date(now).toISOString().slice(0, 10),
        ipHash,
        messageHash,
        now,
        reservationId,
      } satisfies GuardRequest),
    }),
  );
}

export class ContactGuard {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return Response.json({ allowed: false }, { status: 405 });
    }

    const guardRequest = (await request.json()) as GuardRequest;
    const result = await this.state.storage.transaction(async (transaction) => {
      const stored = await transaction.get<GuardState>("state");
      const requestDay =
        guardRequest.action === "rate"
          ? new Date(guardRequest.now).toISOString().slice(0, 10)
          : guardRequest.day;
      const state: GuardState =
        stored && stored.day === requestDay
          ? stored
          : {
              day: requestDay,
              total: 0,
              perIp: {},
              rates: stored?.rates || {},
              recent: stored?.recent || {},
            };

      state.rates ||= {};

      for (const [hash, entry] of Object.entries(state.rates)) {
        if (guardRequest.now - entry.windowStartedAt >= MINUTE_WINDOW_MS) {
          delete state.rates[hash];
        }
      }

      for (const [hash, entry] of Object.entries(state.recent)) {
        if (guardRequest.now - entry.at >= DUPLICATE_WINDOW_MS) {
          delete state.recent[hash];
        }
      }

      if (guardRequest.action === "rate") {
        const rate = state.rates[guardRequest.ipHash] || {
          count: 0,
          windowStartedAt: guardRequest.now,
        };

        if (rate.count >= MINUTE_IP_LIMIT) {
          return { allowed: false, reason: "minute_limit" } satisfies GuardResult;
        }

        rate.count += 1;
        state.rates[guardRequest.ipHash] = rate;
        await transaction.put("state", state);
        return { allowed: true } satisfies GuardResult;
      }

      if (guardRequest.action === "release") {
        const reservation = state.recent[guardRequest.messageHash];

        if (reservation?.reservationId === guardRequest.reservationId) {
          delete state.recent[guardRequest.messageHash];
          state.total = Math.max(0, state.total - 1);
          state.perIp[reservation.ipHash] = Math.max(
            0,
            (state.perIp[reservation.ipHash] || 0) - 1,
          );
        }

        await transaction.put("state", state);
        return { allowed: true } satisfies GuardResult;
      }

      if (state.recent[guardRequest.messageHash]) {
        return { allowed: false, duplicate: true } satisfies GuardResult;
      }

      if (state.total >= DAILY_TOTAL_LIMIT) {
        return { allowed: false, reason: "daily_limit" } satisfies GuardResult;
      }

      if ((state.perIp[guardRequest.ipHash] || 0) >= DAILY_IP_LIMIT) {
        return { allowed: false, reason: "ip_limit" } satisfies GuardResult;
      }

      state.total += 1;
      state.perIp[guardRequest.ipHash] = (state.perIp[guardRequest.ipHash] || 0) + 1;
      state.recent[guardRequest.messageHash] = {
        at: guardRequest.now,
        ipHash: guardRequest.ipHash,
        reservationId: guardRequest.reservationId,
      };

      await transaction.put("state", state);
      return { allowed: true } satisfies GuardResult;
    });

    return Response.json(result);
  }
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

    const remoteIp = request.headers.get("CF-Connecting-IP") || "unknown";
    const rateLimit = await env.CONTACT_RATE_LIMITER.limit({ key: remoteIp });

    if (!rateLimit.success) {
      const response = json(
        { ok: false, message: "Too many requests. Please try again later." },
        429,
        origin,
      );
      response.headers.set("Retry-After", "60");
      return response;
    }

    const ipHash = await sha256(`${env.CONTACT_HASH_SALT}:ip:${remoteIp}`);
    const exactRateLimit = await checkExactRateLimit(env, ipHash);

    if (!exactRateLimit.allowed) {
      const response = json(
        { ok: false, message: "Too many requests. Please try again later." },
        429,
        origin,
      );
      response.headers.set("Retry-After", "60");
      return response;
    }

    let payload: ContactPayload;

    try {
      payload = await readJsonBody(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return json({ ok: false, message: "Request too large." }, 413, origin);
      }
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
      turnstileToken.length > 2048 ||
      !turnstileToken
    ) {
      return json({ ok: false, message: "Please check the form fields." }, 400, origin);
    }

    const turnstilePassed = await verifyTurnstile(
      turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      remoteIp,
    );

    if (!turnstilePassed) {
      return json({ ok: false, message: "Verification failed." }, 400, origin);
    }

    const safeName = name.replace(/[\r\n]+/g, " ");
    const messageHash = await sha256(
      `${env.CONTACT_HASH_SALT}:message:${email}\n${message}`,
    );
    const reservationId = crypto.randomUUID();
    const reservation = await reserveEmail(env, ipHash, messageHash, reservationId);

    if (reservation.duplicate) {
      return json({ ok: true }, 200, origin);
    }

    if (!reservation.allowed) {
      const response = json(
        { ok: false, message: "Message limit reached. Please try again later." },
        429,
        origin,
      );
      response.headers.set("Retry-After", "86400");
      return response;
    }

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
      try {
        await releaseEmail(env, ipHash, messageHash, reservationId);
      } catch (releaseError) {
        console.error("Contact reservation release failed", releaseError);
      }
      return json(
        { ok: false, message: "Unable to send your message right now." },
        502,
        origin,
      );
    }

    return json({ ok: true }, 200, origin);
  },
};
