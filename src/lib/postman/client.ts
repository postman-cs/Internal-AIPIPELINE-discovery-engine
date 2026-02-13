/**
 * Postman API Integration Layer (Feature #1)
 *
 * Wraps the Postman API v10 for programmatic management of
 * workspaces, collections, environments, and monitors.
 *
 * Technology-agnostic: works with any Postman instance (cloud or on-prem).
 */

import { logger } from "@/lib/logger";

const log = logger.child("postman.client");

const POSTMAN_API_BASE = "https://api.getpostman.com";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostmanWorkspace {
  id: string;
  name: string;
  type: "personal" | "team" | "private" | "public" | "partner";
  description?: string;
}

export interface PostmanCollection {
  id: string;
  uid: string;
  name: string;
  owner: string;
  fork?: { label: string; createdAt: string };
}

export interface PostmanEnvironment {
  id: string;
  uid: string;
  name: string;
  owner: string;
  isPublic: boolean;
}

export interface PostmanMonitorConfig {
  id: string;
  uid: string;
  name: string;
  status: string;
  frequency: number;
  lastRun?: {
    status: string;
    startedAt: string;
    finishedAt: string;
  };
}

export interface PostmanVariable {
  key: string;
  value: string;
  type?: "default" | "secret";
  enabled?: boolean;
}

