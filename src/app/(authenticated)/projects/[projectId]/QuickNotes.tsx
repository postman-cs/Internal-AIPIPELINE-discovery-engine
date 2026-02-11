"use client";

import { useState, useTransition } from "react";
import { addNote, deleteNote } from "@/lib/actions/notes";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

interface Note {
  id: string;
  content: string;
  createdAt: Date;
}

export function QuickNotesSection({ projectId, initialNotes }: { projectId: string; initialNotes: Note[] }) {
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const handleAdd = () => {
    if (!draft.trim()) return;
    startTransition(async () => {
      const result = await addNote(projectId, draft.trim());
      if (result.error) {
        toast.error("Failed", result.error);
      } else {
        toast.success("Note added");
        setDraft("");
        router.refresh();
      }
    });
  };

  const handleDelete = (noteId: string) => {
    startTransition(async () => {
      const result = await deleteNote(noteId);
      if (result.error) {
        toast.error("Failed", result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div>
      {/* Input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Quick note..."
          className="input-field flex-1 text-sm"
          maxLength={1000}
        />
        <button
          onClick={handleAdd}
          disabled={isPending || !draft.trim()}
          className="btn-cyan text-sm disabled:opacity-50 px-3"
        >
          {isPending ? "..." : "+"}
        </button>
      </div>

      {/* Notes list */}
      {initialNotes.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>No notes yet. Jot down thoughts, questions, or next steps.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {initialNotes.map((note) => (
            <div
              key={note.id}
              className="flex items-start gap-2 group rounded-lg p-2 transition-colors"
              style={{ background: "var(--background-secondary)" }}
            >
              <p className="text-xs flex-1" style={{ color: "var(--foreground-muted)" }}>
                {note.content}
              </p>
              <button
                onClick={() => handleDelete(note.id)}
                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                style={{ color: "var(--accent-red)" }}
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
