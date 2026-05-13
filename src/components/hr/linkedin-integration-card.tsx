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
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger 
        render={
          <button className="group relative w-full max-w-md overflow-hidden rounded-2xl border border-white/40 bg-white/40 p-8 text-left transition-all duration-300 hover:border-pink-500/20 hover:shadow-[0_20px_40_rgba(236,72,153,0.08)] backdrop-blur-md" />
        }
      >
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-pink-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        
        <div className="relative flex items-center justify-between">
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

        <div className="relative mt-10 space-y-5">
          <div className="flex gap-4 items-center">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-500/10 text-[11px] font-black text-pink-600">1</div>
            <div>
              <p className="text-[14px] font-bold text-foreground/80">Installer l&apos;extension</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-500/10 text-[11px] font-black text-pink-600">2</div>
            <div>
              <p className="text-[14px] font-bold text-foreground/80">Connectez-vous</p>
            </div>
          </div>
        </div>
      </SheetTrigger>

      <SheetContent className="flex h-full flex-col p-0 border-l border-white/20 shadow-2xl">
        {/* Background Atmosphere for Modal */}
        <div className="absolute inset-0 bg-background -z-20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#fdf2f8,transparent_50%)] opacity-30 -z-10" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.015] brightness-0 pointer-events-none -z-10" />

        <SheetHeader className="border-b border-black/[0.03] p-8">
          <SheetTitle className="text-2xl font-black tracking-tight">Lier LinkedIn</SheetTitle>
          <SheetDescription className="text-sm font-medium text-foreground/40">Configurez la synchronisation en quelques secondes.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-8 relative z-10">
          <div className="space-y-12">
            {/* New Secure Setup Flow */}
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600 shadow-sm">
                  <ShieldCheck className="size-5" />
                </div>
                <h4 className="text-lg font-extrabold tracking-tight text-foreground">Configuration Directe</h4>
              </div>
              
              {!isSecure ? (
                <div className="rounded-2xl border border-white bg-white/40 p-1 shadow-sm">
                   <LinkedinSecureSetup />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/30 p-6 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
                        <CheckCircle2 className="size-6" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-foreground">
                          Session de {accountName || "LinkedIn"}
                        </p>
                        <p className="text-[11px] font-medium text-foreground/40 mt-0.5">
                          IP : {lastDetectedIp || "Générée"} • {lastDetectedCity || "Localisation auto"}
                        </p>

                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full h-11 rounded-xl font-bold text-xs bg-white/50 border-black/[0.05] hover:bg-white transition-all shadow-sm" 
                    onClick={() => window.location.reload()}
                  >
                    Actualiser le statut
                  </Button>
                </div>
              )}
            </div>

            {/* Legacy Extension Info */}
            {!isSecure && (
              <div className="pt-10 border-t border-black/[0.03]">
                <div className="flex items-center gap-3 mb-6">
                   <Laptop className="size-4 text-foreground/30" />
                   <h4 className="text-sm font-bold text-foreground/60 tracking-tight uppercase tracking-widest">Alternative</h4>
                </div>
                <p className="text-xs font-medium text-foreground/40 leading-relaxed mb-6">
                  Si vous préférez utiliser votre propre navigateur, vous pouvez continuer à utiliser l&apos;extension Chrome.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-10 rounded-xl text-[11px] font-bold bg-white/30 border-black/[0.05]" 
                  onClick={() => window.open("#", "_blank")}
                >
                  Ouvrir le Chrome Web Store
                </Button>
              </div>
            )}
          </div>
        </div>

        {isConnected && (
          <div className="border-t border-black/[0.03] p-8 bg-black/[0.01]">
            <Button
              variant="ghost"
              className="w-full h-12 rounded-xl gap-2 text-rose-500 font-bold hover:bg-rose-500/10 hover:text-rose-600 transition-all"
              onClick={handleRevoke}
              disabled={busy}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Délier mon compte LinkedIn
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
