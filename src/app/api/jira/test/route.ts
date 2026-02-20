import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { testJiraConnection } from "@/lib/jira/client";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    baseUrl?: string;
    email?: string;
    apiToken?: string;
  };

  if (!body.baseUrl || !body.email || !body.apiToken) {
    return NextResponse.json(
      { ok: false, error: "All fields are required" },
      { status: 400 },
    );
  }

  const result = await testJiraConnection({
    baseUrl: body.baseUrl.replace(/\/+$/, ""),
    email: body.email,
    apiToken: body.apiToken,
  });

  return NextResponse.json(result);
}
