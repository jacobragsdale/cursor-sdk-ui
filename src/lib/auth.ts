import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE_NAME = "portfolio_auth";

const TOKEN_VERSION = "v1";
const TOKEN_PAYLOAD = "portfolio-agent-auth";

function configuredPassword() {
  const password = process.env.PORTFOLIO_PASSWORD;
  return password && password.length > 0 ? password : undefined;
}

function signingSecret() {
  return process.env.AUTH_COOKIE_SECRET ?? process.env.CURSOR_API_KEY ?? configuredPassword();
}

export function verifyPassword(input: string): boolean {
  const password = configuredPassword();
  return password ? safeEqual(input, password) : false;
}

export function createAuthToken(): string {
  const secret = signingSecret();
  if (!secret) {
    throw new Error("PORTFOLIO_PASSWORD or AUTH_COOKIE_SECRET must be set.");
  }

  return `${TOKEN_VERSION}.${sign(TOKEN_PAYLOAD, secret)}`;
}

export function isValidAuthToken(token: string | undefined): boolean {
  if (!token) return false;

  const [version, signature, extra] = token.split(".");
  if (version !== TOKEN_VERSION || !signature || extra) return false;

  const secret = signingSecret();
  return secret ? safeEqual(signature, sign(TOKEN_PAYLOAD, secret)) : false;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
