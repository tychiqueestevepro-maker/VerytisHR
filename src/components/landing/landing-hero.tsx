"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Brain, Zap, BarChart3, Building2, Sparkles,
  Menu, X, Check, Lock, ChevronRight, ShieldCheck, FileText,
} from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5 },
  }),
};

/* ─────────────────────────────────────────────────
   Mini UI Mockups — each represents a real feature
───────────────────────────────────────────────── */

function IntegrityMockup() {
  const rows = [
    { field: "Title", cv: "Senior Dev", li: "Senior Dev", match: true },
    { field: "Company", cv: "TechCorp", li: "TechCorp SA", match: true },
    { field: "Period", cv: "2020–now", li: "2021–now", match: false },
    { field: "Location", cv: "Paris", li: "Remote", match: false },
  ];
  return (
    <div className="w-full h-full bg-[#080e1a] rounded-xl p-4 flex flex-col gap-2 font-mono">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-slate-600 uppercase tracking-widest">Verification Report</span>
        <span className="text-[8px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">2 discrepancies</span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-[8px] text-slate-700 mb-1">
        <span>Field</span><span className="text-center">CV</span><span className="text-center">LinkedIn</span>
      </div>
      {rows.map((r) => (
        <div key={r.field} className={`grid grid-cols-3 gap-1 rounded-md px-2 py-1.5 border text-[8px] ${r.match ? "bg-white/[0.02] border-white/[0.04]" : "bg-red-500/[0.06] border-red-500/20"}`}>
          <span className="text-slate-500">{r.field}</span>
          <span className={`text-center truncate ${r.match ? "text-slate-400" : "text-red-300"}`}>{r.cv}</span>
          <span className={`text-center truncate ${r.match ? "text-slate-400" : "text-red-300"}`}>{r.li}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <ShieldCheck className="size-3 text-indigo-400 flex-shrink-0" />
        <span className="text-[8px] text-slate-500">Trust Score: <span className="text-indigo-300 font-bold">72%</span></span>
      </div>
    </div>
  );
}

function PipelineMockup() {
  const questions = [
    { type: "Scenario", label: "Q1 · Scenario", color: "text-indigo-300 bg-indigo-500/10 border-indigo-500/20", timer: "5min" },
    { type: "MCQ", label: "Q2 · Multiple choice", color: "text-violet-300 bg-violet-500/10 border-violet-500/20", timer: "90s" },
    { type: "Written", label: "Q3 · Written answer", color: "text-amber-300 bg-amber-500/10 border-amber-500/20", timer: "10min" },
    { type: "File", label: "Q4 · File upload", color: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20", timer: null },
  ];
  return (
    <div className="w-full h-full bg-[#080e1a] rounded-xl p-4 flex flex-col gap-2 font-mono">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-slate-600 uppercase tracking-widest">Pipeline · Senior Engineer</span>
        <span className="text-[8px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Zap className="size-2" /> AI generated
        </span>
      </div>
      {questions.map((q) => (
        <div key={q.label} className={`flex items-center justify-between rounded-md px-2.5 py-1.5 border text-[8px] ${q.color}`}>
          <span>{q.label}</span>
          {q.timer && <span className="text-[7px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded">{q.timer}</span>}
        </div>
      ))}
      <div className="flex items-center gap-1.5 mt-auto pt-1 text-[8px] text-slate-600">
        <ShieldCheck className="size-3 text-slate-700" />
        Anti-cheat: <span className="text-slate-500">Medium</span>
      </div>
    </div>
  );
}

function ScoringMockup() {
  const scores = [
    { label: "Fit Score", value: 88, color: "from-indigo-500 to-indigo-400", desc: "vs. mission" },
    { label: "Trust Score", value: 72, color: "from-amber-500 to-amber-400", desc: "LinkedIn verified" },
    { label: "Opportunity", value: 91, color: "from-green-500 to-emerald-400", desc: "open to contact" },
  ];
  return (
    <div className="w-full h-full bg-[#080e1a] rounded-xl p-4 flex flex-col gap-3 font-mono">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-slate-600 uppercase tracking-widest">Candidate Scores</span>
        <span className="text-[8px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">Contact first</span>
      </div>
      {scores.map((s) => (
        <div key={s.label}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-[8px] text-slate-400 font-semibold">{s.label}</span>
              <span className="text-[7px] text-slate-700 ml-1.5">{s.desc}</span>
            </div>
            <span className="text-[9px] text-white font-black">{s.value}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r ${s.color} rounded-full`} style={{ width: `${s.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CompanyMockup() {
  const signals = [
    { emoji: "🟢", text: "Series B raised — $12M · 3 days ago", positive: true },
    { emoji: "🔴", text: "Layoffs announced — 15% workforce", positive: false },
    { emoji: "🟢", text: "Hiring surge · +40 roles opened", positive: true },
  ];
  return (
    <div className="w-full h-full bg-[#080e1a] rounded-xl p-4 flex flex-col gap-2 font-mono">
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="size-3.5 text-slate-600" />
        <span className="text-[9px] text-slate-600 uppercase tracking-widest">Company Intelligence</span>
      </div>
      <div className="bg-white/[0.03] rounded-lg p-2 border border-white/[0.05] mb-1">
        <div className="text-[9px] text-white font-semibold">TechCorp SA</div>
        <div className="text-[8px] text-slate-500">SaaS · 200–500 employees · Paris</div>
      </div>
      {signals.map((s, i) => (
        <div key={i} className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 border text-[8px] ${s.positive ? "bg-green-500/[0.05] border-green-500/15 text-green-300/80" : "bg-red-500/[0.05] border-red-500/15 text-red-300/80"}`}>
          <span className="text-[9px] leading-none mt-px">{s.emoji}</span>
          <span>{s.text}</span>
        </div>
      ))}
    </div>
  );
}

function CockpitMockup() {
  return (
    <div className="w-full h-full bg-[#080e1a] rounded-xl p-4 flex flex-col gap-2 font-mono">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="size-3.5 text-indigo-400" />
        <span className="text-[9px] text-slate-600 uppercase tracking-widest">Recruitment Cockpit</span>
      </div>
      <div className="space-y-2 flex-1">
        <div className="flex gap-2">
          <div className="size-5 rounded-full bg-indigo-500/20 flex-shrink-0 flex items-center justify-center">
            <Sparkles className="size-2.5 text-indigo-400" />
          </div>
          <div className="bg-white/[0.04] rounded-lg rounded-tl-none p-2 text-[8px] text-slate-400 leading-relaxed flex-1">
            3 candidates ready to contact. Sarah Kim leads with 88% Fit and 91% Opportunity.
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <div className="bg-indigo-500/15 rounded-lg rounded-tr-none p-2 text-[8px] text-indigo-300 border border-indigo-500/20">
            Why is her Trust Score only 72%?
          </div>
        </div>
        <div className="flex gap-2">
          <div className="size-5 rounded-full bg-indigo-500/20 flex-shrink-0 flex items-center justify-center">
            <Sparkles className="size-2.5 text-indigo-400" />
          </div>
          <div className="bg-white/[0.04] rounded-lg rounded-tl-none p-2 text-[8px] text-slate-400 leading-relaxed flex-1">
            Her employment period differs by 1 year between CV and LinkedIn.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg p-2 border border-white/[0.06]">
        <div className="flex-1 text-[8px] text-slate-700">Ask anything about your pipeline...</div>
        <div className="size-4 rounded bg-indigo-500/40 flex items-center justify-center">
          <ArrowRight className="size-2.5 text-indigo-400" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────── */

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "CV × LinkedIn Cross-check",
    desc: "Automatically detect discrepancies between a candidate's CV and their LinkedIn profile. Every verification produces a Trust Score and flags inconsistencies precisely.",
    tag: "LinkedIn Verified",
    tagColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    mockup: <IntegrityMockup />,
  },
  {
    icon: Zap,
    title: "AI Assessment Pipelines",
    desc: "Generate role-specific screening questions in seconds: scenario-based, MCQ, written answers, file uploads, and time-limited exercises — with configurable anti-cheat measures.",
    tag: "AI Generated",
    tagColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    mockup: <PipelineMockup />,
  },
  {
    icon: BarChart3,
    title: "3-Axis Candidate Scoring",
    desc: "Every profile is scored on three axes: Fit (match vs. mission), Trust (data reliability from LinkedIn), and Opportunity (likelihood the candidate is open to contact). Clear ranking, no gut feel.",
    tag: "Fit · Trust · Opportunity",
    tagColor: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    mockup: <ScoringMockup />,
  },
  {
    icon: Building2,
    title: "Company Intelligence",
    desc: "Automated research on each candidate's current employer — funding news, layoffs, growth signals — so you know exactly when and why to reach out.",
    tag: "Powered by Tavily",
    tagColor: "text-green-400 bg-green-500/10 border-green-500/20",
    mockup: <CompanyMockup />,
  },
  {
    icon: Sparkles,
    title: "Recruitment Cockpit",
    desc: "A conversational AI interface to query your pipeline in real time. Ask who to contact first, get pipeline health summaries, and receive strategic hiring recommendations.",
    tag: "Conversational AI",
    tagColor: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
    mockup: <CockpitMockup />,
  },
];

export function LandingHero() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const play = async () => { try { await video.play(); } catch {} };
    if (video.readyState >= 2) play();
    else video.addEventListener("loadeddata", play);
    return () => video.removeEventListener("loadeddata", play);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#030712] text-white overflow-x-hidden selection:bg-indigo-500/30">

      {/* ─── Navbar ─── */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 pt-6 pointer-events-none">
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`
            pointer-events-auto mx-auto w-full transition-all duration-500 ease-in-out
            backdrop-blur-xl border rounded-full flex items-center justify-between
            ${scrolled
              ? "max-w-[750px] bg-white/80 border-pink-500/20 shadow-[0_8px_32px_-6px_rgba(236,72,153,0.15)] px-3 py-1.5"
              : "max-w-[1050px] bg-white/40 border-black/[0.05] shadow-sm px-4 py-2"
            }
          `}
        >
          <div className="flex-1 flex justify-start pl-2">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="size-8 rounded-full bg-gradient-to-tr from-pink-500 to-violet-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg shadow-pink-500/20">
                <img src="/verytisLogo.svg" alt="" className="h-4 w-auto invert" />
              </div>
              <span className="text-sm font-bold tracking-tight hidden sm:block bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">Verytis</span>
            </Link>
          </div>
          <div className={`
            hidden md:flex items-center rounded-full transition-all duration-500
            ${scrolled ? "gap-6 px-5 py-1 bg-pink-50/50 border-pink-100/50" : "gap-8 px-6 py-1.5 bg-black/[0.03] border-black/[0.02]"}
            border
          `}>
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`text-[12px] font-semibold uppercase tracking-wider transition-colors
                  ${scrolled ? "text-pink-900/60 hover:text-pink-600" : "text-black/50 hover:text-black"}`}
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex-1 flex justify-end items-center gap-3 pr-2">
            <Link href="/login" className="hidden sm:block text-[13px] font-medium text-black/60 hover:text-pink-600 transition-colors px-4">
              Login
            </Link>
            <Link href="/signup" className="text-[13px] font-bold text-white bg-gradient-to-r from-pink-500 to-violet-600 px-5 py-2.5 rounded-full hover:shadow-lg hover:shadow-pink-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-black/5">
              Sign Up
            </Link>
            <button className="md:hidden p-2 text-black/60 hover:text-black" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="size-5" />
            </button>
          </div>
        </motion.nav>
      </div>

      {/* ─── Mobile Menu ─── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col h-full px-6 pt-10">
              <div className="flex items-center justify-between mb-12">
                <Link href="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <img src="/verytisLogo.svg" alt="Verytis" className="h-6 w-auto" />
                  <span className="text-lg font-bold text-black">Verytis</span>
                </Link>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2">
                  <X className="size-6 text-black" />
                </button>
              </div>
              <nav className="flex flex-col gap-8">
                {NAV_LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-2xl font-bold text-black/40 hover:text-black transition-colors"
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
              <div className="mt-auto pb-12 flex flex-col gap-4">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full text-center py-4 text-lg font-medium border border-black/10 rounded-2xl text-black">
                  Login
                </Link>
                <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="w-full text-center py-4 text-lg font-bold text-white bg-[#0f172a] rounded-2xl">
                  Sign Up
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════ */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-36 pb-28 overflow-hidden min-h-screen">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)
            `,
            backgroundSize: "72px 72px",
          }}
        />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,transparent_40%,#030712_100%)]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full bg-indigo-600/[0.07] blur-[140px] pointer-events-none" />
        <div className="absolute top-16 right-1/3 w-[350px] h-[350px] rounded-full bg-violet-600/[0.05] blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-indigo-500/[0.04] blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto w-full text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.07] mb-12"
          >
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-green-400" />
            </span>
            <span className="text-[12px] font-medium text-indigo-300/90">Now in beta · Free to join</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-[clamp(2.8rem,8.5vw,6.5rem)] font-black tracking-tighter leading-[0.9] mb-8 text-white"
          >
            Verify every candidate.<br />Hire with confidence.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            Verytis cross-checks CVs against LinkedIn, scores each profile on Fit, Trust and Opportunity, and builds custom assessment pipelines — all in one AI-powered platform.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-3 mb-12"
          >
            <Link
              href="/beta-request"
              className="group inline-flex items-center gap-2 bg-white text-[#030712] px-7 py-3.5 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all shadow-lg shadow-black/30"
            >
              Join the Beta
              <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white px-7 py-3.5 rounded-xl border border-white/[0.08] hover:border-white/[0.18] transition-all"
            >
              Login
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-600"
          >
            {["No credit card required", "200 AI credits free", "2 active missions included"].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <Check className="size-3 text-indigo-500" />
                <span>{item}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Video — browser frame */}
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5 }}
          className="relative z-10 w-full max-w-5xl mx-auto mt-20"
        >
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-indigo-600/10 blur-3xl pointer-events-none" />
          <div className="rounded-2xl overflow-hidden border border-white/[0.07] shadow-2xl shadow-black/60">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#0d1117] border-b border-white/[0.05]">
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full bg-red-500/60" />
                <div className="size-3 rounded-full bg-yellow-500/60" />
                <div className="size-3 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 mx-4">
                <div className="max-w-[240px] mx-auto h-6 bg-white/[0.04] rounded border border-white/[0.05] flex items-center justify-center">
                  <span className="text-[10px] text-slate-600 font-mono">app.verytis.co/dashboard</span>
                </div>
              </div>
            </div>
            <div className="aspect-video bg-[#07090f]">
              <video
                ref={videoRef}
                autoPlay muted loop playsInline preload="auto"
                src="/hero-video.mp4"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════
          STATS BAR
      ═══════════════════════════════════════════════ */}
      <section className="border-y border-white/[0.05] py-14 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10">
          {[
            { value: "1 credit", label: "per LinkedIn verification" },
            { value: "3 credits", label: "per pipeline generation" },
            { value: "200", label: "credits free in beta" },
            { value: "2", label: "active missions included" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-center"
            >
              <div className="text-2xl md:text-3xl font-black mb-1 bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-violet-300">
                {stat.value}
              </div>
              <div className="text-xs text-slate-600 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-20">
            <motion.p variants={fadeUp} custom={0} className="text-[10px] font-mono uppercase tracking-[0.3em] text-indigo-500 mb-4">
              How it works
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-5xl font-black tracking-tighter text-white">
              Two workflows, one platform
            </motion.h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Applications */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 hover:border-white/[0.1] transition-colors duration-300"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="size-9 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
                  <FileText className="size-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Applications</h3>
                  <p className="text-[10px] text-slate-600">CV parsing · Pipeline generation · Scoring</p>
                </div>
              </div>
              <div className="space-y-0">
                {[
                  { num: "01", title: "Configure your mission", desc: "Define the role, requirements, and evaluation criteria. Verytis structures everything for the AI." },
                  { num: "02", title: "AI generates the pipeline", desc: "Get a tailored assessment in seconds: scenario questions, MCQ, written answers, file uploads — with anti-cheat and time limits." },
                  { num: "03", title: "Automatic scoring", desc: "Each submission is scored across CV parsing, pipeline responses, and LinkedIn cross-check — no manual review needed." },
                ].map((step) => (
                  <div key={step.num} className="flex gap-4 py-5 border-b border-white/[0.04] last:border-0 last:pb-0">
                    <span className="text-xs font-mono text-indigo-700 mt-0.5 w-6 flex-shrink-0">{step.num}</span>
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-1">{step.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Sourcing */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 hover:border-white/[0.1] transition-colors duration-300"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="size-9 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                  <Brain className="size-4 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Sourcing</h3>
                  <p className="text-[10px] text-slate-600">Apollo · Lusha · LinkedIn · Tavily</p>
                </div>
              </div>
              <div className="space-y-0">
                {[
                  { num: "01", title: "Import your lists", desc: "Bring in profiles from Apollo, Lusha, or your own CSV files in one click." },
                  { num: "02", title: "AI analysis + LinkedIn verification", desc: "Each profile is scored on Fit, Trust, and Opportunity. LinkedIn data is cross-checked. Company news is pulled automatically." },
                  { num: "03", title: "Ranked recommendations", desc: "Know who to contact first, and why — based on signals, market context, and your mission criteria." },
                ].map((step) => (
                  <div key={step.num} className="flex gap-4 py-5 border-b border-white/[0.04] last:border-0 last:pb-0">
                    <span className="text-xs font-mono text-violet-700 mt-0.5 w-6 flex-shrink-0">{step.num}</span>
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-1">{step.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FEATURES
      ═══════════════════════════════════════════════ */}
      <section id="features" className="py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-20">
            <motion.p variants={fadeUp} custom={0} className="text-[10px] font-mono uppercase tracking-[0.3em] text-indigo-500 mb-4">
              Features
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-6">
              Everything you need to hire right
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-slate-400 max-w-xl mx-auto">
              From sourcing to final decision — every step powered by AI.
            </motion.p>
          </motion.div>

          <div className="space-y-5">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="grid md:grid-cols-2 bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.11] transition-colors duration-300"
              >
                <div className={`p-10 flex flex-col justify-center ${i % 2 === 1 ? "md:order-2" : ""}`}>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider mb-6 w-fit ${feature.tagColor}`}>
                    {feature.tag}
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <feature.icon className="size-5 text-white/30" />
                    <h3 className="text-2xl font-black tracking-tight text-white">{feature.title}</h3>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-sm max-w-sm">{feature.desc}</p>
                </div>
                <div className={`
                  p-6 flex items-center justify-center min-h-[220px] bg-[#04070f]
                  border-t md:border-t-0 border-white/[0.04]
                  ${i % 2 === 1 ? "md:border-r md:order-1" : "md:border-l"}
                `}>
                  <div className="w-full max-w-xs h-44">
                    {feature.mockup}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PRICING
      ═══════════════════════════════════════════════ */}
      <section id="pricing" className="py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <motion.p variants={fadeUp} custom={0} className="text-[10px] font-mono uppercase tracking-[0.3em] text-indigo-500 mb-4">
              Pricing
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-4">
              Start free, scale when ready
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-slate-400 max-w-sm mx-auto">
              200 credits included. No credit card needed.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Beta Access */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative bg-white/[0.03] border border-indigo-500/25 rounded-2xl p-8 ring-1 ring-indigo-500/15"
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <div className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-[10px] font-bold px-4 py-1 rounded-full tracking-wider uppercase whitespace-nowrap">
                  Available now
                </div>
              </div>
              <div className="pt-3">
                <p className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest mb-4">Beta Access</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black text-white">0€</span>
                  <span className="text-slate-500 text-sm">/month</span>
                </div>
                <p className="text-slate-500 text-sm mb-8">Everything you need to test Verytis end-to-end</p>
                <div className="space-y-3 mb-8">
                  {[
                    { label: "200 AI credits / month", sub: "1 credit per analysis or verification" },
                    { label: "1 recruiter seat" },
                    { label: "2 active missions", sub: "sourcing + applications" },
                    { label: "50 LinkedIn verifications / month" },
                    { label: "50 sourcing analyses / month" },
                    { label: "4 pipeline generations / month", sub: "3 credits each" },
                    { label: "75 CV parses / month" },
                    { label: "20 company researches / month" },
                  ].map((f) => (
                    <div key={f.label} className="flex items-start gap-3">
                      <Check className="size-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm text-slate-300">{f.label}</div>
                        {f.sub && <div className="text-[10px] text-slate-600 mt-0.5">{f.sub}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href="/beta-request"
                  className="block w-full text-center text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3.5 rounded-xl hover:shadow-lg hover:shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Join the Beta
                </Link>
              </div>
            </motion.div>

            {/* Pro */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-white/[0.015] border border-white/[0.05] rounded-2xl p-8 opacity-50"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Pro</p>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  <Lock className="size-3 text-slate-600" />
                  <span className="text-[10px] text-slate-600 font-medium">Coming soon</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black text-white/40">—</span>
              </div>
              <p className="text-slate-700 text-sm mb-8">For growing recruitment teams</p>
              <div className="space-y-3 mb-8">
                {[
                  "Unlimited active missions",
                  "Multiple recruiter seats",
                  "Higher monthly credit caps",
                  "Advanced sourcing analytics",
                  "Priority support",
                ].map((f) => (
                  <div key={f} className="flex items-start gap-3 text-sm text-slate-700">
                    <Check className="size-4 text-slate-700 mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button disabled className="block w-full text-center text-sm font-bold text-slate-700 bg-white/[0.03] border border-white/[0.05] px-6 py-3.5 rounded-xl cursor-not-allowed">
                Coming soon
              </button>
            </motion.div>

            {/* Enterprise */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white/[0.015] border border-white/[0.05] rounded-2xl p-8 opacity-50"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Enterprise</p>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  <Lock className="size-3 text-slate-600" />
                  <span className="text-[10px] text-slate-600 font-medium">Coming soon</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black text-white/40">Custom</span>
              </div>
              <p className="text-slate-700 text-sm mb-8">For large organizations and agencies</p>
              <div className="space-y-3 mb-8">
                {[
                  "Unlimited everything",
                  "Custom credit packages",
                  "White-label option",
                  "Dedicated account manager",
                  "SLA & custom integrations",
                ].map((f) => (
                  <div key={f} className="flex items-start gap-3 text-sm text-slate-700">
                    <Check className="size-4 text-slate-700 mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button disabled className="block w-full text-center text-sm font-bold text-slate-700 bg-white/[0.03] border border-white/[0.05] px-6 py-3.5 rounded-xl cursor-not-allowed">
                Coming soon
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl mx-auto relative rounded-3xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-700" />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.12),transparent_60%)]" />
          <div className="relative z-10 text-center py-20 px-8">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-4">
              Ready to hire with confidence?
            </h2>
            <p className="text-base text-indigo-100/60 max-w-md mx-auto mb-10">
              200 free credits. No credit card. Start verifying candidates in minutes.
            </p>
            <Link
              href="/beta-request"
              className="group inline-flex items-center gap-2.5 text-sm font-bold bg-white text-indigo-700 px-8 py-4 rounded-xl hover:bg-indigo-50 transition-all shadow-xl shadow-indigo-900/30"
            >
              Join the Beta
              <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════ */}
      <footer className="border-t border-white/[0.05] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center">
              <img src="/verytisLogo.svg" alt="" className="h-3 w-auto invert" />
            </div>
            <span className="text-sm font-semibold text-white/25">Verytis</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/20">
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white/50 transition-colors">Terms of Service</Link>
            <Link href="/mentions-legales" className="hover:text-white/50 transition-colors">Mentions légales</Link>
          </div>
          <p className="text-xs text-white/20">
            © {new Date().getFullYear()} Verytis. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
