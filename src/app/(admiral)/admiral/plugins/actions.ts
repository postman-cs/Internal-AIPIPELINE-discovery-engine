"use server";

import { pluginRegistry } from "@/lib/ai/plugins";
import { revalidatePath } from "next/cache";

export async function togglePlugin(phase: string, name: string, enabled: boolean) {
  const allPlugins = pluginRegistry.getAllPlugins();
  const plugin = allPlugins.find((p) => p.phase === phase && p.name === name);
  if (!plugin) return { error: "Plugin not found" };

  plugin.enabled = enabled;
  revalidatePath("/admiral/plugins");
  return { success: true };
}
