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

export function ItemsBrowser({
  initialCounts,
}: {
  initialCounts: Record<string, number>;
}) {
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

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleToggleConsume = (item: IngestItem) => {
    startTransition(async () => {
      if (item.consumedAt) {
        await unconsumeSingleItem(item.id);
      } else {
        await consumeSingleItem(item.id);
      }
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
          <label className="text-xs font-medium text-gray-500">Source:</label>
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(0);
            }}
            className="input-field text-xs w-44"
          >
            <option value="">All sources</option>
            {ALL_SOURCES.map((s) => {
              const meta = getSourceMeta(s);
              const count = initialCounts[s] || 0;
              return (
                <option key={s} value={s}>
                  {meta.icon} {meta.label} {count > 0 ? `(${count})` : ""}
                </option>
              );
            })}
          </select>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showConsumed}
            onChange={(e) => {
              setShowConsumed(e.target.checked);
              setPage(0);
            }}
            className="rounded border-gray-300 text-[#ff6c37] focus:ring-[#ff6c37]"
          />
          Show consumed
        </label>

        <div className="flex-1" />

        <span className="text-xs text-gray-400">
          {total} item{total !== 1 ? "s" : ""}
        </span>

        {!showConsumed && total > 0 && (
          <button
            onClick={handleConsumeAllFiltered}
            disabled={isPending}
            className="btn-secondary text-xs py-1.5 disabled:opacity-50"
          >
            {isPending
              ? "..."
              : `Consume All${sourceFilter ? ` (${getSourceMeta(sourceFilter).shortLabel})` : ""}`}
          </button>
        )}
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">
            {isPending
              ? "Loading..."
              : showConsumed
              ? "No items found"
              : "No unconsumed items. Run an ingest to pull new signals."}
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
                className={`rounded-lg border transition-colors ${
                  item.consumedAt
                    ? "border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-900/30"
                    : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                }`}
              >
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none"
                  onClick={() =>
                    setExpandedItem(isExpanded ? null : item.id)
                  }
                >
                  <span className="text-base shrink-0" title={meta.label}>
                    {meta.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        item.consumedAt
                          ? "text-gray-400 line-through"
                          : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(item.timestamp).toLocaleDateString()} &middot;{" "}
                      {item.ingestRun.trigger}
                      {item.url && (
                        <>
                          {" "}
                          &middot;{" "}
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#ff6c37] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            link
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleConsume(item);
                    }}
                    disabled={isPending}
                    className={`shrink-0 text-xs font-medium px-2 py-1 rounded-md transition-colors disabled:opacity-50 ${
                      item.consumedAt
                        ? "text-gray-400 hover:text-[#ff6c37] hover:bg-orange-50 dark:hover:bg-orange-950/30"
                        : "text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                    }`}
                    title={
                      item.consumedAt
                        ? "Mark as unconsumed"
                        : "Mark as consumed"
                    }
                  >
                    {item.consumedAt ? "Undo" : "Consume"}
                  </button>
                  <svg
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>

                {/* Expanded content */}
                {isExpanded && item.rawText && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-3 mx-3 mb-3">
                    <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                      {item.rawText}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || isPending}
            className="btn-ghost text-xs disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-gray-400">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || isPending}
            className="btn-ghost text-xs disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
