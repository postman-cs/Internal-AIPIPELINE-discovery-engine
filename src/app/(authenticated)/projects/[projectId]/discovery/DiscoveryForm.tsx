"use client";

import { useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { discoveryArtifactSchema, DiscoveryArtifactInput } from "@/lib/schemas";
import { saveDiscoveryArtifact } from "@/lib/actions/discovery";
import { useRouter } from "next/navigation";

const DEFAULT_VALUES: DiscoveryArtifactInput = {
  keplerPaste: "",
  dnsFindings: "",
  headerFindings: "",
  publicFootprint: "",
  authForensics: "",
  cloudGatewaySignals: "",
  developerFrictionSignals: "",
  evidenceLinks: [],
  industry: "",
  engineeringSize: "",
  publicApiPresence: "",
  technicalLandscape: [
    { signal: "Primary Cloud", finding: "", evidence: "", confidence: "" },
    { signal: "CDN / Edge", finding: "", evidence: "", confidence: "" },
    { signal: "Auth Pattern", finding: "", evidence: "", confidence: "" },
    { signal: "Backend Tech", finding: "", evidence: "", confidence: "" },
  ],
  maturityLevel: undefined,
  maturityJustification: "",
  hypothesis: "",
  recommendedApproach: "",
  conversationAngle: "",
  stakeholderTargets: [],
  firstMeetingAgenda: [
    { timeBlock: "5 min", topic: "Validate assumptions", detail: "" },
    { timeBlock: "10 min", topic: "Pain point mapping", detail: "" },
    { timeBlock: "10 min", topic: "Quick win identification", detail: "" },
    { timeBlock: "5 min", topic: "Next steps", detail: "" },
  ],
};

const TABS = [
  { id: "kepler", label: "Kepler" },
  { id: "outside-in", label: "Outside-In" },
  { id: "signals", label: "Signals & Maturity" },
  { id: "hypothesis", label: "Hypothesis" },
  { id: "stakeholders", label: "Stakeholders" },
] as const;

export function DiscoveryForm({ projectId, defaults }: { projectId: string; defaults?: DiscoveryArtifactInput }) {
  const [activeTab, setActiveTab] = useState<string>("kepler");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string; version?: number } | null>(null);
  const router = useRouter();

  const { register, control, handleSubmit, formState: { errors } } = useForm<DiscoveryArtifactInput>({
    resolver: zodResolver(discoveryArtifactSchema),
    defaultValues: defaults || DEFAULT_VALUES,
  });

  const { fields: techFields } = useFieldArray({ control, name: "technicalLandscape" });
  const { fields: stakeholderFields, append: addStakeholder, remove: removeStakeholder } = useFieldArray({ control, name: "stakeholderTargets" });
  const { fields: agendaFields } = useFieldArray({ control, name: "firstMeetingAgenda" });
  const { fields: evidenceFields, append: addEvidence, remove: removeEvidence } = useFieldArray({ control, name: "evidenceLinks" });

  const onSubmit = (data: DiscoveryArtifactInput) => {
    startTransition(async () => {
      setResult(null);
      const res = await saveDiscoveryArtifact(projectId, data);
      setResult(res);
      if (res.success) router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200"
            style={{
              borderBottom: `2px solid ${activeTab === tab.id ? "var(--accent-cyan)" : "transparent"}`,
              color: activeTab === tab.id ? "var(--accent-cyan)" : "var(--foreground-muted)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "kepler" && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Kepler Intelligence</h2>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            Paste Kepler intelligence data for this customer.
          </p>
          <div>
            <label htmlFor="keplerPaste" className="label">Kepler Data</label>
            <textarea id="keplerPaste" {...register("keplerPaste")} className="textarea-field min-h-[300px] font-mono text-xs" placeholder="Paste Kepler intelligence here..." />
          </div>
        </div>
      )}

      {activeTab === "outside-in" && (
        <div className="card space-y-6">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Outside-In Terrain Map</h2>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Document findings from external reconnaissance.</p>

          <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground-muted)" }}>Company Snapshot</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="label">Industry</label><input {...register("industry")} className="input-field" placeholder="e.g. FinTech" /></div>
              <div><label className="label">Engineering Size (est.)</label><input {...register("engineeringSize")} className="input-field" placeholder="e.g. 50-100" /></div>
              <div>
                <label className="label">Public API Presence</label>
                <select {...register("publicApiPresence")} className="input-field">
                  <option value="">Select...</option><option value="Yes">Yes</option><option value="No">No</option><option value="Partial">Partial</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">DNS Findings</label><textarea {...register("dnsFindings")} className="textarea-field" placeholder="DNS and subdomain findings..." /></div>
            <div><label className="label">Header Findings</label><textarea {...register("headerFindings")} className="textarea-field" placeholder="HTTP header analysis..." /></div>
            <div><label className="label">Public Footprint</label><textarea {...register("publicFootprint")} className="textarea-field" placeholder="Postman Network, developer portal presence..." /></div>
            <div><label className="label">Auth Forensics</label><textarea {...register("authForensics")} className="textarea-field" placeholder="Authentication patterns observed..." /></div>
            <div><label className="label">Cloud / Gateway Signals</label><textarea {...register("cloudGatewaySignals")} className="textarea-field" placeholder="Cloud provider, API gateway, CDN signals..." /></div>
            <div><label className="label">Developer Friction Signals</label><textarea {...register("developerFrictionSignals")} className="textarea-field" placeholder="Developer experience issues, friction points..." /></div>
          </div>

          <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--foreground-muted)" }}>Evidence Links</h3>
              <button type="button" onClick={() => addEvidence({ label: "", url: "" })} className="btn-ghost text-xs">+ Add Link</button>
            </div>
            {evidenceFields.length === 0 && <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>No evidence links added</p>}
            {evidenceFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 mb-2">
                <input {...register(`evidenceLinks.${index}.label`)} className="input-field flex-1" placeholder="Label" />
                <input {...register(`evidenceLinks.${index}.url`)} className="input-field flex-[2]" placeholder="https://..." />
                <button type="button" onClick={() => removeEvidence(index)} className="text-sm px-2" style={{ color: "var(--accent-red)" }}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "signals" && (
        <div className="card space-y-6">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Signals & Maturity Assessment</h2>
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground-muted)" }}>Technical Landscape</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-2 px-2 font-medium text-xs uppercase tracking-wider w-36" style={{ color: "var(--foreground-dim)" }}>Signal</th>
                    <th className="text-left py-2 px-2 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Finding</th>
                    <th className="text-left py-2 px-2 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Evidence</th>
                    <th className="text-left py-2 px-2 font-medium text-xs uppercase tracking-wider w-28" style={{ color: "var(--foreground-dim)" }}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {techFields.map((field, index) => (
                    <tr key={field.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-2 px-2 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                        {field.signal}
                        <input type="hidden" {...register(`technicalLandscape.${index}.signal`)} />
                      </td>
                      <td className="py-2 px-2"><input {...register(`technicalLandscape.${index}.finding`)} className="input-field" placeholder="Finding..." /></td>
                      <td className="py-2 px-2"><input {...register(`technicalLandscape.${index}.evidence`)} className="input-field" placeholder="Evidence..." /></td>
                      <td className="py-2 px-2">
                        <select {...register(`technicalLandscape.${index}.confidence`)} className="input-field">
                          <option value="">—</option><option value="High">High</option><option value="Med">Med</option><option value="Low">Low</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground-muted)" }}>API Maturity Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Maturity Level</label>
                <select {...register("maturityLevel")} className="input-field">
                  <option value="">Select level...</option>
                  <option value={1}>Level 1 - Emerging</option><option value={2}>Level 2 - Maturing</option><option value={3}>Level 3 - Advanced</option>
                </select>
              </div>
              <div>
                <label className="label">Justification</label>
                <textarea {...register("maturityJustification")} className="textarea-field" placeholder="Why this maturity level?" />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "hypothesis" && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Hypothesis & Recommended Approach</h2>
          <div>
            <label className="label">Hypothesis</label>
            <textarea {...register("hypothesis")} className="textarea-field min-h-[150px]" placeholder="Based on the signals gathered, we believe..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Recommended Approach (Path A Phase)</label><input {...register("recommendedApproach")} className="input-field" placeholder="e.g. 0-1 API Program" /></div>
            <div><label className="label">Initial Conversation Angle</label><input {...register("conversationAngle")} className="input-field" placeholder="e.g. Developer experience audit" /></div>
          </div>
        </div>
      )}

      {activeTab === "stakeholders" && (
        <div className="card space-y-6">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Stakeholder Targets & First Meeting</h2>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--foreground-muted)" }}>Stakeholder Targets</h3>
              <button type="button" onClick={() => addStakeholder({ role: "", why: "", firstMeetingGoal: "" })} className="btn-ghost text-xs">+ Add Stakeholder</button>
            </div>
            {stakeholderFields.length === 0 && <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>No stakeholders added yet</p>}
            {stakeholderFields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3 p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <div><label className="label text-xs">Role</label><input {...register(`stakeholderTargets.${index}.role`)} className="input-field" placeholder="e.g. VP Engineering" /></div>
                <div><label className="label text-xs">Why Target</label><input {...register(`stakeholderTargets.${index}.why`)} className="input-field" placeholder="Reason..." /></div>
                <div className="flex gap-2">
                  <div className="flex-1"><label className="label text-xs">First Meeting Goal</label><input {...register(`stakeholderTargets.${index}.firstMeetingGoal`)} className="input-field" placeholder="Goal..." /></div>
                  <button type="button" onClick={() => removeStakeholder(index)} className="text-sm mt-6" style={{ color: "var(--accent-red)" }}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground-muted)" }}>First Meeting Agenda (30 min)</h3>
            {agendaFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 mb-2 items-center">
                <span className="text-sm w-6" style={{ color: "var(--foreground-dim)" }}>{index + 1}.</span>
                <input {...register(`firstMeetingAgenda.${index}.topic`)} className="input-field flex-1" placeholder="Topic" />
                <input {...register(`firstMeetingAgenda.${index}.timeBlock`)} className="input-field w-24" placeholder="5 min" />
                <input {...register(`firstMeetingAgenda.${index}.detail`)} className="input-field flex-[2]" placeholder="Details..." />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {result?.error && <p className="text-sm" style={{ color: "var(--accent-red)" }}>{result.error}</p>}
          {result?.success && (
            <p className="text-sm" style={{ color: "var(--accent-green)" }}>
              Discovery Brief v{result.version} generated!{" "}
              <a href={`/projects/${projectId}/discovery/brief`} style={{ color: "var(--accent-orange)" }}>View Brief &rarr;</a>
            </p>
          )}
          {Object.keys(errors).length > 0 && <p className="text-sm" style={{ color: "var(--accent-red)" }}>Please fix form errors before saving.</p>}
        </div>
        <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
          {isPending ? "Generating..." : "Generate Discovery Brief"}
        </button>
      </div>
    </form>
  );
}
