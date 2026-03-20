"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ENGAGEMENT_STAGES } from "@/lib/engagement";
import { setupJiraLeadershipBoard, setEngagementStage } from "@/lib/actions/admin";

interface ProjectCard {
  id: string;
  name: string;
  domain: string | null;
  stage: number;
  status: string;
  completedAt: string | null;
  closedWonAt: string | null;
  jiraIssueKey: string | null;
  jiraBaseUrl: string | null;
  owner: { id: string; name: string; email: string } | null;
  phasesComplete: number;
  totalPhases: number;
  activeBlockers: number;
  hasCritical: boolean;
  hasHigh: boolean;
  daysSinceUpdate: number;
  daysSinceCreation: number;
  hasSlack: boolean;
}

interface DigestData {
  data: {
    totalEngagements: number;
    byStage: Array<{ stage: number; name: string; count: number; color: string }>;
    stageChanges: Array<{ project: string; from: number; to: number }>;
    newBlockers: number;
    resolvedBlockers: number;
    cascadeRuns: number;
    topBlockers: Array<{ project: string; title: string; severity: string }>;
  };
  markdown: string;
}

const AVATAR_COLORS = [
  "#6366f1", "#ec4899", "#f97316", "#14b8a6", "#8b5cf6",
  "#ef4444", "#06b6d4", "#84cc16", "#f59e0b", "#10b981",
];

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const GOLD = "#c9a227";

