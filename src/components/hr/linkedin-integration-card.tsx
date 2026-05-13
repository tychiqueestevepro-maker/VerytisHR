"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, Globe, Key, Laptop, Loader2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { relativeTime } from "@/lib/hr/utils";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LinkedinSecureSetup } from "./linkedin-secure-setup";

export function LinkedinIntegrationCard({
  accountName,
  accountImage,
  lastSyncedAt,
  lastDetectedIp,
  lastDetectedCountry,
  lastDetectedCity,
  accounts = [],
}: {
  accountName: string | null;
  accountImage: string | null;
  lastSyncedAt: string | null;
  lastDetectedIp?: string | null;
  lastDetectedCountry?: string | null;
  lastDetectedCity?: string | null;
  accounts?: any[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const isConnected = Boolean(lastSyncedAt) || accounts.some(a => a.status === "connected");
  const isSecure = accounts.some(a => a.status === "connected");
  const isExpired = lastSyncedAt ? (Date.now() - new Date(lastSyncedAt).getTime() > 1000 * 60 * 60 * 24 * 30) : false;

  // Polling automatique pour rafraîchir le statut sans clic
  useEffect(() => {
    if (!isOpen || isConnected) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, isConnected, router]);

  async function handleRevoke() {
    if (!confirm("Voulez-vous vraiment délier votre compte LinkedIn ? Cela désactivera les vérifications automatiques.")) return;
    
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/hr/settings/linkedin-sync", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Impossible de délier le compte");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur lors de la déconnexion");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="group relative w-full max-w-md overflow-hidden rounded-2xl border border-white/40 bg-white/40 p-8 transition-all duration-300 hover:border-pink-500/20 hover:shadow-[0_20px_40px_rgba(236,72,153,0.08)] backdrop-blur-md">
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-pink-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="relative flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600 transition-transform group-hover:scale-110">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
              <rect width="4" height="12" x="2" y="9" />
              <circle cx="4" cy="4" r="2" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-extrabold tracking-tight text-foreground group-hover:text-pink-600 transition-colors">LinkedIn</h3>
            <p className="text-sm font-medium text-foreground/40">Synchronisation de session</p>
          </div>
        </div>
        
        <div className={cn(
          "flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all duration-500",
          isConnected ? "border-emerald-500/20 bg-emerald-50 text-emerald-700 shadow-[0_2px_10px_rgba(16,185,129,0.1)]" : "border-border bg-secondary/30 text-foreground/40"
        )}>
          <div className={cn("size-2 rounded-full animate-pulse", isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-foreground/20")} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {isSecure ? "Sécurisé" : isConnected ? (isExpired ? "Expiré" : "Connecté") : "Déconnecté"}
          </span>
        </div>
      </div>

      <div className="relative z-10">
        {!isSecure ? (
          <div className="space-y-6">
            <div className="rounded-xl bg-secondary/5 border border-border/50 p-4 space-y-4">
              <div className="flex gap-4 items-start">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/10 text-[10px] font-black text-pink-600 mt-0.5">1</div>
                <div className="space-y-1">
                  <p className="text-[13px] font-bold text-foreground">Installer l&apos;extension Verytis</p>
                  <button 
                    onClick={() => window.open("/extension", "_blank")}
                    className="text-[11px] text-pink-600 font-bold hover:underline"
                  >
                    Télécharger l&apos;extension (ZIP)
                  </button>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/10 text-[10px] font-black text-pink-600 mt-0.5">2</div>
                <div className="space-y-1">
                  <p className="text-[13px] font-bold text-foreground">Lancer la synchronisation</p>
                  <p className="text-[11px] text-foreground/40">Ouvrez LinkedIn dans un onglet et cliquez sur le bouton ci-dessous.</p>
                </div>
              </div>
            </div>

            <LinkedinSecureSetup />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-secondary/5 border border-border/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                  <CheckCircle2 className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {accountName || "LinkedIn Synchronisé"}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] font-medium text-foreground/40 mt-0.5">
                    <Globe className="size-3" />
                    <span>Tunnel Sécurisé</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-bold">{lastDetectedCity || "France"} ({lastDetectedIp || "Proxy actif"})</span>
                  </div>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleRevoke}
              disabled={busy}
              className="w-full h-14 gap-3 bg-secondary/10 hover:bg-secondary/20 text-foreground shadow-sm rounded-xl transition-all"
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : <Trash2 className="size-5" />}
              <div className="text-[15px] font-black">Se déconnecter</div>
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-rose-600 text-[12px] font-medium">
          <CircleAlert className="size-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
