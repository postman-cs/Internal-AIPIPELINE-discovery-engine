import { pluginRegistry } from "@/lib/ai/plugins";
import "@/lib/ai/plugins/sample-postman-flows";
import { PluginToggleButton } from "./PluginToggleButton";

export default function PluginsPage() {
  const allPlugins = pluginRegistry.getAllPlugins();
  const byPhase = pluginRegistry.listPluginsByPhase();

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Plugin Registry</h1>
        <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
          Custom agent plugins that extend or replace built-in cascade phases
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="card-glow py-4 px-5 text-center">
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--accent-cyan)" }}>{allPlugins.length}</p>
          <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--foreground-dim)" }}>Registered</p>
        </div>
        <div className="card-glow py-4 px-5 text-center">
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--accent-green)" }}>
            {allPlugins.filter((p) => p.enabled).length}
          </p>
          <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--foreground-dim)" }}>Enabled</p>
        </div>
        <div className="card-glow py-4 px-5 text-center">
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--foreground-muted)" }}>
            {Object.keys(byPhase).length}
          </p>
          <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--foreground-dim)" }}>Phases Covered</p>
        </div>
      </div>

      {allPlugins.length === 0 ? (
        <div
          className="rounded-xl p-16 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(6,214,214,0.06)", border: "1px solid rgba(6,214,214,0.1)" }}
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--accent-cyan)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No plugins registered</p>
          <p className="text-xs mt-1" style={{ color: "var(--foreground-dim)" }}>
            Register plugins in <code className="text-[11px]">src/lib/ai/plugins/</code> to extend cascade agents.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {allPlugins.map((plugin) => (
            <div
              key={`${plugin.phase}-${plugin.name}`}
              className="rounded-xl overflow-hidden"
              style={{
                background: plugin.enabled ? "rgba(16,185,129,0.02)" : "var(--surface)",
                border: `1px solid ${plugin.enabled ? "rgba(16,185,129,0.15)" : "var(--border)"}`,
              }}
            >
              {plugin.enabled && (
                <div
                  className="h-px"
                  style={{ background: "linear-gradient(to right, rgba(16,185,129,0.4), transparent)" }}
                />
              )}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: plugin.enabled ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${plugin.enabled ? "rgba(16,185,129,0.15)" : "var(--border)"}`,
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={plugin.enabled ? "#34d399" : "var(--foreground-dim)"} strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{plugin.name}</h3>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: "rgba(6,214,214,0.06)",
                          color: "var(--accent-cyan)",
                          border: "1px solid rgba(6,214,214,0.12)",
                        }}
                      >
                        {plugin.phase.replace(/_/g, " ")}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider"
                        style={{
                          background: plugin.enabled ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                          color: plugin.enabled ? "#34d399" : "var(--foreground-dim)",
                        }}
                      >
                        {plugin.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs mt-1 truncate" style={{ color: "var(--foreground-dim)" }}>
                      {plugin.description}
                    </p>
                  </div>
                </div>
                <PluginToggleButton
                  phase={plugin.phase}
                  name={plugin.name}
                  enabled={plugin.enabled}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
