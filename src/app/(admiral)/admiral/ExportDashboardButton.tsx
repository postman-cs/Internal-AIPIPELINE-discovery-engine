"use client";

interface ExportData {
  stats: Record<string, number>;
  fleet: Array<{
    name: string;
    email: string;
    _count: { projects: number; ingestRuns: number };
    activeBlockers: number;
    pendingAssumptions: number;
    totalPhases: number;
    projects: Array<{ name: string; engagementStage: number }>;
  }>;
}

export function ExportDashboardButton({ data }: { data: ExportData }) {
  const handleExport = () => {
    const lines: string[] = [];

    lines.push("Admiral Dashboard Report");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("");

    lines.push("=== Fleet Statistics ===");
    for (const [key, val] of Object.entries(data.stats)) {
      lines.push(`${key}: ${val}`);
    }
    lines.push("");

    lines.push("=== CSE Fleet ===");
    lines.push("CSE,Email,Projects,Blockers,Assumptions,Phases,Ingests");
    for (const cse of data.fleet) {
      lines.push(
        [cse.name, cse.email, cse._count.projects, cse.activeBlockers, cse.pendingAssumptions, cse.totalPhases, cse._count.ingestRuns].join(",")
      );
    }
    lines.push("");

    lines.push("=== Engagements ===");
    lines.push("Project,CSE,Stage");
    for (const cse of data.fleet) {
      for (const p of cse.projects) {
        lines.push(`"${p.name}","${cse.name}",S${p.engagementStage}`);
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admiral-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="text-xs px-3 py-1.5 rounded-lg transition-colors"
      style={{
        background: "rgba(201, 162, 39, 0.1)",
        color: "#c9a227",
        border: "1px solid rgba(201, 162, 39, 0.2)",
      }}
    >
      ↓ Download Report
    </button>
  );
}
