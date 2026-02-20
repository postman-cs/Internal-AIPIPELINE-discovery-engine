import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || state !== session.userId) {
    return NextResponse.redirect(
      new URL("/ingest?error=google_auth_failed", req.url),
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL("/ingest?error=google_not_configured", req.url),
    );
  }

  try {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL("/ingest?error=no_refresh_token", req.url),
      );
    }

    oauth2.setCredentials(tokens);
    const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
    const userInfo = await oauth2Api.userinfo.get();
    const googleEmail = userInfo.data.email ?? null;

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        googleRefreshToken: tokens.refresh_token,
        googleEmail,
      },
    });

    return NextResponse.redirect(
      new URL("/ingest?google=connected", req.url),
    );
  } catch (err) {
    console.error("[google-oauth] Token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/ingest?error=google_token_exchange", req.url),
    );
  }
}
