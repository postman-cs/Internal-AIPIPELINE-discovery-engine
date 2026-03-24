/**
 * Gmail API connector.
 *
 * Creates labels, creates filters, fetches emails matching labels,
 * and marks them as read after ingestion.
 */

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function gmailFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
}

/**
 * Create a Gmail label. Uses nested label syntax: "AI-Pipeline/Project Name"
 * Returns the label ID.
 */
export async function createLabel(
  accessToken: string,
  labelName: string,
): Promise<GmailLabel> {
  // First check if it already exists
  const existing = await findLabelByName(accessToken, labelName);
  if (existing) return existing;

  const res = await gmailFetch("/labels", accessToken, {
    method: "POST",
    body: JSON.stringify({
      name: labelName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
      color: {
        textColor: "#ffffff",
        backgroundColor: "#0d7377", // teal, matching app theme
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create Gmail label: ${err}`);
  }

  return res.json();
}

/**
 * Find a label by name (case-insensitive match).
 */
export async function findLabelByName(
  accessToken: string,
  labelName: string,
): Promise<GmailLabel | null> {
  const res = await gmailFetch("/labels", accessToken);
  if (!res.ok) throw new Error("Failed to list Gmail labels");

  const data = await res.json();
  const labels: GmailLabel[] = data.labels ?? [];
  const lower = labelName.toLowerCase();
  return labels.find((l) => l.name.toLowerCase() === lower) ?? null;
}

/**
 * Delete a Gmail label by ID.
 */
export async function deleteLabel(
  accessToken: string,
  labelId: string,
): Promise<void> {
  const res = await gmailFetch(`/labels/${labelId}`, accessToken, {
    method: "DELETE",
  });
  // 404 is fine (already deleted)
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Failed to delete Gmail label: ${err}`);
  }
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface GmailFilter {
  id: string;
  criteria: Record<string, unknown>;
  action: Record<string, unknown>;
}

/**
 * Create a Gmail filter that matches emails from a domain
 * and applies a label.
 *
 * The filter matches: from:@domain.com OR to:@domain.com
 * This catches both inbound and outbound emails about the customer.
 */
export async function createDomainFilter(
  accessToken: string,
  domain: string,
  labelId: string,
): Promise<GmailFilter> {
  const res = await gmailFetch("/settings/filters", accessToken, {
    method: "POST",
    body: JSON.stringify({
      criteria: {
        // Match emails from or to anyone at this domain
        query: `from:@${domain} OR to:@${domain}`,
      },
      action: {
        addLabelIds: [labelId],
        // Don't skip inbox or mark as read — user still sees them normally
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create Gmail filter: ${err}`);
  }

  return res.json();
}

/**
 * Delete a Gmail filter by ID.
 */
export async function deleteFilter(
  accessToken: string,
  filterId: string,
): Promise<void> {
  const res = await gmailFetch(`/settings/filters/${filterId}`, accessToken, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Failed to delete Gmail filter: ${err}`);
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

interface GmailMessageListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string; size: number };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string; size: number };
      parts?: Array<{
        mimeType: string;
        body?: { data?: string; size: number };
      }>;
    }>;
  };
  internalDate: string;
}

/**
 * List messages matching a label, optionally after a given date.
 * Returns up to `maxResults` message IDs.
 */
export async function listMessagesByLabel(
  accessToken: string,
  labelId: string,
  options: { after?: Date; maxResults?: number } = {},
): Promise<Array<{ id: string; threadId: string }>> {
  const maxResults = options.maxResults ?? 50;
  let query = "";
  if (options.after) {
    // Gmail uses epoch seconds for after: filter
    const epochSec = Math.floor(options.after.getTime() / 1000);
    query = `after:${epochSec}`;
  }

  const params = new URLSearchParams({
    labelIds: labelId,
    maxResults: String(maxResults),
  });
  if (query) params.set("q", query);

  const res = await gmailFetch(`/messages?${params.toString()}`, accessToken);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list Gmail messages: ${err}`);
  }

  const data: GmailMessageListResponse = await res.json();
  return data.messages ?? [];
}

/**
 * Get the full content of a single message.
 */
export async function getMessage(
  accessToken: string,
  messageId: string,
): Promise<GmailMessage> {
  const res = await gmailFetch(`/messages/${messageId}?format=full`, accessToken);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get Gmail message ${messageId}: ${err}`);
  }
  return res.json();
}

/**
 * Extract plain text body from a Gmail message.
 * Handles both simple and multipart messages.
 */
export function extractPlainText(message: GmailMessage): string {
  // Try direct body
  if (message.payload.body?.data) {
    return base64UrlDecode(message.payload.body.data);
  }

  // Try parts (multipart message)
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return base64UrlDecode(part.body.data);
      }
      // Nested multipart (e.g., multipart/alternative inside multipart/mixed)
      if (part.parts) {
        for (const sub of part.parts) {
          if (sub.mimeType === "text/plain" && sub.body?.data) {
            return base64UrlDecode(sub.body.data);
          }
        }
      }
    }
    // Fallback to HTML if no plain text
    for (const part of message.payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return stripHtml(base64UrlDecode(part.body.data));
      }
    }
  }

  return message.snippet || "";
}

