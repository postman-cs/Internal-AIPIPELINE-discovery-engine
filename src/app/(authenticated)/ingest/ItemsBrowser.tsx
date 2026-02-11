"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import {
  getIngestItems,
  consumeSingleItem,
  unconsumeSingleItem,
  consumeItemsAction,
} from "@/lib/actions/ingest";
import { ALL_SOURCES, getSourceMeta } from "@/lib/ingest-sources";

type IngestItem = {
  id: string;
  source: string;
  title: string;
  rawText: string | null;
  url: string | null;
  timestamp: Date;
  consumedAt: Date | null;
  metadataJson: string | null;
  ingestRun: { trigger: string };
};

export function ItemsBrowser({ initialCounts }: { initialCounts: Record<string, number> }) {
  const [items, setItems] = useState<IngestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [showConsumed, setShowConsumed] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const loadItems = useCallback(() => {
    startTransition(async () => {
      const result = await getIngestItems({
        source: sourceFilter || undefined,
        consumed: showConsumed ? undefined : false,
        limit: pageSize,
        offset: page * pageSize,
      });
      setItems(result.items as unknown as IngestItem[]);
      setTotal(result.total);
    });
  }, [sourceFilter, showConsumed, page]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleToggleConsume = (item: IngestItem) => {
    startTransition(async () => {
      if (item.consumedAt) await unconsumeSingleItem(item.id);
      else await consumeSingleItem(item.id);
      loadItems();
    });
  };

  const handleConsumeAllFiltered = () => {
    startTransition(async () => {
      await consumeItemsAction(sourceFilter || undefined);
      loadItems();
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color: "var(--foreground-dim)" }}>Source:</label>
          <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }} className="input-field text-xs w-44">
            <option value="">All sources</option>
            {ALL_SOURCES.map((s) => {
              const meta = getSourceMeta(s);
              const count = initialCounts[s] || 0;
              return <option key={s} value={s}>{meta.icon} {meta.label} {count > 0 ? `(${count})` : ""}</option>;
            })}
          </select>
        </div>

        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: "var(--foreground-dim)" }}>
          <input type="checkbox" checked={showConsumed} onChange={(e) => { setShowConsumed(e.target.checked); setPage(0); }} className="rounded" style={{ accentColor: "var(--accent-cyan)" }} />
          Show consumed
        </label>

        <div className="flex-1" />
        <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>{total} item{total !== 1 ? "s" : ""}</span>

        {!showConsumed && total > 0 && (
          <button onClick={handleConsumeAllFiltered} disabled={isPending} className="btn-secondary text-xs py-1.5 disabled:opacity-50">
            {isPending ? "..." : `Consume All${sourceFilter ? ` (${getSourceMeta(sourceFilter).shortLabel})` : ""}`}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>
            {isPending ? "Loading..." : showConsumed ? "No items found" : "No unconsumed items. Run an ingest to pull new signals."}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const meta = getSourceMeta(item.source);
            const isExpanded = expandedItem === item.id;

            return (
              <div
                key={item.id}
                className="rounded-lg transition-colors"
                style={{
                  background: item.consumedAt ? "rgba(255,255,255,0.01)" : "var(--surface)",
                  border: `1px solid ${item.consumedAt ? "var(--border)" : "var(--border-bright)"}`,
                }}
              >
                <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none" onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
                  <span className="text-base shrink-0" title={meta.label}>{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${item.consumedAt ? "line-through" : ""}`}
                      style={{ color: item.consumedAt ? "var(--foreground-dim)" : "var(--foreground)" }}
                    >
                      {item.title}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>
                      {new Date(item.timestamp).toLocaleDateString()} &middot; {item.ingestRun.trigger}
                      {item.url && (
                        <> &middot; <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-cyan)" }} onClick={(e) => e.stopPropagation()}>link</a></>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleConsume(item); }}
                    disabled={isPending}
                    className="shrink-0 text-xs font-medium px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                    style={{ color: item.consumedAt ? "var(--foreground-dim)" : "var(--accent-green)" }}
                  >
                    {item.consumedAt ? "Undo" : "Consume"}
                  </button>
                  <svg className={`w-3.5 h-3.5 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} style={{ color: "var(--foreground-dim)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {isExpanded && item.rawText && (
                  <div className="px-3 py-3 mx-3 mb-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed" style={{ color: "var(--foreground-muted)" }}>{item.rawText}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || isPending} className="btn-ghost text-xs disabled:opacity-30">Previous</button>
          <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || isPending} className="btn-ghost text-xs disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}
