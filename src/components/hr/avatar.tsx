"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  initials?: string;
}

export function Avatar({ src, name, size = "md", initials }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const sizeClasses = {
    sm: "size-8 text-[10px]",
    md: "size-10 text-xs",
    lg: "size-14 text-sm"
  };

  const isAlreadyProxied = src?.startsWith("/api/media/proxy");
  const proxiedSrc = src && !failed ? (src.startsWith("http") && !isAlreadyProxied ? `/api/media/proxy?url=${encodeURIComponent(src)}` : src) : null;
  const displayInitials = initials || name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn(
      "flex items-center justify-center overflow-hidden rounded-full border border-white/60 bg-white/40 shadow-sm backdrop-blur-md transition-transform hover:scale-105",
      sizeClasses[size]
    )}>
      {proxiedSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img 
          src={proxiedSrc} 
          alt={name} 
          className="size-full object-cover" 
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-black tracking-widest text-foreground/30">{displayInitials || "?"}</span>
      )}
    </div>
  );
}