/**
 * Get a header value from a Gmail message.
 */
export function getHeader(message: GmailMessage, name: string): string {
  return message.payload.headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  )?.value ?? "";
}

/**
 * Format a Gmail message into a structured text for ingestion.
 */
export function formatMessageForIngest(message: GmailMessage): {
  title: string;
  content: string;
  from: string;
  date: string;
  externalId: string;
} {
  const subject = getHeader(message, "Subject") || "(No Subject)";
  const from = getHeader(message, "From");
  const to = getHeader(message, "To");
  const date = getHeader(message, "Date");
  const body = extractPlainText(message);

  const content = [
    `Subject: ${subject}`,
    `From: ${from}`,
    `To: ${to}`,
    `Date: ${date}`,
    "",
    body,
  ].join("\n");

  return {
    title: subject,
    content,
    from,
    date,
    externalId: message.id,
  };
}

/**
 * Mark a message as read by removing the UNREAD label.
 */
export async function markAsRead(
  accessToken: string,
  messageId: string,
): Promise<void> {
  await gmailFetch(`/messages/${messageId}/modify`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      removeLabelIds: ["UNREAD"],
    }),
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function base64UrlDecode(encoded: string): string {
  // Gmail uses URL-safe base64 (replace - with +, _ with /)
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
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
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// High-level: set up a project's Gmail integration
// ---------------------------------------------------------------------------

/**
 * Create a Gmail label and filter for a project.
 * Call this after project creation when Google is connected and primaryDomain is set.
 *
 * Returns the label ID and filter ID to store on the Project.
 */
export async function setupProjectGmailFilter(
  accessToken: string,
  projectName: string,
  primaryDomain: string,
): Promise<{ labelId: string; filterId: string; labelName: string }> {
  // Sanitize project name for label (Gmail labels can't have certain chars)
  const safeName = projectName.replace(/[/\\]/g, "-").trim();
  const labelName = `AI-Pipeline/${safeName}`;

  // Create the label
  const label = await createLabel(accessToken, labelName);

  // Create the filter for the project's domain
  const filter = await createDomainFilter(accessToken, primaryDomain, label.id);

  return {
    labelId: label.id,
    filterId: filter.id,
    labelName,
  };
}

/**
 * Clean up a project's Gmail label and filter.
 * Call this when a project is deleted or Gmail integration is removed.
 */
export async function teardownProjectGmailFilter(
  accessToken: string,
  gmailFilterId: string | null,
  gmailLabelId: string | null,
): Promise<void> {
  // Delete filter first, then label
  if (gmailFilterId) {
    try { await deleteFilter(accessToken, gmailFilterId); } catch { /* ignore */ }
  }
  if (gmailLabelId) {
    try { await deleteLabel(accessToken, gmailLabelId); } catch { /* ignore */ }
  }
}
