"use client";

import { useState, useCallback, useTransition } from "react";
import { submitPublicArchitectForm } from "@/lib/actions/architect-share";

const POSTMAN_ORANGE = "#FF6C37";

const SCM_OPTIONS = ["GitHub", "GitLab", "Bitbucket", "Azure DevOps", "Other"];
const CICD_OPTIONS = ["GitHub Actions", "GitLab CI", "Jenkins", "CircleCI", "Azure Pipelines", "Argo CD", "Other"];
const GATEWAY_OPTIONS = ["Kong", "Apigee", "AWS API Gateway", "Azure API Management", "Nginx", "Envoy", "MuleSoft", "Tyk", "None", "Other"];
const CLOUD_OPTIONS = ["AWS", "Azure", "GCP", "Multi-cloud", "On-Premise", "Hybrid", "Other"];
const IDP_OPTIONS = ["Okta", "Auth0", "Azure AD / Entra ID", "AWS Cognito", "Keycloak", "PingIdentity", "Custom", "None"];
const SECRET_OPTIONS = ["HashiCorp Vault", "AWS Secrets Manager", "Azure Key Vault", "GCP Secret Manager", "CyberArk", "Doppler", "Environment Variables", "Other"];
const MONITORING_OPTIONS = ["Datadog", "New Relic", "Prometheus + Grafana", "Splunk", "Dynatrace", "PagerDuty", "CloudWatch", "Azure Monitor", "None", "Other"];
const SPEC_HOSTING_OPTIONS = ["SwaggerHub", "Spec Hub (Postman)", "Stoplight", "Redocly", "Custom", "None"];
const OBSERVABILITY_OPTIONS = ["Datadog", "Dynatrace", "New Relic", "Splunk", "Honeycomb", "Lightstep", "Jaeger", "None", "Other"];
const API_TYPES = ["REST", "GraphQL", "gRPC", "AsyncAPI", "SOAP", "Other"];
const DEFAULT_ENVS = ["dev", "qa", "staging", "prod"];

interface ServiceEntry {
  domain: string;
  name: string;
  type: string;
  purpose: string;
  specFormat: string;
  hasSpec: boolean;
  ciCdIntegrated: boolean;
  environments: string[];
  hasWorkspace: boolean;
  repoLinked: boolean;
  inCatalog: boolean;
  catalogIngestion: string;
}

const EMPTY_SERVICE: ServiceEntry = {
  domain: "", name: "", type: "REST", purpose: "", specFormat: "",
  hasSpec: false, ciCdIntegrated: false, environments: [...DEFAULT_ENVS],
  hasWorkspace: false, repoLinked: false, inCatalog: false, catalogIngestion: "",
};

interface Props {
  token: string;
  projectName: string;
  prefill: Record<string, unknown>;
}

