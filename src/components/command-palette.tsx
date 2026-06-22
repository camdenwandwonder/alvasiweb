"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { SidebarNavItem } from "@/components/app-sidebar";

export function CommandPalette({ items }: { items: SidebarNavItem[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Zoek een pagina…" />
      <CommandList>
        <CommandEmpty>Niets gevonden.</CommandEmpty>
        <CommandGroup heading="Navigatie">
          {items.map((i) => (
            <CommandItem
              key={i.href}
              value={i.label}
              onSelect={() => {
                setOpen(false);
                router.push(i.href);
              }}
            >
              {i.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
