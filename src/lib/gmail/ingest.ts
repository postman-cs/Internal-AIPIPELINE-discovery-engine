import { prisma } from "@/lib/prisma";
import {
  getGmailClient,
  fetchThreadsForLabel,
  fetchAttachmentText,
} from "./client";
import { ingestDocument } from "@/lib/ai/ingest";

export interface GmailIngestResult {
  threadsFound: number;
  documentsIngested: number;
  attachmentsProcessed: number;
  skipped: number;
  errors: string[];
}

/**
 * Fetch Gmail threads for a project's label and feed them into the ingest pipeline.
 * Uses the project's gmailLabelId and gmailLastSyncAt to do incremental fetches.
 */
export async function ingestGmailForProject(
  projectId: string,
  userId: string,
): Promise<GmailIngestResult> {
  const result: GmailIngestResult = {
    threadsFound: 0,
    documentsIngested: 0,
    attachmentsProcessed: 0,
    skipped: 0,
    errors: [],
  };

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      gmailLabelId: true,
      gmailLastSyncAt: true,
      primaryDomain: true,
      name: true,
    },
  });

  if (!project.gmailLabelId) {
    result.errors.push("No Gmail label configured for this project");
    return result;
  }

  const gmail = await getGmailClient(userId);
  const sinceDate = project.gmailLastSyncAt ?? undefined;

  const threads = await fetchThreadsForLabel(
    gmail,
    project.gmailLabelId,
    sinceDate,
  );

  result.threadsFound = threads.length;

  for (const thread of threads) {
    try {
      const ingestResult = await ingestDocument({
        projectId,
        sourceType: "GMAIL",
        title: thread.subject || `Gmail thread ${thread.threadId}`,
        rawText: thread.fullText,
        externalId: `gmail-thread-${thread.threadId}`,
        metadata: {
          threadId: thread.threadId,
          messageCount: thread.messages.length,
          domain: project.primaryDomain,
        },
      });

      if (ingestResult.skipped) {
        result.skipped++;
      } else {
        result.documentsIngested++;
      }

      for (const att of thread.attachments) {
        try {
          const text = await fetchAttachmentText(
            gmail,
            att.messageId,
            att.attachmentId,
            att.mimeType,
          );

          if (text && text.trim().length > 0) {
            const attResult = await ingestDocument({
              projectId,
              sourceType: "GMAIL",
              title: `[Attachment] ${att.filename} — ${thread.subject}`,
              rawText: text,
              externalId: `gmail-att-${att.messageId}-${att.attachmentId}`,
              metadata: {
                parentThreadId: thread.threadId,
                filename: att.filename,
                mimeType: att.mimeType,
              },
            });

            if (!attResult.skipped) {
              result.attachmentsProcessed++;
            }
          }
        } catch (attErr) {
          const msg =
            attErr instanceof Error ? attErr.message : String(attErr);
          result.errors.push(`Attachment ${att.filename}: ${msg}`);
        }
      }
    } catch (threadErr) {
      const msg =
        threadErr instanceof Error ? threadErr.message : String(threadErr);
      result.errors.push(`Thread ${thread.threadId}: ${msg}`);
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { gmailLastSyncAt: new Date() },
  });

  return result;
}
