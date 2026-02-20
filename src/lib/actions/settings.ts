"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function saveJiraSettings(data: {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  jiraDefaultProject: string;
  jiraIssueType: string;
}) {
  const session = await requireAuth();

  const baseUrl = data.jiraBaseUrl?.trim().replace(/\/+$/, "") || null;
  const email = data.jiraEmail?.trim() || null;
  const token = data.jiraApiToken?.trim() || null;
  const defaultProject = data.jiraDefaultProject?.trim().toUpperCase() || null;
  const issueType = data.jiraIssueType?.trim() || "Task";

  if (baseUrl && !baseUrl.startsWith("https://")) {
    return { error: "Jira URL must start with https://" };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      jiraBaseUrl: baseUrl,
      jiraEmail: email,
      jiraApiToken: token,
      jiraDefaultProject: defaultProject,
      jiraIssueType: issueType,
    },
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function getJiraSettings() {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      jiraBaseUrl: true,
      jiraEmail: true,
      jiraApiToken: true,
      jiraDefaultProject: true,
      jiraIssueType: true,
    },
  });

  return {
    jiraBaseUrl: user?.jiraBaseUrl ?? "",
    jiraEmail: user?.jiraEmail ?? "",
    jiraApiToken: user?.jiraApiToken ?? "",
    jiraDefaultProject: user?.jiraDefaultProject ?? "",
    jiraIssueType: user?.jiraIssueType ?? "Task",
    isConfigured: !!(user?.jiraBaseUrl && user?.jiraEmail && user?.jiraApiToken),
  };
}

export async function disconnectJira() {
  const session = await requireAuth();
  await prisma.user.update({
    where: { id: session.userId },
    data: {
      jiraBaseUrl: null,
      jiraEmail: null,
      jiraApiToken: null,
      jiraDefaultProject: null,
    },
  });
  revalidatePath("/settings");
  return { success: true };
}
