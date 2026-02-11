"use client";

import { useState, useTransition } from "react";
import { manualUploadAction } from "@/lib/actions/ingest";

export function ManualUpload() {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      setMessage({ type: "error", text: "Title and content are required" });
      return;
    }

    startTransition(async () => {
      setMessage(null);
      const result = await manualUploadAction({
        title: title.trim(),
        content: content.trim(),
        url: url.trim() || undefined,
      });

      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Content uploaded successfully!" });
        setTitle("");
        setContent("");
        setUrl("");
        setTimeout(() => setMessage(null), 4000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-xl shrink-0">
          📎
        </div>
        <div>
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Manual Upload
          </h3>
          <p className="text-xs text-gray-500">
            Paste any content — meeting notes, architecture details, competitive
            intel, screenshots descriptions, or ad-hoc signal.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`text-sm rounded-lg px-3 py-2 ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <label className="label">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input-field"
          placeholder="e.g. Meeting notes: Auth architecture review"
          required
        />
      </div>

      <div>
        <label className="label">Content *</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="input-field resize-y text-sm"
          style={{ minHeight: "200px" }}
          placeholder={`Paste your content here...\n\nExamples:\n- Meeting notes or call summaries\n- Architecture diagram descriptions\n- Competitive landscape observations\n- Customer feedback snippets\n- Anything relevant to the engagement`}
          required
        />
      </div>

      <div>
        <label className="label">Source URL (optional)</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="input-field"
          placeholder="https://..."
        />
        <p className="text-[11px] text-gray-400 mt-1">
          Link to the original document, page, or conversation
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending || !title.trim() || !content.trim()}
        className="btn-primary w-full disabled:opacity-50"
      >
        {isPending ? "Uploading..." : "Upload Content"}
      </button>
    </form>
  );
}
