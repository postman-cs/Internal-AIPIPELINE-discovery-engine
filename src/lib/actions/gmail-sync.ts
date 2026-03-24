"use server";

/**
 * Gmail Sync Actions
 *
 * Pulls emails from a project's Gmail label and ingests them
 * into the AI evidence pipeline.
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getValidAccessToken, isGoogleConnected, disconnectGoogle } from "@/lib/google/oauth";
import {
  listMessagesByLabel,
  getMessage,
  formatMessageForIngest,
  markAsRead,
  setupProjectGmailFilter,
  teardownProjectGmailFilter,
} from "@/lib/google/gmail";
import { ingestDocument } from "@/lib/ai/ingest";
import { createEvidenceSnapshot } from "@/lib/cascade/snapshot";
import { runImpactAnalysis } from "@/lib/cascade/impact";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Sync a project's Gmail inbox
// ---------------------------------------------------------------------------

export async function syncProjectGmail(projectId: string): Promise<{
  success: boolean;
  error?: string;
  synced?: number;
  skipped?: number;
}> {
  const session = await requireAuth();

  // Get project with Gmail config
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: {
      id: true,
      name: true,
      gmailLabelId: true,
      gmailFilterId: true,
      gmailLastSyncAt: true,
      primaryDomain: true,
    },
  });

  if (!project) return { success: false, error: "Project not found" };
  if (!project.gmailLabelId) return { success: false, error: "Gmail not configured for this project" };

  // Get a valid access token
  const accessToken = await getValidAccessToken(session.userId);
  if (!accessToken) return { success: false, error: "Google account not connected" };

  try {
    // List messages with this label (since last sync, or last 30 days)
    const after = project.gmailLastSyncAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const messageRefs = await listMessagesByLabel(accessToken, project.gmailLabelId, {
      after,
      maxResults: 50,
    });

    if (messageRefs.length === 0) {
      await prisma.project.update({
        where: { id: projectId },
        data: { gmailLastSyncAt: new Date() },
      });
      return { success: true, synced: 0, skipped: 0 };
    }

    let synced = 0;
    let skipped = 0;

    for (const ref of messageRefs) {
      try {
        const message = await getMessage(accessToken, ref.id);
        const formatted = formatMessageForIngest(message);

        // Skip very short emails (likely auto-replies, signatures-only, etc.)
        if (formatted.content.length < 50) {
          skipped++;
          continue;
        }

        const result = await ingestDocument({
          projectId,
          sourceType: "GMAIL",
          title: formatted.title,
          rawText: formatted.content,
          externalId: `gmail:${formatted.externalId}`,
          metadata: {
            from: formatted.from,
            date: formatted.date,
            gmailMessageId: ref.id,
            gmailThreadId: ref.threadId,
          },
        });

        if (result.skipped) {
          skipped++;
        } else {
          synced++;
          // Mark as read in Gmail so we don't re-process
          try { await markAsRead(accessToken, ref.id); } catch { /* non-fatal */ }
        }
      } catch (err) {
        console.warn(`[gmail-sync] Failed to process message ${ref.id}:`, err);
        skipped++;
      }
    }

    // Update last sync time
    await prisma.project.update({
      where: { id: projectId },
      data: { gmailLastSyncAt: new Date() },
    });

    // Create evidence snapshot + impact analysis if new docs were ingested
    if (synced > 0) {
      try {
        const snapshot = await createEvidenceSnapshot(projectId);
        await runImpactAnalysis(projectId, snapshot.snapshotId, "INGEST");
      } catch (err) {
        console.warn("[gmail-sync] Snapshot/impact analysis failed (non-fatal):", err);
      }
    }

    revalidatePath(`/projects/${projectId}`);

    return { success: true, synced, skipped };
  } catch (err) {
    console.error("[gmail-sync] Sync failed:", err);
    return { success: false, error: "Gmail sync failed. Try reconnecting your Google account." };
  }
}

// ---------------------------------------------------------------------------
// Manually set up Gmail filter for an existing project
// ---------------------------------------------------------------------------

export async function setupGmailForProject(projectId: string): Promise<{
  success: boolean;
  error?: string;
  labelName?: string;
}> {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: {
      id: true,
      name: true,
      primaryDomain: true,
      gmailLabelId: true,
    },
  });

  if (!project) return { success: false, error: "Project not found" };
  if (!project.primaryDomain) return { success: false, error: "Set a primary domain first" };
  if (project.gmailLabelId) return { success: false, error: "Gmail is already configured" };

  const accessToken = await getValidAccessToken(session.userId);
  if (!accessToken) return { success: false, error: "Connect your Google account first" };

  try {
    const gmail = await setupProjectGmailFilter(accessToken, project.name, project.primaryDomain);
    await prisma.project.update({
      where: { id: project.id },
      data: {
        gmailLabelId: gmail.labelId,
        gmailFilterId: gmail.filterId,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, labelName: gmail.labelName };
  } catch (err) {
    console.error("[gmail-setup] Failed:", err);
    return { success: false, error: "Failed to create Gmail filter" };
  }
}

// ---------------------------------------------------------------------------
// Remove Gmail integration from a project
// ---------------------------------------------------------------------------

export async function removeGmailFromProject(projectId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true, gmailLabelId: true, gmailFilterId: true },
  });

  if (!project) return { success: false, error: "Project not found" };

  const accessToken = await getValidAccessToken(session.userId);
  if (accessToken) {
    await teardownProjectGmailFilter(accessToken, project.gmailFilterId, project.gmailLabelId);
  }

  await prisma.project.update({
    where: { id: project.id },
    data: {
      gmailLabelId: null,
      gmailFilterId: null,
      gmailLastSyncAt: null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Get Gmail integration status for a project
// ---------------------------------------------------------------------------

export async function getGmailStatus(projectId: string): Promise<{
  googleConnected: boolean;
  googleEmail: string | null;
  gmailConfigured: boolean;
  lastSyncAt: Date | null;
  projectDomain: string | null;
}> {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: {
      gmailLabelId: true,
      gmailLastSyncAt: true,
      primaryDomain: true,
    },
  });

  const google = await isGoogleConnected(session.userId);

  return {
    googleConnected: google.connected,
    googleEmail: google.email,
    gmailConfigured: !!project?.gmailLabelId,
    lastSyncAt: project?.gmailLastSyncAt ?? null,
    projectDomain: project?.primaryDomain ?? null,
  };
}

// ---------------------------------------------------------------------------
// Disconnect Google account entirely
// ---------------------------------------------------------------------------

export async function disconnectGoogleAction(): Promise<{ success: boolean }> {
  const session = await requireAuth();
  await disconnectGoogle(session.userId);
  revalidatePath("/ingest");
  return { success: true };
}
