"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const setupSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Mot de passe trop court"),
});




type SetupFormValues = z.infer<typeof setupSchema>;

export function LinkedinSecureSetup() {
  const [step, setStep] = useState<"form" | "connecting" | "2fa" | "success" | "error">("form");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [challengeHint, setChallengeHint] = useState<string | null>(null);
  const [challengeType, setChallengeType] = useState<"email_code" | "sms_code" | "app_push" | null>(null);
  const [activeAccount, setActiveAccount] = useState<any>(null);

  const form = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      email: "",
      password: "",
    },


  });

  // Restore state on mount if a connection is already in progress
  useEffect(() => {
    async function checkExistingConnection() {
      try {
        const res = await fetch(`/api/hr/settings/linkedin-accounts?t=${Date.now()}`, { cache: 'no-store' });
        const { accounts } = await res.json();
        if (accounts && accounts.length > 0) {
          // Priority to active/connected accounts
          const sortedAccounts = [...accounts].sort((a: any, b: any) => {
            const priority: Record<string, number> = { "connected": 3, "connecting": 2, "challenge_pending": 1, "error": 0, "disconnected": 0 };
            return (priority[b.status] || 0) - (priority[a.status] || 0);
          });
          const activeAccount = sortedAccounts[0];
          
          setActiveAccount(activeAccount);
          if (activeAccount.status === "connecting") {
            setAccountId(activeAccount.id);
            setStep("connecting");
          } else if (activeAccount.status === "challenge_pending") {
            setAccountId(activeAccount.id);
            setStep("2fa");
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


  // Fetch challenge hint when 2FA step is reached
  useEffect(() => {
    if (step !== "2fa" || !accountId) return;
    let cancelled = false;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/hr/settings/linkedin-accounts/${accountId}/challenge?t=${Date.now()}`, { cache: 'no-store' });
        const { challenge } = await res.json();
        if (cancelled) return;
        if (challenge?.id) setChallengeId(challenge.id);
        if (challenge?.challenge_hint) {
          setChallengeHint(challenge.challenge_hint);
          // Don't clear poll if we still need the ID for fallback
        }
        if (challenge?.challenge_type) setChallengeType(challenge.challenge_type);
      } catch { /* ignore */ }
    }, 2000);
    return () => { cancelled = true; clearInterval(poll); };
  }, [step, accountId]);

  // Polling for account status (Runs during connection and 2FA wait)
  useEffect(() => {
    if (step !== "connecting" && step !== "2fa") return;
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
        } else if (account?.status === "challenge_pending") {
          setStep("2fa");
          // NE PAS faire clearInterval ici, sinon l'UI arrête d'écouter la fin du processus !
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

  async function onSubmit(values: SetupFormValues) {
    setStep("connecting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/hr/settings/linkedin-accounts", {
        method: "POST",
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),


      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la configuration");

      setAccountId(data.account.id);
    } catch (e: any) {
      setStep("form");
      setErrorMessage(e.message);
    }
  }

  async function handleFallbackToEmail() {
    if (!challengeId) return;
    try {
      await fetch("/api/hr/settings/linkedin-sync", {
        method: "POST",
        body: JSON.stringify({ 
          action: "fallback_to_email",
          challengeId: challengeId 
        }),
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function submit2FA() {
    if (!twoFactorCode || !accountId) return;
    setStep("connecting");
    try {
      const res = await fetch(`/api/hr/settings/linkedin-accounts/${accountId}/challenge`, {
        method: "POST",
        body: JSON.stringify({ code: twoFactorCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Code invalide");
      
      // The polling will pick up the "connected" status
    } catch (e: any) {
      setStep("2fa");
      setErrorMessage(e.message);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
      <div className="p-8">
        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="size-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Connexion Sécurisée</h3>
                  <p className="text-sm text-foreground/50">Liez votre compte LinkedIn professionnel.</p>
                </div>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground/40 px-1">Email LinkedIn</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 size-4 text-foreground/20" />
                    <Input 
                      {...form.register("email")}
                      placeholder="email@linkedin.com" 
                      className="pl-10 h-11 bg-secondary/5 border-border focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground/40 px-1">Mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 size-4 text-foreground/20" />
                    <Input 
                      {...form.register("password")}
                      type="password"
                      placeholder="••••••••" 
                      className="pl-10 h-11 bg-secondary/5 border-border focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex gap-3">

                  <ShieldCheck className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-bold text-emerald-800">Sécurisé par Verytis</p>
                    <p className="text-[11px] text-emerald-700/70 leading-relaxed">
                      Connexion via nos serveurs résidentiels locaux. Aucune configuration requise.
                    </p>
                  </div>
                </div>

                {errorMessage && (
                  <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-rose-600 text-sm">
                    <AlertCircle className="size-4 shrink-0" />
                    <p>{errorMessage}</p>
                  </div>
                )}

                <Button type="submit" className="w-full h-11 gap-2 bg-foreground text-background hover:bg-foreground/90 transition-all group">
                  Démarrer la connexion
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </form>
            </motion.div>
          )}

          {(step === "connecting") && (
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

          {step === "2fa" && (
            <motion.div
              key="2fa"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <ShieldCheck className="size-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Double Authentification</h3>
                  <p className="text-sm text-foreground/50">LinkedIn demande un code de vérification.</p>
                </div>
              </div>

              {challengeType === "app_push" ? (
                <>
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex gap-3">
                    <ShieldCheck className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-700 leading-6">
                      Ouvrez votre app <span className="font-semibold">LinkedIn</span> et appuyez sur <span className="font-semibold">Oui</span> pour confirmer la connexion.
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 py-4">
                    <Loader2 className="size-8 text-amber-500 animate-spin" />
                    <p className="text-sm text-foreground/50">En attente de confirmation dans l&apos;app…</p>
                    <button 
                      onClick={() => handleFallbackToEmail()}
                      className="text-[12px] text-primary hover:underline mt-4 font-medium"
                    >
                      Je n'ai pas reçu la notification (Utiliser un code Email)
                    </button>
                  </div>
                  <Button variant="ghost" className="w-full text-xs text-foreground/40 hover:bg-transparent" onClick={() => setStep("form")}>
                    Annuler et recommencer
                  </Button>
                </>
              ) : (
                <>
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex gap-3">
                    <Mail className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-700 leading-6">
                      {challengeHint ? (
                        <>Code envoyé{challengeType === "sms_code" ? " par SMS" : " par email"} à <span className="font-mono font-semibold">{challengeHint}</span></>
                      ) : (
                        <>Vérifiez vos {challengeType === "sms_code" ? "SMS" : "emails"} pour le code LinkedIn.</>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Input
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      placeholder="Code de vérification"
                      className="text-center text-2xl tracking-[0.5em] font-mono h-16 bg-secondary/5 border-border focus:ring-amber-500"
                    />
                    {errorMessage && (
                      <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-rose-600 text-sm">
                        <AlertCircle className="size-4 shrink-0" />
                        <p>{errorMessage}</p>
                      </div>
                    )}
                    <Button onClick={submit2FA} className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white">
                      Valider le code
                    </Button>
                    <Button variant="ghost" className="w-full text-xs text-foreground/40 hover:bg-transparent" onClick={() => setStep("form")}>
                      Annuler et recommencer
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 flex flex-col items-center justify-center text-center space-y-6"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <CheckCircle2 className="size-10" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Compte Connecté !</h3>
                <div className="mt-4 p-3 rounded-lg bg-secondary/5 border border-border inline-flex flex-col gap-1 items-center w-full">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-foreground/40 uppercase tracking-widest">
                    <Globe className="size-3" />
                    Tunnel Sécurisé
                  </div>
                  <div className="text-sm font-medium">
                    {activeAccount?.first_name ? `${activeAccount.first_name} ${activeAccount.last_name}` : activeAccount?.email}
                  </div>
                  <p className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                    Proxy : {activeAccount?.preferred_city || "France"} ({activeAccount?.last_detected_ip || "Actif"})
                  </p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
                Terminer
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

      <div className="bg-secondary/10 border-t border-border p-6 flex gap-3">
        <RefreshCw className="size-4 text-foreground/30 shrink-0 mt-1" />
        <p className="text-[11px] leading-5 text-foreground/50">
          Cette session restera active indéfiniment grâce à notre système de heartbeat quotidien. 
          Vous n'aurez plus besoin de synchroniser manuellement via l'extension.
        </p>
      </div>
    </div>
  );
}
