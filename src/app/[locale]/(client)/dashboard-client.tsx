"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlowCommandBar } from "@/components/home/flow-command-bar";
import { useTranslations, useLocale } from "next-intl";
import { Sparkles, User, Brain } from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  thought?: string;
}

interface DashboardClientProps {
  applications?: any[];
}

export function DashboardClient({ applications = [] }: DashboardClientProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = async (text: string, flowId: string, contextId: string | null) => {
    const userMsg: Message = { id: Date.now().toString(), text, sender: "user" };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const response = await fetch("/api/hr/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, flowId, contextId, locale }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      
      const botMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        text: data.response, 
        thought: data.thought,
        sender: "bot" 
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        text: "I encountered an error while processing your request. Please try again.", 
        sender: "bot" 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const flows = [
    {
      id: "applications",
      display_name: "Applications",
      contextLabel: t("application"),
      placeholder: "Ask about candidates, scores or application status...",
      contexts: applications
        .filter(m => m.workflowType === "application")
        .map(m => ({
          id: m.id,
          name: m.title,
          status: m.status.toLowerCase() === "active" ? "active" : "paused"
        }))
    },
    {
      id: "sourcing",
      display_name: "Sourcing",
      contextLabel: t("sourcing"),
      placeholder: "Ask about sourced profiles, fit analysis or outreach...",
      contexts: applications
        .filter(m => m.workflowType === "sourcing")
        .map(m => ({
          id: m.id,
          name: m.title,
          status: m.status.toLowerCase() === "active" ? "active" : "paused"
        }))
    }
  ];

  return (
    <div className="relative flex flex-col h-screen w-full overflow-hidden">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 bg-background -z-20" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,#f0f9ff,transparent_70%)] opacity-60 -z-10" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_100%,#eef2ff,transparent_50%)] opacity-40 -z-10" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] brightness-0 pointer-events-none -z-10" />
      
      {/* Grid Pattern */}
      <div 
        className="fixed inset-0 opacity-[0.1] -z-10 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.05) 0.5px, transparent 0.5px)`,
          backgroundSize: '64px 64px'
        }}
      />

      {/* Chat History Area */}
      <div 
        ref={scrollRef}
        className="flex-1 w-full overflow-y-auto pt-10 pb-40 space-y-12 scroll-smooth no-scrollbar"
      >
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center pt-20"
            >
              <h1 className="text-3xl font-bold text-foreground mb-4 tracking-tight">{t("title")}</h1>
              <p className="text-foreground/30 text-sm max-w-sm text-center leading-relaxed">
                {t("subtitle")}
              </p>
            </motion.div>
          ) : (
            <>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`relative flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`absolute -inset-y-60 ${msg.sender === "user" ? "right-0" : "left-0"} w-2/3 z-0 pointer-events-none`}>
                    <motion.div
                      className="h-full w-full blur-[60px]"
                      animate={{
                        opacity: [0.2, 0.35, 0.2],
                      }}
                      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                      style={{
                        transform: 'translate3d(0,0,0)',
                        background: msg.sender === "user"
                          ? "radial-gradient(circle at 100% 50%, #db2777 0%, transparent 70%)"
                          : "radial-gradient(circle at 0% 50%, #7c3aed 0%, transparent 70%)"
                      }}
                    />
                  </div>

                  <div className="w-full max-w-5xl mx-auto px-6 flex flex-col items-center relative z-10">
                    <div className={`w-full flex gap-4 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Avatar */}
                      <div className={`shrink-0 size-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md border ${
                        msg.sender === "user" 
                          ? "bg-white/90 border-pink-500/20 text-pink-500" 
                          : "bg-white border-border"
                      }`}>
                        {msg.sender === "user" ? <User size={20} /> : (
                          <img src="/verytisLogo.svg" alt="Verytis Logo" className="size-6" />
                        )}
                      </div>

                      <div className={`max-w-[75%] flex flex-col gap-2 ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                        {msg.thought && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-xl border border-border/50 text-xs text-foreground/40 font-medium">
                            <Brain size={12} className="animate-pulse" />
                            {msg.thought}
                          </div>
                        )}
                        <div className={`
                          px-6 py-4 rounded-2xl text-[15px] leading-relaxed shadow-2xl backdrop-blur-sm border transition-all duration-300
                          ${msg.sender === "user" 
                            ? "bg-white/80 text-foreground rounded-tr-none border-pink-500/10 shadow-[0_10px_40_rgba(236,72,153,0.05)]" 
                            : "bg-white/80 text-foreground/80 rounded-tl-none border-violet-500/10 shadow-[0_10px_40_rgba(139,92,246,0.05)]"}
                        `}>
                          {msg.sender === "bot" ? (
                            <div className="space-y-1.5">
                              {msg.text.split("\n").map((line, i) => {
                                const isHeader = line.startsWith("#");
                                if (isHeader) {
                                  return (
                                    <h3 key={i} className="text-base font-bold text-indigo-600 mt-4 mb-2 first:mt-0 tracking-tight">
                                      {line.replace(/^#+\s*/, "")}
                                    </h3>
                                  );
                                }
                                return (
                                  <p key={i} className={line.startsWith("- ") ? "pl-4 list-item list-none" : ""}>
                                    {line.startsWith("- ") ? "• " : ""}
                                    {line.replace(/^- /, "").split(/(\*\*.*?\*\*)/g).map((part, j) => 
                                      part.startsWith("**") && part.endsWith("**") 
                                        ? <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
                                        : part
                                    )}
                                  </p>
                                );
                              })}
                            </div>
                          ) : msg.text}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {isThinking && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-5xl mx-auto px-6 flex flex-col items-center relative z-10"
                >
                  <div className="w-full flex gap-4">
                    <div className="shrink-0 size-10 rounded-full bg-white border border-border flex items-center justify-center shadow-lg">
                      <img src="/verytisLogo.svg" alt="Verytis Logo" className="size-6 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-xl border border-border/50 text-xs text-foreground/40 font-medium">
                      <Brain size={12} className="animate-pulse" />
                      {t("thinking")}
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </div>
      
      <div className="absolute bottom-8 left-0 right-0 pointer-events-none z-50">
        <FlowCommandBar initialFlows={flows} onSend={handleSend} />
      </div>
    </div>
  );
}
