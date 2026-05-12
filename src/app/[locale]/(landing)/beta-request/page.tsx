"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Send, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function BetaRequestPage() {
  const t = useTranslations("BetaRequest");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get("email"),
      phone: formData.get("phone"),
      company: formData.get("company"),
      position: formData.get("position"),
    };

    try {
      const res = await fetch("/api/beta-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to submit");
      
      setSuccess(true);
    } catch (err) {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[2.5rem] p-12 text-center shadow-2xl shadow-black/[0.03] border border-black/[0.03]"
        >
          <div className="size-20 rounded-3xl bg-emerald-50 flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="size-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-black mb-4 tracking-tight">{t("success_title")}</h1>
          <p className="text-gray-500 leading-relaxed mb-10 font-medium">
            {t("success_message")}
          </p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 hover:text-violet-600 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Home
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white rounded-[2.5rem] p-12 shadow-2xl shadow-black/[0.03] border border-black/[0.03]"
      >
        <div className="mb-10">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-violet-600 transition-colors mb-8"
          >
            <ArrowLeft className="size-3" />
            BACK
          </Link>
          <h1 className="text-4xl font-black mb-4 tracking-tight">{t("title")}</h1>
          <p className="text-gray-500 leading-relaxed font-medium">
            {t("subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">
              {t("email_label")}
            </label>
            <input
              required
              name="email"
              type="email"
              placeholder="alex@company.com"
              className="w-full h-14 px-6 rounded-2xl bg-gray-50 border border-black/[0.03] focus:border-violet-500/50 focus:bg-white outline-none transition-all font-medium text-gray-900"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">
                {t("phone_label")}
              </label>
              <input
                required
                name="phone"
                type="tel"
                placeholder="+33 6 ..."
                className="w-full h-14 px-6 rounded-2xl bg-gray-50 border border-black/[0.03] focus:border-violet-500/50 focus:bg-white outline-none transition-all font-medium text-gray-900"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">
                {t("company_label")}
              </label>
              <input
                required
                name="company"
                type="text"
                placeholder="Google, Inc."
                className="w-full h-14 px-6 rounded-2xl bg-gray-50 border border-black/[0.03] focus:border-violet-500/50 focus:bg-white outline-none transition-all font-medium text-gray-900"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">
              {t("position_label")}
            </label>
            <input
              required
              name="position"
              type="text"
              placeholder="Head of Talent Acquisition"
              className="w-full h-14 px-6 rounded-2xl bg-gray-50 border border-black/[0.03] focus:border-violet-500/50 focus:bg-white outline-none transition-all font-medium text-gray-900"
            />
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 text-red-600 text-sm font-medium border border-red-100">
              <AlertCircle className="size-5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-gray-900 text-white font-bold flex items-center justify-center gap-3 hover:shadow-2xl hover:shadow-black/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading ? (
              <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {t("submit")}
                <Send className="size-4" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
