"use client";

import { useState } from "react";
import { User, Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { SectionBlock, Avatar } from "./application-components";
import { cn } from "@/lib/utils";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export function MissionManagerForm({
  applicationId,
  currentManagerId,
  team,
}: {
  applicationId: string;
  currentManagerId: string | null;
  team: TeamMember[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const currentManager = team.find((m) => m.id === currentManagerId) || null;

  async function handleSelect(userId: string) {
    if (userId === currentManagerId) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/hr/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ created_by: userId }),
      });

      if (!response.ok) {
        throw new Error("Failed to update manager");
      }

      router.refresh();
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      alert("Error updating mission manager");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <SectionBlock title="Transfer ownership" icon={User}>
      <div className="relative">
        <p className="mb-4 text-xs text-foreground/50 leading-relaxed">
          The manager is responsible for the mission's progress and will be displayed as the primary contact on the cockpit.
        </p>

        <button
          type="button"
          onClick={() => !isUpdating && setIsOpen(!isOpen)}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/40 p-3 text-left shadow-sm backdrop-blur-md transition-all hover:bg-white/60",
            isUpdating && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            {currentManager ? (
              <>
                <Avatar src={currentManager.avatarUrl} name={currentManager.name} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{currentManager.name}</p>
                  <p className="text-[10px] text-foreground/40 font-medium truncate">{currentManager.email}</p>
                </div>
              </>
            ) : (
              <p className="text-sm font-medium text-foreground/40">Select a manager...</p>
            )}
          </div>
          <ChevronDown className={cn("size-4 text-foreground/20 transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-y-auto rounded-xl border border-white/60 bg-white/90 p-1 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
            {team.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelect(member.id)}
                className="flex w-full items-center justify-between rounded-lg p-2.5 text-left transition-all hover:bg-black/5 active:bg-black/10"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={member.avatarUrl} name={member.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{member.name}</p>
                    <p className="text-[10px] text-foreground/40 font-medium truncate">{member.email}</p>
                  </div>
                </div>
                {member.id === currentManagerId && (
                  <Check className="size-4 text-pink-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </SectionBlock>
  );
}
