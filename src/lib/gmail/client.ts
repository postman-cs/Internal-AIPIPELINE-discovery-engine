import { google, gmail_v1 } from "googleapis";
import { prisma } from "@/lib/prisma";

// Re-export for convenience
export type GmailClient = gmail_v1.Gmail;

export async function getGmailClient(userId: string): Promise<GmailClient> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { googleRefreshToken: true },
  });

  if (!user.googleRefreshToken) {
    throw new Error("Gmail not connected — no refresh token stored");
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  oauth2.setCredentials({ refresh_token: user.googleRefreshToken });

  return google.gmail({ version: "v1", auth: oauth2 });
}

// -------------------------------------------------------------------------
// Labels
// -------------------------------------------------------------------------

export async function createLabel(
  gmail: GmailClient,
  name: string,
): Promise<string> {
  const res = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });
  return res.data.id!;
}

export async function findLabelByName(
  gmail: GmailClient,
  name: string,
): Promise<string | null> {
  const res = await gmail.users.labels.list({ userId: "me" });
  const match = res.data.labels?.find((l) => l.name === name);
  return match?.id ?? null;
}

export async function getOrCreateLabel(
  gmail: GmailClient,
  name: string,
): Promise<string> {
  const existing = await findLabelByName(gmail, name);
  if (existing) return existing;
  return createLabel(gmail, name);
}

// -------------------------------------------------------------------------
// Filters
// -------------------------------------------------------------------------

export async function createDomainFilter(
  gmail: GmailClient,
  domain: string,
  labelId: string,
): Promise<string> {
  const res = await gmail.users.settings.filters.create({
    userId: "me",
    requestBody: {
      criteria: { from: `*@${domain}` },
      action: { addLabelIds: [labelId] },
    },
  });
  return res.data.id!;
}

// -------------------------------------------------------------------------
// Thread fetching
// -------------------------------------------------------------------------

export interface CollapsedThread {
  threadId: string;
  subject: string;
  messages: ThreadMessage[];
  fullText: string;
  attachments: AttachmentRef[];
}

export interface ThreadMessage {
  messageId: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
}

export interface AttachmentRef {
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export async function fetchThreadsForLabel(
  gmail: GmailClient,
  labelId: string,
  sinceDate?: Date,
): Promise<CollapsedThread[]> {
  let query = "";
  if (sinceDate) {
    const yyyy = sinceDate.getFullYear();
    const mm = String(sinceDate.getMonth() + 1).padStart(2, "0");
    const dd = String(sinceDate.getDate()).padStart(2, "0");
    query = `after:${yyyy}/${mm}/${dd}`;
  }

  const threadIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await gmail.users.threads.list({
      userId: "me",
      labelIds: [labelId],
      q: query || undefined,
      pageToken,
      maxResults: 100,
    });

    if (res.data.threads) {
      for (const t of res.data.threads) {
        if (t.id) threadIds.push(t.id);
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  const threads: CollapsedThread[] = [];
  for (const tid of threadIds) {
    const thread = await fetchAndCollapseThread(gmail, tid);
    if (thread) threads.push(thread);
  }

  return threads;
}

async function fetchAndCollapseThread(
  gmail: GmailClient,
  threadId: string,
): Promise<CollapsedThread | null> {
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  const msgs = res.data.messages;
  if (!msgs || msgs.length === 0) return null;

  const messages: ThreadMessage[] = [];
  const attachments: AttachmentRef[] = [];
  let subject = "";

  for (const msg of msgs) {
    const headers = msg.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        ?.value ?? "";

    if (!subject) subject = getHeader("Subject");

    const body = extractBody(msg.payload);

    messages.push({
      messageId: msg.id ?? "",
      from: getHeader("From"),
      to: getHeader("To"),
      date: getHeader("Date"),
      snippet: msg.snippet ?? "",
      body,
    });

    collectAttachments(msg, attachments);
  }

  const fullText = collapseMessages(subject, messages);

  return { threadId, subject, messages, fullText, attachments };
}

function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined,
): string {
  if (!payload) return "";

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64url").toString("utf-8");
    }
    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      const html = Buffer.from(htmlPart.body.data, "base64url").toString(
        "utf-8",
      );
      return stripHtml(html);
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectAttachments(
  msg: gmail_v1.Schema$Message,
  out: AttachmentRef[],
) {
  const walk = (part: gmail_v1.Schema$MessagePart) => {
    if (part.filename && part.body?.attachmentId) {
      out.push({
        messageId: msg.id ?? "",
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType ?? "application/octet-stream",
        size: part.body.size ?? 0,
      });
    }
    if (part.parts) part.parts.forEach(walk);
  };
  if (msg.payload) walk(msg.payload);
}

function collapseMessages(subject: string, messages: ThreadMessage[]): string {
  const lines = [`Subject: ${subject}`, ""];
  for (const m of messages) {
    lines.push(`--- ${m.from} | ${m.date} ---`);
    lines.push(m.body || m.snippet);
    lines.push("");
  }
  return lines.join("\n");
}

// -------------------------------------------------------------------------
// Attachment text extraction
// -------------------------------------------------------------------------

const EXTRACTABLE_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/html",
  "text/markdown",
]);

export async function fetchAttachmentText(
  gmail: GmailClient,
  messageId: string,
  attachmentId: string,
  mimeType: string,
): Promise<string | null> {
  if (!EXTRACTABLE_MIME_TYPES.has(mimeType)) return null;

  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });

  const data = res.data.data;
  if (!data) return null;

  const buf = Buffer.from(data, "base64url");

  if (mimeType === "application/pdf") {
    try {
      // pdf-parse uses `export =` so dynamic import yields the function directly
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const pdf = await pdfParse(buf);
      return pdf.text;
    } catch (err) {
      console.warn("[gmail] PDF parse failed:", err);
      return null;
    }
  }

  if (mimeType === "text/html") {
    return stripHtml(buf.toString("utf-8"));
  }

  return buf.toString("utf-8");
}
