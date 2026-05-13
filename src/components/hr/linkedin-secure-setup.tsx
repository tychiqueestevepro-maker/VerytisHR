"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  ShieldCheck, 
  Mail, 
  Lock, 
  Globe, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";




export function LinkedinSecureSetup() {
  const [step, setStep] = useState<"form" | "connecting" | "success" | "error">("form");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeAccount, setActiveAccount] = useState<any>(null);
  const [isSyncingExtension, setIsSyncingExtension] = useState(false);

  // Restore state on mount if a connection is already in progress
  useEffect(() => {
    async function checkExistingConnection() {
      try {
        const res = await fetch(`/api/hr/settings/linkedin-accounts?t=${Date.now()}`, { cache: 'no-store' });
        const { accounts } = await res.json();
        if (accounts && accounts.length > 0) {
          const sortedAccounts = [...accounts].sort((a: any, b: any) => {
            const priority: Record<string, number> = { "connected": 3, "connecting": 2, "error": 0, "disconnected": 0 };
            return (priority[b.status] || 0) - (priority[a.status] || 0);
          });
          const activeAccount = sortedAccounts[0];
          
          setActiveAccount(activeAccount);
          if (activeAccount.status === "connecting") {
            setAccountId(activeAccount.id);
            setStep("connecting");
          } else if (activeAccount.status === "connected") {
            setAccountId(activeAccount.id);
            setStep("success");
          }
        }
      } catch (e) {
        // Ignore errors on mount
      }
    }
    checkExistingConnection();
  }, []);

  // Polling for account status (Runs during connection wait)
  useEffect(() => {
    if (step !== "connecting") return;
    const poll = setInterval(async () => {
      if (!accountId) return;
      try {
        const res = await fetch(`/api/hr/settings/linkedin-accounts?t=${Date.now()}`, { cache: 'no-store' });
        const { accounts } = await res.json();
        const account = accounts.find((a: any) => a.id === accountId);
        
        if (account) setActiveAccount(account);

        if (account?.status === "connected") {
          setStep("success");
          clearInterval(poll);
        } else if (account?.status === "error") {
          setStep("error");
          setErrorMessage(account.last_error);
          clearInterval(poll);
        }
      } catch (e) {
        console.error("Polling failed", e);
      }
    }, 3000);

    return () => clearInterval(poll);
  }, [step, accountId]);

  async function syncWithExtension() {
    setIsSyncingExtension(true);
    setErrorMessage(null);
    
    // On dispatch un event personnalisé que l'extension peut écouter
    const event = new CustomEvent("VERYTIS_LINKEDIN_SYNC_REQUEST");
    window.dispatchEvent(event);
    
    // Timeout si l'extension ne répond pas
    setTimeout(() => {
      if (isSyncingExtension) {
        setIsSyncingExtension(false);
        setErrorMessage("L'extension Verytis ne semble pas installée ou n'a pas répondu.");
      }
    }, 5000);
  }

  // Écouter la réponse de l'extension
  useEffect(() => {
    const handleResponse = async (event: any) => {
      if (event.detail?.cookie) {
        setIsSyncingExtension(false);
        setStep("connecting");
        try {
          const res = await fetch("/api/hr/settings/linkedin-sync", {
            method: "POST",
            body: JSON.stringify({ 
              cookie: event.detail.cookie,
              name: event.detail.name,
              image: event.detail.image
            }),
          });
          if (!res.ok) throw new Error("Échec de la synchronisation");
          setStep("success");
        } catch (e: any) {
          setStep("form");
          setErrorMessage(e.message);
        }
      }
    };
    window.addEventListener("VERYTIS_LINKEDIN_SYNC_RESPONSE", handleResponse);
    return () => window.removeEventListener("VERYTIS_LINKEDIN_SYNC_RESPONSE", handleResponse);
  }, []);

  async function handleRevoke() {
    if (!confirm("Voulez-vous vraiment délier votre compte LinkedIn ?")) return;
    try {
      const response = await fetch("/api/hr/settings/linkedin-sync", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Impossible de délier le compte");
      window.location.reload();
    } catch (caught) {
      console.error(caught);
    }
  }

  return (
    <div className="w-full">
      <div className="">
        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Button 
                onClick={syncWithExtension}
                disabled={isSyncingExtension}
                className="w-full h-14 gap-3 bg-pink-600 hover:bg-pink-700 text-white shadow-[0_8px_20px_rgba(219,39,119,0.2)] rounded-xl group transition-all"
              >
                {isSyncingExtension ? <Loader2 className="size-5 animate-spin" /> : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                    <rect width="4" height="12" x="2" y="9" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                )}
                <div className="text-left">
                  <div className="text-[15px] font-black">Se connecter via l&apos;extension</div>
                </div>
              </Button>

              {errorMessage && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-rose-600 text-sm mt-4">
                  <AlertCircle className="size-4 shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              )}
            </motion.div>
          )}

          {step === "connecting" && (
            <motion.div
              key="connecting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="py-12 flex flex-col items-center justify-center text-center space-y-6"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white border-2 border-primary shadow-lg">
                  <Loader2 className="size-10 text-primary animate-spin" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground/80 max-w-[280px] mx-auto mt-2">
                  {activeAccount?.status === "connecting" && activeAccount?.last_error 
                    ? activeAccount.last_error 
                    : "Sécurisation via proxy résidentiel..."}
                </p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div 
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                    className="size-1.5 rounded-full bg-primary"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-4 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="p-3 rounded-xl bg-secondary/5 border border-border inline-flex flex-col gap-1 items-center w-full">
                <div className="flex items-center gap-2 text-[10px] font-bold text-foreground/40 uppercase tracking-widest">
                  <Globe className="size-3" />
                  Tunnel Sécurisé
                </div>
                <div className="text-sm font-bold">
                  {activeAccount?.first_name ? `${activeAccount.first_name} ${activeAccount.last_name}` : (activeAccount?.email || "Compte synchronisé")}
                </div>
                <p className="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Proxy : {activeAccount?.preferred_city || "France"} ({activeAccount?.last_detected_ip || "Actif"})
                </p>
              </div>
              
              <Button 
                variant="ghost" 
                className="w-full text-rose-500 font-bold text-xs hover:bg-rose-50 hover:text-rose-600" 
                onClick={handleRevoke}
              >
                Se déconnecter
              </Button>
            </motion.div>
          )}

          {step === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 flex flex-col items-center justify-center text-center space-y-6"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                <AlertCircle className="size-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Erreur de Connexion</h3>
                <p className="text-sm text-foreground/50 max-w-[240px] mx-auto mt-2">
                  {errorMessage || "Une erreur est survenue lors de la tentative de connexion."}
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setStep("form")}>
                Réessayer
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
