"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** A button with a panel below it that closes on outside click or Escape. */
export function Popover({
  trigger,
  children,
  align = "left",
  className,
  open: controlled,
  onOpenChange,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "left" | "right";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setOwn(v));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open ? (
        <div
          className={cn(
            "absolute top-full z-40 mt-1.5 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      ) : null}
    </div>
  );
}

export type SelectOption = { id: string; name: string; hint?: string };

/** Filter button with a searchable (multi-)select list. */
export function FilterSelect({
  label,
  options,
  value,
  onChange,
  single = false,
  searchable,
}: {
  label: string;
  options: SelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  single?: boolean;
  searchable?: boolean;
}) {
  const [term, setTerm] = useState("");
  const showSearch = searchable ?? options.length > 8;
  const t = term.trim().toLowerCase();
  const shown = t
    ? options.filter((o) => `${o.name} ${o.hint ?? ""}`.toLowerCase().includes(t))
    : options;
  const selectedName =
    value.length === 1 ? options.find((o) => o.id === value[0])?.name : undefined;

  return (
    <Popover
      className="w-72"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            "inline-flex h-9 max-w-64 items-center gap-1.5 rounded-lg border px-3 text-sm transition",
            value.length
              ? "border-[var(--brand)] bg-[var(--brand)]/5 font-medium"
              : "hover:bg-muted",
          )}
        >
          <span className="truncate">
            {label}
            {selectedName ? `: ${selectedName}` : value.length > 1 ? ` (${value.length})` : ""}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      )}
    >
      {(close) => (
        <div>
          {showSearch ? (
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={`Zoek ${label.toLowerCase()}`}
                className="h-9 w-full rounded-lg border bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          ) : null}
          <ul className="max-h-72 overflow-y-auto">
            {shown.map((o) => {
              const on = value.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (single) {
                        onChange(on ? [] : [o.id]);
                        close();
                      } else onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id]);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center border",
                        single ? "rounded-full" : "rounded",
                        on && "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-foreground)]",
                      )}
                    >
                      {on ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.name}</span>
                    {o.hint ? (
                      <span className="max-w-28 shrink-0 truncate text-xs text-muted-foreground">
                        {o.hint}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {!shown.length ? (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">Niets gevonden</li>
            ) : null}
          </ul>
          {value.length ? (
            <div className="mt-1 border-t pt-1">
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  close();
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
              >
                Selectie wissen
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Popover>
  );
}
