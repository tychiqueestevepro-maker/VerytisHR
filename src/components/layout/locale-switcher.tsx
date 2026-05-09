"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLocale = () => {
    const nextLocale = locale === "en" ? "fr" : "en";
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLocale}
      className="flex items-center gap-2 text-foreground/60 transition hover:text-foreground"
    >
      <Globe className="size-4" />
      <span className="text-xs font-medium uppercase tracking-wider">
        {locale === "en" ? "Français" : "English"}
      </span>
    </Button>
  );
}
