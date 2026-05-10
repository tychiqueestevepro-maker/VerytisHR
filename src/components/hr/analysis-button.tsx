"use client";

import { useState } from "react";
import { Play, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function AnalysisButton({ token, className }: { token: string; className?: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAnalyze() {
    if (status === "loading") return;
    
    setStatus("loading");
    setError(null);
    
    try {
      const response = await fetch(`/api/hr/pipeline-sessions/${token}/analyze`, {
        method: "POST",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }
      
      setStatus("success");
      router.refresh();
      
      // Reset after 3s
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
      setTimeout(() => setStatus("idle"), 5000);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleAnalyze}
        disabled={status === "loading" || status === "success"}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50",
          status === "idle" && "bg-foreground text-background hover:bg-foreground/90",
          status === "loading" && "bg-secondary text-foreground/50",
          status === "success" && "bg-emerald-500 text-white",
          status === "error" && "bg-rose-500 text-white",
          className
        )}
      >
        {status === "idle" && (
          <>
            <Play className="size-4 fill-current" />
            <span>Run analysis</span>
          </>
        )}
        {status === "loading" && (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Analyzing...</span>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="size-4" />
            <span>Analyzed!</span>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="size-4" />
            <span>Retry</span>
          </>
        )}
      </button>
      {error && <p className="text-[10px] text-rose-500 font-medium">{error}</p>}
    </div>
  );
}