export function PublicArchitectForm({ token, projectName, prefill }: Props) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const pf = (key: string, fallback: string = "") => (prefill[key] as string) ?? fallback;

  const [companyName, setCompanyName] = useState(pf("companyName"));
  const [primaryDomain, setPrimaryDomain] = useState(pf("primaryDomain"));
  const [contactName, setContactName] = useState(pf("contactName"));
  const [contactEmail, setContactEmail] = useState(pf("contactEmail"));
  const [scm, setScm] = useState(pf("scm"));
  const [ciCd, setCiCd] = useState(pf("ciCd"));
  const [gateway, setGateway] = useState(pf("gateway"));
  const [cloud, setCloud] = useState(pf("cloud"));
  const [idp, setIdp] = useState(pf("idp"));
  const [secretManager, setSecretManager] = useState(pf("secretManager"));
  const [monitoring, setMonitoring] = useState(pf("monitoring"));
  const [specHosting, setSpecHosting] = useState(pf("specHosting"));
  const [observability, setObservability] = useState(pf("observability"));
  const [services, setServices] = useState<ServiceEntry[]>(
    (prefill.services as ServiceEntry[]) ?? [{ ...EMPTY_SERVICE }],
  );
  const [provisioningNotes, setProvisioningNotes] = useState(pf("provisioningNotes"));
  const [secretsNotes, setSecretsNotes] = useState(pf("secretsNotes"));
  const [additionalNotes, setAdditionalNotes] = useState(pf("additionalNotes"));

  const addService = useCallback(() => setServices((p) => [...p, { ...EMPTY_SERVICE }]), []);
  const removeService = useCallback((i: number) => setServices((p) => p.filter((_, idx) => idx !== i)), []);

  const STEPS = [
    { label: "Company & Contact", shortLabel: "Company" },
    { label: "Infrastructure", shortLabel: "Infra" },
    { label: "Services & APIs", shortLabel: "APIs" },
    { label: "Review & Submit", shortLabel: "Submit" },
  ];

  const handleSubmit = () => {
    startTransition(async () => {
      const data = {
        companyName, primaryDomain, contactName, contactEmail,
        scm, ciCd, gateway, cloud, idp, secretManager, monitoring, specHosting, observability,
        services, provisioningNotes, secretsNotes, additionalNotes,
        submittedAt: new Date().toISOString(),
      };
      const res = await submitPublicArchitectForm(token, data);
      if (res.success) setSubmitted(true);
    });
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-6"
          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>Thank You!</h2>
        <p className="text-sm" style={{ color: "var(--foreground-dim, #888)" }}>
          Your architecture information has been submitted for <strong style={{ color: POSTMAN_ORANGE }}>{projectName}</strong>.
          Your Postman CSE will review and follow up.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full"
          style={{ background: `${POSTMAN_ORANGE}10`, border: `1px solid ${POSTMAN_ORANGE}30` }}>
          <svg className="w-5 h-5" style={{ color: POSTMAN_ORANGE }} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: POSTMAN_ORANGE }}>Postman Architecture Discovery</span>
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
          Architecture Questionnaire
        </h1>
        <p className="text-sm" style={{ color: "var(--foreground-dim, #888)" }}>
          For project: <strong style={{ color: "var(--foreground)" }}>{projectName}</strong>
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => setStep(i)}
            className="flex-1 py-2 rounded-lg text-center transition-all text-[10px] sm:text-xs font-medium"
            style={{
              background: i === step ? `${POSTMAN_ORANGE}15` : i < step ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
              color: i === step ? POSTMAN_ORANGE : i < step ? "#34d399" : "var(--foreground-dim, #888)",
              border: `1px solid ${i === step ? `${POSTMAN_ORANGE}40` : i < step ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)"}`,
            }}>
            <span className="hidden sm:inline">{s.label}</span>
            <span className="sm:hidden">{s.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* Steps */}
      <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {step === 0 && (
          <>
            <SectionHeading title="Company & Contact" subtitle="Tell us about your organization" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <Field label="Your Name"><TextInput value={contactName} onChange={setContactName} placeholder="e.g. Jane Smith" /></Field>
              <Field label="Email"><TextInput value={contactEmail} onChange={setContactEmail} placeholder="jane@company.com" /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <Field label="Company Name"><TextInput value={companyName} onChange={setCompanyName} placeholder="e.g. Acme Corp" /></Field>
              <Field label="Primary Domain"><TextInput value={primaryDomain} onChange={setPrimaryDomain} placeholder="e.g. Financial Services" /></Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <SectionHeading title="Infrastructure" subtitle="What does your current tech stack look like?" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <Field label="Source Control (SCM)"><SelectInput value={scm} onChange={setScm} options={SCM_OPTIONS} /></Field>
              <Field label="CI/CD Platform"><SelectInput value={ciCd} onChange={setCiCd} options={CICD_OPTIONS} /></Field>
              <Field label="API Gateway"><SelectInput value={gateway} onChange={setGateway} options={GATEWAY_OPTIONS} /></Field>
              <Field label="Cloud Provider"><SelectInput value={cloud} onChange={setCloud} options={CLOUD_OPTIONS} /></Field>
              <Field label="Identity Provider (IDP)"><SelectInput value={idp} onChange={setIdp} options={IDP_OPTIONS} /></Field>
              <Field label="Secret Manager"><SelectInput value={secretManager} onChange={setSecretManager} options={SECRET_OPTIONS} /></Field>
              <Field label="Monitoring / Alerting"><SelectInput value={monitoring} onChange={setMonitoring} options={MONITORING_OPTIONS} /></Field>
              <Field label="Spec Hosting"><SelectInput value={specHosting} onChange={setSpecHosting} options={SPEC_HOSTING_OPTIONS} /></Field>
              <Field label="Observability"><SelectInput value={observability} onChange={setObservability} options={OBSERVABILITY_OPTIONS} /></Field>
            </div>
            <Field label="How is a new service provisioned today? (IDP workflow, manual tickets, etc.)">
              <textarea value={provisioningNotes} onChange={(e) => setProvisioningNotes(e.target.value)}
                rows={3} placeholder="Describe how a developer requests and sets up a new service..."
                className="w-full px-3 py-2 rounded-xl text-sm resize-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }} />
            </Field>
            <Field label="How are secrets and environment variables managed?">
              <textarea value={secretsNotes} onChange={(e) => setSecretsNotes(e.target.value)}
                rows={2} placeholder="e.g. Vault with AppRole auth, injected at deploy time..."
                className="w-full px-3 py-2 rounded-xl text-sm resize-none mt-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <SectionHeading title="Services & APIs" subtitle="List the key services we should focus on for the POC" />
            <div className="space-y-4 mb-4">
              {services.map((svc, i) => (
                <div key={i} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold" style={{ color: POSTMAN_ORANGE }}>Service {i + 1}</p>
                    {services.length > 1 && (
                      <button onClick={() => removeService(i)} className="text-[10px] px-2 py-0.5 rounded"
                        style={{ color: "#f87171", background: "rgba(239,68,68,0.08)" }}>Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Domain"><TextInput value={svc.domain} onChange={(v) => { const s = [...services]; s[i] = { ...s[i], domain: v }; setServices(s); }} placeholder="e.g. payments" /></Field>
                    <Field label="Service Name"><TextInput value={svc.name} onChange={(v) => { const s = [...services]; s[i] = { ...s[i], name: v }; setServices(s); }} placeholder="e.g. checkout-api" /></Field>
                    <Field label="API Type"><SelectInput value={svc.type} onChange={(v) => { const s = [...services]; s[i] = { ...s[i], type: v }; setServices(s); }} options={API_TYPES} /></Field>
                    <Field label="Purpose"><TextInput value={svc.purpose} onChange={(v) => { const s = [...services]; s[i] = { ...s[i], purpose: v }; setServices(s); }} placeholder="e.g. Handles checkout flow" /></Field>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3">
                    {([["Has API Spec", "hasSpec"], ["CI/CD Integrated", "ciCdIntegrated"], ["Has Postman Workspace", "hasWorkspace"], ["Repo Linked", "repoLinked"]] as const).map(([label, key]) => (
                      <label key={key} className="flex items-center gap-1.5 text-[11px] cursor-pointer" style={{ color: "var(--foreground-dim, #888)" }}>
                        <input type="checkbox" checked={svc[key] as boolean}
                          onChange={(e) => { const s = [...services]; s[i] = { ...s[i], [key]: e.target.checked }; setServices(s); }}
                          className="rounded" style={{ accentColor: POSTMAN_ORANGE }} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addService} className="w-full py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: `${POSTMAN_ORANGE}08`, border: `1px dashed ${POSTMAN_ORANGE}40`, color: POSTMAN_ORANGE }}>
              + Add Another Service
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <SectionHeading title="Review & Submit" subtitle="Review your information before submitting" />

            <ReviewSection title="Contact">
              <ReviewRow label="Name" value={contactName} />
              <ReviewRow label="Email" value={contactEmail} />
              <ReviewRow label="Company" value={companyName} />
              <ReviewRow label="Domain" value={primaryDomain} />
            </ReviewSection>

            <ReviewSection title="Infrastructure">
              {[["SCM", scm], ["CI/CD", ciCd], ["Gateway", gateway], ["Cloud", cloud],
                ["IDP", idp], ["Secrets", secretManager], ["Monitoring", monitoring],
                ["Spec Hosting", specHosting], ["Observability", observability],
              ].map(([label, val]) => <ReviewRow key={label} label={label} value={val} />)}
            </ReviewSection>

            <ReviewSection title={`Services (${services.length})`}>
              {services.map((svc, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: POSTMAN_ORANGE }} />
                  <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                    {svc.domain ? `${svc.domain}/` : ""}{svc.name || "Unnamed"}
                    <span className="font-normal ml-2" style={{ color: "var(--foreground-dim, #888)" }}>({svc.type})</span>
                  </span>
                </div>
              ))}
            </ReviewSection>

            <Field label="Additional Notes / Questions">
              <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={3} placeholder="Anything else we should know..."
                className="w-full px-3 py-2 rounded-xl text-sm resize-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }} />
            </Field>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          className="px-5 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-30"
          style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-dim, #888)", border: "1px solid rgba(255,255,255,0.08)" }}>
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: `linear-gradient(135deg, ${POSTMAN_ORANGE}, #e5593a)`, color: "#fff", boxShadow: `0 0 20px ${POSTMAN_ORANGE}30` }}>
            Continue
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={isPending}
            className="px-8 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${POSTMAN_ORANGE}, #e5593a)`, color: "#fff", boxShadow: `0 0 30px ${POSTMAN_ORANGE}30` }}>
            {isPending ? "Submitting..." : "Submit Architecture Info"}
          </button>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-[10px] mt-8" style={{ color: "var(--foreground-dim, #666)" }}>
        Powered by Postman — this information will be shared with your Postman Customer Success team.
      </p>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--foreground-dim, #888)" }}>{subtitle}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--foreground-dim, #888)" }}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl text-sm transition-all"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }} />
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-xl text-sm appearance-none cursor-pointer"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: value ? "var(--foreground)" : "var(--foreground-dim, #888)" }}>
      <option value="">Select...</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: "var(--foreground-dim, #888)" }}>{title}</p>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 rounded" style={{ background: "rgba(255,255,255,0.01)" }}>
      <span className="text-[10px] font-medium" style={{ color: "var(--foreground-dim, #888)" }}>{label}</span>
      <span className="text-xs font-medium" style={{ color: value ? "var(--foreground)" : "var(--foreground-dim, #666)" }}>{value || "—"}</span>
    </div>
  );
}
