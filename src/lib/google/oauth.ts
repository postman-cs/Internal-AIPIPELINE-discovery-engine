/**
 * Google OAuth 2.0 helpers for Gmail integration.
 *
 * Handles token exchange, refresh, and storage.
 * Uses the standard Google OAuth 2.0 web server flow.
 */

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// Scopes needed for Gmail label/filter creation + reading emails + marking read
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",       // read, label, mark as read
  "https://www.googleapis.com/auth/gmail.settings.basic", // create filters
  "https://www.googleapis.com/auth/userinfo.email",       // get connected email
].join(" ");

function getClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID is not configured");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET is not configured");
  return secret;
}

function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${base}/api/auth/google/callback`;
}

// ---------------------------------------------------------------------------
// OAuth URL generation
// ---------------------------------------------------------------------------

/**
 * Build the Google OAuth consent screen URL.
 * The `state` parameter encodes the userId so the callback can associate tokens.
 */
export function buildGoogleAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",      // gets a refresh_token
    prompt: "consent",           // always show consent to ensure refresh_token
    state: userId,               // passed back in callback
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  return res.json();
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed: ${err}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Fetch Google user info (email)
// ---------------------------------------------------------------------------

export async function getGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  const data = await res.json();
  return data.email;
}

// ---------------------------------------------------------------------------
// Store tokens on the User model
// ---------------------------------------------------------------------------

export async function storeGoogleTokens(
  userId: string,
  tokens: GoogleTokenResponse,
  googleEmail: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleEmail,
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token ?? undefined,
      googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
}

// ---------------------------------------------------------------------------
// Get a valid access token (auto-refreshing if expired)
// ---------------------------------------------------------------------------

/**
 * Returns a valid Google access token for the given user.
 * Automatically refreshes if the current token is expired or about to expire.
 * Returns null if the user hasn't connected Google.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
    },
  });

  if (!user?.googleAccessToken || !user?.googleRefreshToken) {
    return null;
  }

  // If token is still valid (with 5-minute buffer), return it
  const bufferMs = 5 * 60 * 1000;
  if (user.googleTokenExpiry && user.googleTokenExpiry.getTime() > Date.now() + bufferMs) {
    return user.googleAccessToken;
  }

  // Refresh the token
  const refreshed = await refreshAccessToken(user.googleRefreshToken);

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: refreshed.access_token,
      googleTokenExpiry: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });

  return refreshed.access_token;
}

// ---------------------------------------------------------------------------
// Disconnect Google
// ---------------------------------------------------------------------------

export async function disconnectGoogle(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleEmail: null,
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
    },
  });
}

// ---------------------------------------------------------------------------
// Check if user has Google connected
// ---------------------------------------------------------------------------

export async function isGoogleConnected(userId: string): Promise<{ connected: boolean; email: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleEmail: true, googleRefreshToken: true },
  });
  return {
    connected: !!(user?.googleEmail && user?.googleRefreshToken),
    email: user?.googleEmail ?? null,
  };
}
