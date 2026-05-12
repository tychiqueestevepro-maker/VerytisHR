"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

const COOKIE_KEY = "verytis_cookie_consent";

export function CookieBanner() {
  const t = useTranslations("CookieBanner");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(COOKIE_KEY, "declined");
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-5 right-5 z-50 w-80 rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur-md"
        >
          <button
            onClick={decline}
            aria-label={t("dismiss")}
            className="absolute right-3 top-3 rounded-md p-1 text-zinc-500 transition-colors hover:text-white"
          >
            <X className="size-4" />
          </button>

          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/20">
              <Cookie className="size-4 text-indigo-400" />
            </span>
            <p className="text-sm font-semibold text-white">{t("title")}</p>
          </div>

          <p className="mb-4 text-xs leading-relaxed text-zinc-400">
            {t("description")}{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-white"
            >
              {t("privacy_link")}
            </Link>
            .
          </p>

          <div className="flex gap-2">
            <button
              onClick={decline}
              className="flex-1 rounded-lg border border-white/10 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
            >
              {t("decline")}
            </button>
            <button
              onClick={accept}
              className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
            >
              {t("accept")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
