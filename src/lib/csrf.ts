import crypto from "crypto";

const CSRF_TOKEN_LENGTH = 32;

export function generateToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Validate a CSRF token from a form submission against the cookie value.
 * Server actions can optionally call this for extra protection beyond
 * SameSite cookie semantics.
 */
export function validateToken(formToken: string, cookieToken: string): boolean {
  if (!formToken || !cookieToken) return false;
  if (formToken.length !== cookieToken.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(formToken, "utf8"),
    Buffer.from(cookieToken, "utf8"),
  );
}