export interface PostmanApiError {
  status: number;
  message: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class PostmanClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = POSTMAN_API_BASE) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  // -------------------------------------------------------------------------
  // HTTP helpers
  // -------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };

    const opts: RequestInit = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    log.info(`Postman API: ${method} ${path}`);

    const resp = await fetch(url, opts);

    if (!resp.ok) {
      const text = await resp.text().catch(() => "Unknown error");
      const error: PostmanApiError = {
        status: resp.status,
        message: text,
        name: `PostmanApiError_${resp.status}`,
      };
      log.error("Postman API error", { status: resp.status, path, body: text });
      throw error;
    }

    return resp.json() as Promise<T>;
  }

  // -------------------------------------------------------------------------
  // Workspaces
  // -------------------------------------------------------------------------

  async listWorkspaces(): Promise<PostmanWorkspace[]> {
    const data = await this.request<{
      workspaces: PostmanWorkspace[];
    }>("GET", "/workspaces");
    return data.workspaces ?? [];
  }

  async getWorkspace(workspaceId: string): Promise<PostmanWorkspace & { collections: PostmanCollection[] }> {
    const data = await this.request<{
      workspace: PostmanWorkspace & { collections: PostmanCollection[] };
    }>("GET", `/workspaces/${workspaceId}`);
    return data.workspace;
  }

  // -------------------------------------------------------------------------
  // Collections
  // -------------------------------------------------------------------------

  async createCollection(
    workspaceId: string,
    collection: Record<string, unknown>
  ): Promise<{ id: string; uid: string; name: string }> {
    const data = await this.request<{
      collection: { id: string; uid: string; name: string };
    }>("POST", `/collections?workspace=${workspaceId}`, { collection });
    return data.collection;
  }

  async updateCollection(
    collectionUid: string,
    collection: Record<string, unknown>
  ): Promise<{ id: string; uid: string; name: string }> {
    const data = await this.request<{
      collection: { id: string; uid: string; name: string };
    }>("PUT", `/collections/${collectionUid}`, { collection });
    return data.collection;
  }

  async getCollection(collectionUid: string): Promise<Record<string, unknown>> {
    const data = await this.request<{
      collection: Record<string, unknown>;
    }>("GET", `/collections/${collectionUid}`);
    return data.collection;
  }

  async listCollections(workspaceId?: string): Promise<PostmanCollection[]> {
    const qs = workspaceId ? `?workspace=${workspaceId}` : "";
    const data = await this.request<{
      collections: PostmanCollection[];
    }>("GET", `/collections${qs}`);
    return data.collections ?? [];
  }

  // -------------------------------------------------------------------------
  // Environments
  // -------------------------------------------------------------------------

  async createEnvironment(
    workspaceId: string,
    environment: { name: string; values: PostmanVariable[] }
  ): Promise<{ id: string; uid: string; name: string }> {
    const data = await this.request<{
      environment: { id: string; uid: string; name: string };
    }>("POST", `/environments?workspace=${workspaceId}`, { environment });
    return data.environment;
  }

  async updateEnvironment(
    environmentUid: string,
    environment: { name: string; values: PostmanVariable[] }
  ): Promise<{ id: string; uid: string; name: string }> {
    const data = await this.request<{
      environment: { id: string; uid: string; name: string };
    }>("PUT", `/environments/${environmentUid}`, { environment });
    return data.environment;
  }

  async getEnvironment(environmentUid: string): Promise<{
    id: string;
    uid: string;
    name: string;
    values: PostmanVariable[];
  }> {
    const data = await this.request<{
      environment: { id: string; uid: string; name: string; values: PostmanVariable[] };
    }>("GET", `/environments/${environmentUid}`);
    return data.environment;
  }

  async listEnvironments(workspaceId?: string): Promise<PostmanEnvironment[]> {
    const qs = workspaceId ? `?workspace=${workspaceId}` : "";
    const data = await this.request<{
      environments: PostmanEnvironment[];
    }>("GET", `/environments${qs}`);
    return data.environments ?? [];
  }

  // -------------------------------------------------------------------------
  // Monitors
  // -------------------------------------------------------------------------

  async createMonitor(monitor: {
    name: string;
    collection: string; // collection UID
    environment?: string; // environment UID
    schedule?: { cron: string; timezone: string };
  }): Promise<{ id: string; uid: string; name: string }> {
    const data = await this.request<{
      monitor: { id: string; uid: string; name: string };
    }>("POST", "/monitors", { monitor });
    return data.monitor;
  }

  async getMonitor(monitorUid: string): Promise<PostmanMonitorConfig> {
    const data = await this.request<{
      monitor: PostmanMonitorConfig;
    }>("GET", `/monitors/${monitorUid}`);
    return data.monitor;
  }

  async listMonitors(workspaceId?: string): Promise<PostmanMonitorConfig[]> {
    const qs = workspaceId ? `?workspace=${workspaceId}` : "";
    const data = await this.request<{
      monitors: PostmanMonitorConfig[];
    }>("GET", `/monitors${qs}`);
    return data.monitors ?? [];
  }

  async runMonitor(monitorUid: string): Promise<{
    run: { id: string; status: string; info: { status: string } };
  }> {
    return this.request("POST", `/monitors/${monitorUid}/run`);
  }

  // -------------------------------------------------------------------------
  // Utility: health check
  // -------------------------------------------------------------------------

  async ping(): Promise<boolean> {
    try {
      await this.request("GET", "/me");
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory: create client from project's API key
// ---------------------------------------------------------------------------

export function createPostmanClient(apiKey: string): PostmanClient {
  return new PostmanClient(apiKey);
}

/**
 * Convert a collection stub (from AI-generated output) to Postman Collection v2.1 format.
 */
export function stubToPostmanCollection(
  stub: {
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
): Record<string, unknown> {
  return {
    info: {
      name: stub.name,
      description: stub.description,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: stub.folders.map((folder) => ({
      name: folder.name,
      item: folder.requests.map((req) => ({
        name: req.name,
        request: {
          method: req.method,
          header: [],
          url: {
            raw: req.urlPattern,
            host: ["{{baseUrl}}"],
            path: req.urlPattern.replace(/^\{\{baseUrl\}\}\/?/, "").split("/").filter(Boolean),
          },
          description: req.description,
        },
      })),
    })),
  };
}

/**
 * Convert environment variable sets to Postman environment v2.1 format.
 */
export function varsToPostmanEnvironment(
  name: string,
  variables: PostmanVariable[]
): Record<string, unknown> {
  return {
    name,
    values: variables.map((v) => ({
      key: v.key,
      value: v.value,
      type: v.type ?? "default",
      enabled: v.enabled ?? true,
    })),
    _postman_variable_scope: "environment",
  };
}
