import { Phase } from "@prisma/client";

export interface AgentContext {
  projectId: string;
  projectName: string;
  phase: Phase;
  upstreamContent: Record<string, unknown>;
  evidenceChunks: Array<{ label: string; content: string }>;
}

export interface AgentOutput {
  proposedJson: Record<string, unknown>;
  markdown: string;
  aiRunIds: string[];
  assumptions: Array<{ category: string; claim: string; confidence: string }>;
  detectedBlockers: Array<{ title: string; description: string; severity: string }>;
}

export interface CascadePlugin {
  phase: Phase;
  name: string;
  description: string;
  enabled: boolean;
  run(context: AgentContext): Promise<AgentOutput>;
}

class PluginRegistry {
  private plugins: Map<string, CascadePlugin[]> = new Map();

  register(plugin: CascadePlugin) {
    const key = plugin.phase;
    const existing = this.plugins.get(key) || [];
    existing.push(plugin);
    this.plugins.set(key, existing);
    console.log(`[plugins] Registered "${plugin.name}" for phase ${plugin.phase}`);
  }

  unregister(phase: string, name: string) {
    const existing = this.plugins.get(phase) || [];
    this.plugins.set(phase, existing.filter((p) => p.name !== name));
  }

  getPlugin(phase: Phase): CascadePlugin | null {
    const plugins = this.plugins.get(phase) || [];
    return plugins.find((p) => p.enabled) || null;
  }

  getAllPlugins(): CascadePlugin[] {
    return Array.from(this.plugins.values()).flat();
  }

  listPluginsByPhase(): Record<string, CascadePlugin[]> {
    const result: Record<string, CascadePlugin[]> = {};
    for (const [phase, plugins] of this.plugins) {
      result[phase] = plugins;
    }
    return result;
  }
}

export const pluginRegistry = new PluginRegistry();
