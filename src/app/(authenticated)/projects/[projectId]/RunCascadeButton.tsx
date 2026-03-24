"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunCascadeButton({ projectId }: { projectId: string }) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const handleRun = async () => {
    setIsPending(true);
    try {
      // Call the API route directly — it runs inline with maxDuration=800s
      // The server action fire-and-forgets which gets killed on Vercel serverless
      const res = await fetch(`/api/projects/${projectId}/cascade/recompute`, {
        method: "POST",
      });
      const result = await res.json();
      if (result.error) {
        alert(result.error);
        return;
      }
      router.push(`/projects/${projectId}/updates`);
      router.refresh();
    } catch (err) {
      alert(`Cascade failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      onClick={handleRun}
      disabled={isPending}
      className="btn-primary text-sm py-2.5 px-5 disabled:opacity-50 inline-flex items-center gap-2"
    >
      {isPending ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Starting Cascade...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 14.828a4 4 0 010-5.656m5.656 0a4 4 0 010 5.656M12 12h.008v.008H12V12z" />
          </svg>
          Run Cascade
        </>
      )}
    </button>
  );
}
