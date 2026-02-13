"use server";

/**
 * Postman Sync Server Actions (Features #2, #3)
 *
 * - publishCollectionToWorkspace: Push AI-generated collection to Postman workspace
 * - syncEnvironmentToWorkspace: Create/update Postman environment with variable sets
 * - listWorkspaceCollections: List existing collections in workspace
 * - listWorkspaceEnvironments: List existing environments in workspace
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import {
  PostmanClient,
  stubToPostmanCollection,
  type PostmanVariable,
} from "@/lib/postman/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getProjectPostmanClient(projectId: string): Promise<{
  client: PostmanClient;
  workspaceId: string;
} | null> {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true, postmanApiKey: true, postmanWorkspaceId: true },
  });

  if (!project?.postmanApiKey || !project?.postmanWorkspaceId) {
    return null;
  }

  return {
    client: new PostmanClient(project.postmanApiKey),
    workspaceId: project.postmanWorkspaceId,
  };
}

// ---------------------------------------------------------------------------
// Feature #2: One-Click Collection Publish
// ---------------------------------------------------------------------------

export async function publishCollectionToWorkspace(
  projectId: string,
  collectionStub: {
    name: string;
    description: string;
    folders: Array<{
      name: string;
      requests: Array<{
        method: string;
        name: string;
        urlPattern: string;
        description: string;
      }>;
    }>;
  }
): Promise<{
  success: boolean;
  collectionUid?: string;
  deepLink?: string;
  error?: string;
}> {
  const ctx = await getProjectPostmanClient(projectId);
  if (!ctx) {
    return { success: false, error: "Postman API not configured for this project. Add API key and workspace ID in project settings." };
  }

  try {
    const postmanFormat = stubToPostmanCollection(collectionStub);
    const result = await ctx.client.createCollection(ctx.workspaceId, postmanFormat);

    return {
      success: true,
      collectionUid: result.uid,
      deepLink: `https://go.postman.co/workspace/${ctx.workspaceId}/collection/${result.id}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to publish collection: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Feature #3: Environment Variable Set Sync
// ---------------------------------------------------------------------------

export async function syncEnvironmentToWorkspace(
  projectId: string,
  envName: string,
  variables: PostmanVariable[]
): Promise<{
  success: boolean;
  environmentUid?: string;
  error?: string;
}> {
  const ctx = await getProjectPostmanClient(projectId);
  if (!ctx) {
    return { success: false, error: "Postman API not configured for this project." };
  }

  try {
    // Check if environment already exists
    const existing = await ctx.client.listEnvironments(ctx.workspaceId);
    const match = existing.find((e) => e.name === envName);

    if (match) {
      // Update existing
      await ctx.client.updateEnvironment(match.uid, { name: envName, values: variables });
      return { success: true, environmentUid: match.uid };
    } else {
      // Create new
      const result = await ctx.client.createEnvironment(ctx.workspaceId, {
        name: envName,
        values: variables,
      });
      return { success: true, environmentUid: result.uid };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to sync environment: ${message}` };
  }
}

export async function listWorkspaceCollections(projectId: string): Promise<{
  collections: Array<{ id: string; uid: string; name: string }>;
  error?: string;
}> {
  const ctx = await getProjectPostmanClient(projectId);
  if (!ctx) {
    return { collections: [], error: "Postman API not configured." };
  }

  try {
    const collections = await ctx.client.listCollections(ctx.workspaceId);
    return { collections: collections.map((c) => ({ id: c.id, uid: c.uid, name: c.name })) };
  } catch (err) {
    return { collections: [], error: String(err) };
  }
}

export async function listWorkspaceEnvironments(projectId: string): Promise<{
  environments: Array<{ id: string; uid: string; name: string }>;
  error?: string;
}> {
  const ctx = await getProjectPostmanClient(projectId);
  if (!ctx) {
    return { environments: [], error: "Postman API not configured." };
  }

  try {
    const environments = await ctx.client.listEnvironments(ctx.workspaceId);
    return { environments: environments.map((e) => ({ id: e.id, uid: e.uid, name: e.name })) };
  } catch (err) {
    return { environments: [], error: String(err) };
  }
}

export async function testPostmanConnection(projectId: string): Promise<{
  connected: boolean;
  workspaceName?: string;
  error?: string;
}> {
  const ctx = await getProjectPostmanClient(projectId);
  if (!ctx) {
    return { connected: false, error: "Postman API not configured." };
  }

  try {
    const workspace = await ctx.client.getWorkspace(ctx.workspaceId);
    return { connected: true, workspaceName: workspace.name };
  } catch (err) {
    return { connected: false, error: String(err) };
  }
}