export function JiraKanbanClient({
  projects,
  digest,
  cses,
}: {
  projects: ProjectCard[];
  digest: DigestData;
  cses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDigest, setShowDigest] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [boardSetupResult, setBoardSetupResult] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState("");
  const [isPending, startTransition] = useTransition();

  // Drag-and-drop state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<number | null>(null);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);
  const [moveToast, setMoveToast] = useState<{ name: string; stage: number; error?: string } | null>(null);

  // Optimistic local stage overrides during drag
  const [stageOverrides, setStageOverrides] = useState<Record<string, number>>({});

  // Assignment Modal State
  const [assignPrompt, setAssignPrompt] = useState<{
    cardId: string;
    cardName: string;
    targetStage: number;
    targetStageName: string;
  } | null>(null);
  const [selectedCseId, setSelectedCseId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  const onDragStart = useCallback((e: React.DragEvent, cardId: string) => {
    setDraggedCardId(cardId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", cardId);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  }, []);

  const onDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedCardId(null);
    setDropTargetStage(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, stage: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetStage(stage);
  }, []);

  const onDragLeave = useCallback(() => {
    setDropTargetStage(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent, targetStage: number) => {
    e.preventDefault();
    setDropTargetStage(null);
    const cardId = e.dataTransfer.getData("text/plain");
    if (!cardId) return;

    const card = projects.find((p) => p.id === cardId);
    if (!card || card.stage === targetStage) return;
    if (stageOverrides[cardId] === targetStage) return;

    // If unassigned, prompt for assignment before moving
    if (!card.owner) {
      const stageInfo = ENGAGEMENT_STAGES.find((s) => s.stage === targetStage);
      setAssignPrompt({
        cardId,
        cardName: card.name,
        targetStage,
        targetStageName: stageInfo ? `S${targetStage} (${stageInfo.name})` : `S${targetStage}`,
      });
      return;
    }

    // Optimistic update
    setStageOverrides((prev) => ({ ...prev, [cardId]: targetStage }));
    setMovingCardId(cardId);

    startTransition(async () => {
      const result = await setEngagementStage(cardId, targetStage) as { success?: boolean; error?: string };
      setMovingCardId(null);

      if (result.error) {
        setStageOverrides((prev) => { const n = { ...prev }; delete n[cardId]; return n; });
        setMoveToast({ name: card.name, stage: targetStage, error: result.error });
      } else {
        setMoveToast({ name: card.name, stage: targetStage });
        router.refresh();
      }

      setTimeout(() => setMoveToast(null), 3000);
    });
  }, [projects, stageOverrides, startTransition, router]);

  const handleAssignSubmit = async () => {
    if (!assignPrompt || !selectedCseId) return;
    setIsAssigning(true);
    const { cardId, cardName, targetStage } = assignPrompt;

    setStageOverrides((prev) => ({ ...prev, [cardId]: targetStage }));
    setMovingCardId(cardId);

    // Call the assign action, then the move action
    const { assignProject } = await import("@/lib/actions/admin");
    const assignResult = await assignProject(cardId, selectedCseId);

    if (assignResult.error) {
      setStageOverrides((prev) => { const n = { ...prev }; delete n[cardId]; return n; });
      setMoveToast({ name: cardName, stage: targetStage, error: assignResult.error });
      setAssignPrompt(null);
      setIsAssigning(false);
      setMovingCardId(null);
      return;
    }

    // Then move it
    const moveResult = await setEngagementStage(cardId, targetStage) as { success?: boolean; error?: string };
    
    setAssignPrompt(null);
    setIsAssigning(false);
    setMovingCardId(null);
    setSelectedCseId("");

    if (moveResult.error) {
       setStageOverrides((prev) => { const n = { ...prev }; delete n[cardId]; return n; });
       setMoveToast({ name: cardName, stage: targetStage, error: moveResult.error });
    } else {
       setMoveToast({ name: cardName, stage: targetStage });
       router.refresh();
    }

    setTimeout(() => setMoveToast(null), 3000);
  };

  const allOwners = Array.from(new Set(projects.map((p) => p.owner?.name).filter(Boolean))) as string[];

  // Apply optimistic stage overrides for drag-and-drop
  const effectiveProjects = projects.map((p) =>
    stageOverrides[p.id] !== undefined ? { ...p, stage: stageOverrides[p.id] } : p,
  );

  const filteredProjects = effectiveProjects.filter((p) => {
    if (ownerFilter === "__unassigned__" && p.owner !== null) return false;
    if (ownerFilter && ownerFilter !== "__unassigned__" && p.owner?.name !== ownerFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.domain?.toLowerCase().includes(q) ||
      p.owner?.name.toLowerCase().includes(q) ||
      p.jiraIssueKey?.toLowerCase().includes(q)
    );
  });

  const handleSetupBoard = () => {
    if (!boardKey.trim()) return;
    startTransition(async () => {
      const result = await setupJiraLeadershipBoard(boardKey.trim()) as Record<string, unknown>;
      if (result.error) {
        setBoardSetupResult(`Error: ${result.error}`);
      } else {
        const details = Array.isArray(result.details) ? result.details.join(" | ") : "";
        setBoardSetupResult(`Board created. ${details}`);
      }
    });
  };

  const stageCounts = ENGAGEMENT_STAGES.map((s) => ({
    stage: s.stage,
    count: filteredProjects.filter((p) => p.stage === s.stage).length,
  }));
  const total = filteredProjects.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
            Engagement Pipeline
          </h1>
          <span
            className="text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider"
            style={{ background: "rgba(6,214,214,0.1)", color: "#06d6d6", border: "1px solid rgba(6,214,214,0.15)" }}
          >
            {total} active
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="#64748b" strokeWidth="1.5" />
              <path d="M11 11l3.5 3.5" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="text-xs bg-transparent outline-none"
              style={{ color: "var(--foreground)", width: 110 }}
            />
          </div>

          <select
            value={ownerFilter ?? ""}
            onChange={(e) => setOwnerFilter(e.target.value || null)}
            className="text-xs px-2.5 py-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--foreground-muted)", outline: "none" }}
          >
            <option value="">All CSEs</option>
            {allOwners.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
            <option value="__unassigned__">Unassigned</option>
          </select>

          <button
            onClick={() => setShowDigest(!showDigest)}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
            style={{
              background: showDigest ? "rgba(201,162,39,0.1)" : "rgba(255,255,255,0.03)",
              color: showDigest ? GOLD : "var(--foreground-dim)",
              border: `1px solid ${showDigest ? "rgba(201,162,39,0.2)" : "var(--border)"}`,
            }}
          >
            Digest
          </button>

          <a
            href="https://postmanlabs.atlassian.net/jira/software/projects/COT/boards/7612"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: "rgba(201,162,39,0.12)", color: GOLD, border: "1px solid rgba(201,162,39,0.2)" }}
          >
            Open in Jira
          </a>
        </div>
      </div>

      {/* CSE Quick Filter Bar */}
      <div className="mb-5 flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setOwnerFilter(null)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all"
          style={{
            background: !ownerFilter ? "rgba(201,162,39,0.15)" : "rgba(255,255,255,0.03)",
            color: !ownerFilter ? GOLD : "var(--foreground-dim)",
            border: `1px solid ${!ownerFilter ? "rgba(201,162,39,0.25)" : "var(--border)"}`,
          }}
        >
          All
        </button>
        {allOwners.map((name) => (
          <button
            key={name}
            onClick={() => setOwnerFilter(ownerFilter === name ? null : name)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
            style={{
              background: ownerFilter === name ? `${avatarColor(name)}20` : "rgba(255,255,255,0.02)",
              color: ownerFilter === name ? avatarColor(name) : "var(--foreground-dim)",
              border: `1px solid ${ownerFilter === name ? `${avatarColor(name)}40` : "var(--border)"}`,
            }}
          >
            <span
              className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white"
              style={{ background: avatarColor(name), width: 18, height: 18 }}
            >
              {getInitials(name)}
            </span>
            {name.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Digest */}
      {showDigest && (
        <div className="card-glow mb-5 p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: GOLD }}>Weekly Portfolio Digest</h3>
          <pre className="text-xs whitespace-pre-wrap leading-relaxed overflow-auto max-h-96" style={{ color: "var(--foreground-dim)" }}>
            {digest.markdown}
          </pre>
        </div>
      )}

      {/* Move toast notification */}
      {moveToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-xs font-medium shadow-xl"
          style={{
            background: moveToast.error ? "rgba(239,68,68,0.9)" : "rgba(34,197,94,0.9)",
            color: "#fff",
            backdropFilter: "blur(12px)",
            animation: "fade-in 0.2s ease-out",
          }}
        >
          {moveToast.error
            ? `Failed to move "${moveToast.name}": ${moveToast.error}`
            : `Moved "${moveToast.name}" → S${moveToast.stage} (syncing to Jira…)`}
        </div>
      )}

      {/* Stage Kanban Board */}
      <div className="grid pb-4 gap-1.5" style={{ minHeight: 520, gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {ENGAGEMENT_STAGES.map((stageInfo) => {
          const cards = filteredProjects.filter((p) => p.stage === stageInfo.stage);
          const count = stageCounts.find((s) => s.stage === stageInfo.stage)?.count ?? 0;
          const isDropTarget = dropTargetStage === stageInfo.stage && draggedCardId !== null;

          return (
            <div
              key={stageInfo.stage}
              className="rounded-lg flex flex-col min-w-0 transition-all duration-150"
              style={{
                background: isDropTarget ? `${stageInfo.color}0a` : "rgba(255,255,255,0.015)",
                border: isDropTarget ? `2px solid ${stageInfo.color}50` : "1px solid var(--border)",
                boxShadow: isDropTarget ? `0 0 20px ${stageInfo.color}15, inset 0 0 30px ${stageInfo.color}05` : "none",
                minHeight: 400,
              }}
              onDragOver={(e) => onDragOver(e, stageInfo.stage)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, stageInfo.stage)}
            >
              {/* Column header */}
              <div className="px-2 pt-2.5 pb-2" style={{ borderBottom: `1px solid ${isDropTarget ? `${stageInfo.color}30` : "var(--border)"}` }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: stageInfo.color, boxShadow: `0 0 6px ${stageInfo.color}50` }}
                  />
                  <span className="text-[10px] font-bold tracking-wider uppercase truncate" style={{ color: stageInfo.color }}>
                    S{stageInfo.stage}
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto flex-shrink-0"
                    style={{
                      background: count > 0 ? `${stageInfo.color}15` : "transparent",
                      color: count > 0 ? stageInfo.color : "var(--foreground-dim)",
                    }}
                  >
                    {count}
                  </span>
                </div>
                <p className="text-[9px] font-medium truncate" style={{ color: "var(--foreground-muted)" }} title={stageInfo.name}>
                  {stageInfo.name}
                </p>
                {/* Progress bar */}
                <div className="mt-1.5 h-[2px] rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: total > 0 ? `${Math.max(3, (count / total) * 100)}%` : "0%",
                      background: stageInfo.color,
                      boxShadow: count > 0 ? `0 0 4px ${stageInfo.color}60` : "none",
                    }}
                  />
                </div>
              </div>

              {/* Drop zone hint */}
              {isDropTarget && (
                <div className="mx-1 mt-1 py-2 rounded border border-dashed text-center" style={{ borderColor: `${stageInfo.color}40`, background: `${stageInfo.color}08` }}>
                  <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: stageInfo.color }}>
                    Drop to move to S{stageInfo.stage}
                  </p>
                </div>
              )}

              {/* Cards */}
              <div className="flex-1 px-1 py-1.5 space-y-1 overflow-y-auto" style={{ maxHeight: 700 }}>
                {cards.map((card) => (
                  <StageCard
                    key={card.id}
                    card={card}
                    stageColor={stageInfo.color}
                    isDragging={draggedCardId === card.id}
                    isMoving={movingCardId === card.id}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                ))}
                {cards.length === 0 && !isDropTarget && (
                  <div className="text-center py-10">
                    <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Empty</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Board Setup */}
      <div className="card-glow mt-6 p-5">
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>Jira Board Setup</h3>
        <p className="text-xs mb-3" style={{ color: "var(--foreground-dim)" }}>
          Auto-create a Jira KanBan board with engagement stage columns and quick filters.
        </p>
        <div className="flex gap-2">
          <input
            value={boardKey}
            onChange={(e) => setBoardKey(e.target.value)}
            placeholder="Jira Project Key (e.g. CSE)"
            className="text-xs flex-1 py-2 px-3 rounded-lg"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }}
          />
          <button
            onClick={handleSetupBoard}
            disabled={isPending || !boardKey.trim()}
            className="text-xs px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              background: "rgba(201,162,39,0.12)",
              color: GOLD,
              border: "1px solid rgba(201,162,39,0.2)",
              opacity: isPending || !boardKey.trim() ? 0.4 : 1,
            }}
          >
            {isPending ? "Creating..." : "Create Board"}
          </button>
        </div>
        {boardSetupResult && (
          <p
            className="text-xs mt-2 p-2 rounded-lg"
            style={{
              background: boardSetupResult.startsWith("Error") ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
              color: boardSetupResult.startsWith("Error") ? "#ef4444" : "#22c55e",
              border: `1px solid ${boardSetupResult.startsWith("Error") ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)"}`,
            }}
          >
            {boardSetupResult}
          </p>
        )}
      </div>

      {/* Assignment Prompt Modal */}
      {assignPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-sm rounded-xl border p-5 shadow-2xl relative"
            style={{ background: "var(--background)", borderColor: "var(--border)" }}
          >
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
              Assign Project to move it
            </h3>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: "var(--foreground-dim)" }}>
              You are moving the unassigned project <strong style={{color:"var(--foreground)"}}>{assignPrompt.cardName}</strong> to stage{" "}
              <strong style={{color:"var(--foreground)"}}>{assignPrompt.targetStageName}</strong>.
              <br/><br/>
              Please select a CSE to assign this project to before moving it.
            </p>

            <select
              value={selectedCseId}
              onChange={(e) => setSelectedCseId(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-lg mb-5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                outline: "none"
              }}
            >
              <option value="" disabled>Select a CSE...</option>
              {cses.map(cse => (
                <option key={cse.id} value={cse.id}>{cse.name}</option>
              ))}
            </select>

            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => {
                  setAssignPrompt(null);
                  setSelectedCseId("");
                }}
                disabled={isAssigning}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "var(--foreground-dim)",
                  border: "1px solid var(--border)",
                }}
              >
                Cancel Move
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={isAssigning || !selectedCseId}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: "rgba(201,162,39,0.15)",
                  color: GOLD,
                  border: "1px solid rgba(201,162,39,0.3)",
                  opacity: (isAssigning || !selectedCseId) ? 0.5 : 1,
                }}
              >
                {isAssigning ? "Assigning..." : "Assign & Move"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StageCard({
  card,
  stageColor,
  isDragging,
  isMoving,
  onDragStart,
  onDragEnd,
}: {
  card: ProjectCard;
  stageColor: string;
  isDragging: boolean;
  isMoving: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
}) {
  const isDone = card.stage === 6;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card.id)}
      onDragEnd={onDragEnd}
      className="rounded-md p-2 transition-all hover:brightness-125 group"
      style={{
        background: isMoving
          ? "rgba(201,162,39,0.08)"
          : isDragging
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.025)",
        borderTop: isMoving ? "1px solid rgba(201,162,39,0.25)" : "1px solid rgba(255,255,255,0.04)",
        borderRight: isMoving ? "1px solid rgba(201,162,39,0.25)" : "1px solid rgba(255,255,255,0.04)",
        borderBottom: isMoving ? "1px solid rgba(201,162,39,0.25)" : "1px solid rgba(255,255,255,0.04)",
        borderLeft: `2px solid ${stageColor}`,
        cursor: isMoving ? "wait" : "grab",
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {/* Drag handle indicator */}
      <div className="flex items-start gap-1.5">
        <svg
          className="flex-shrink-0 mt-0.5 opacity-30 group-hover:opacity-60 transition-opacity"
          width="6" height="10" viewBox="0 0 6 10" fill="currentColor"
          style={{ color: "var(--foreground-dim)" }}
        >
          <circle cx="1.5" cy="1.5" r="1" /><circle cx="4.5" cy="1.5" r="1" />
          <circle cx="1.5" cy="5" r="1" /><circle cx="4.5" cy="5" r="1" />
          <circle cx="1.5" cy="8.5" r="1" /><circle cx="4.5" cy="8.5" r="1" />
        </svg>
        <div className="min-w-0 flex-1">
          <Link href={`/projects/${card.id}`} onClick={(e) => { if (isDragging) e.preventDefault(); }}>
            <p className="text-[10px] font-medium leading-snug mb-0.5 truncate hover:underline" style={{ color: "var(--foreground)" }} title={card.name}>
              {card.name}
            </p>
          </Link>

          {card.domain && (
            <p className="text-[9px] mb-1.5 truncate" style={{ color: "var(--foreground-dim)" }}>
              {card.domain}
            </p>
          )}

          <div className="flex flex-wrap gap-0.5 mb-1.5">
            {isMoving && (
              <span className="text-[8px] font-semibold px-1 py-0.5 rounded animate-pulse" style={{ background: "rgba(201,162,39,0.15)", color: GOLD }}>
                Moving…
              </span>
            )}
            {card.activeBlockers > 0 && (
              <span
                className="text-[8px] font-semibold px-1 py-0.5 rounded"
                style={{
                  background: card.hasCritical ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                  color: card.hasCritical ? "#ef4444" : "#f59e0b",
                }}
              >
                {card.activeBlockers} bl
              </span>
            )}
            {card.phasesComplete > 0 && (
              <span className="text-[8px] font-semibold px-1 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                {card.phasesComplete}/{card.totalPhases}
              </span>
            )}
            {isDone && (
              <span className="text-[8px] font-semibold px-1 py-0.5 rounded" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                Done
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            {card.jiraIssueKey ? (
              <span className="text-[8px] font-mono" style={{ color: "var(--foreground-dim)", textDecoration: isDone ? "line-through" : "none" }}>
                {card.jiraIssueKey}
              </span>
            ) : (
              <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.1)" }}>—</span>
            )}

            {card.owner ? (
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-[6px] font-bold text-white flex-shrink-0"
                style={{ background: avatarColor(card.owner.name), boxShadow: `0 0 4px ${avatarColor(card.owner.name)}40` }}
                title={card.owner.name}
              >
                {getInitials(card.owner.name)}
              </div>
            ) : (
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.06)" }}
                title="Unassigned"
              >
                <svg width="8" height="8" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="6" r="3" stroke="#475569" strokeWidth="1.2" />
                  <path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
