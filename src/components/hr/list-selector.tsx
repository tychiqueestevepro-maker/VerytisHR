"use client";

import { useState } from "react";
import { ChevronDown, List as ListIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_LISTS = [
  { id: "all", name: "All Lists" },
  { id: "list_a", name: "List A" },
  { id: "list_b", name: "List B" },
  { id: "list_c", name: "List C" },
];

export function ListSelector() {
  const [selectedList, setSelectedList] = useState("all");

  return (
    <div className="flex items-center gap-2">
      <ListIcon className="size-4 text-foreground/40" />
      <div className="relative inline-block text-left">
        <select
          value={selectedList}
          onChange={(e) => setSelectedList(e.target.value)}
          className="h-9 w-[160px] appearance-none rounded-md border border-border bg-secondary/50 px-3 pr-8 text-xs font-medium text-foreground transition hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {MOCK_LISTS.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-foreground/40" />
      </div>
    </div>
  );
}
