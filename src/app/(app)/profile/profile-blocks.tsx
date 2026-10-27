"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, KeyRound, Loader2, LogOut, PlusCircle, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/primitives";
import { RequestBudgetDialog } from "@/components/request-budget-dialog";
import { cn } from "@/lib/utils";
import { changeMyPassword, setMySize, signOutEverywhere, updatePersonal } from "./actions";

export type ProfileSizeSet = {
  id: string;
  name: string;
  values: { value: string; label: string }[];
  chart: { columns: string[]; rows: { size: string; values: string[] }[]; note: string | null } | null;
};

/** Size buttons per size system; a click saves straight away. */
export function SizesBlock({
  sets,
  initial,
}: {
  sets: ProfileSizeSet[];
  initial: Record<string, string>;
}) {
  const [sizes, setSizes] = useState<Record<string, string>>(initial);
  const [saved, setSaved] = useState<string | null>(null);
  const [chartFor, setChartFor] = useState<ProfileSizeSet | null>(null);
  const [, start] = useTransition();

  function pick(set: ProfileSizeSet, value: string) {
    const prev = sizes[set.id] ?? null;
    const next = prev === value ? null : value;
    setSizes((s) => {
      const copy = { ...s };
      if (next) copy[set.id] = next;
      else delete copy[set.id];
      return copy;
    });
    setSaved(null);
    start(async () => {
      const res = await setMySize(set.id, next);
      if (res.ok) setSaved(set.id);
      else {
        toast.error(res.error);
        setSizes((s) => {
          const copy = { ...s };
          if (prev) copy[set.id] = prev;
          else delete copy[set.id];
          return copy;
        });
      }
    });
  }

  if (!sets.length)
    return <p className="text-sm text-muted-foreground">Er zijn nog geen maatsystemen ingesteld.</p>;

  return (
    <div className="space-y-5">
      {sets.map((set) => (
        <div key={set.id}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {set.name}
              {saved === set.id ? (
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-green-700">
                  <Check className="h-3.5 w-3.5" /> Opgeslagen
                </span>
              ) : null}
            </p>
            {set.chart ? (
              <button
                type="button"
                onClick={() => setChartFor(set)}
                className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline"
              >
                <Ruler className="h-3.5 w-3.5" /> Maattabel bekijken
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={set.name}>
            {set.values.map((v) => {
              const on = sizes[set.id] === v.value;
              return (
                <button
                  key={v.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pick(set, v.value)}
                  className={cn(
                    "min-w-12 rounded-lg border px-3 py-2 text-sm font-medium transition",
                    on ? "border-foreground bg-foreground text-background" : "hover:border-foreground/50",
                  )}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {chartFor?.chart ? (
        <Dialog open onOpenChange={(o) => (o ? null : setChartFor(null))}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Maattabel {chartFor.name}</DialogTitle>
              <DialogDescription>Meet over je kleding heen of vergelijk met een kledingstuk dat goed past.</DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Maat</th>
                    {chartFor.chart.columns.map((c) => (
                      <th key={c} className="px-3 py-2 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {chartFor.chart.rows.map((r) => {
                    const mine = chartFor.values.find((v) => v.value === sizes[chartFor.id]);
                    const highlight = mine && (mine.label === r.size || mine.value === r.size);
                    return (
                      <tr key={r.size} className={cn(highlight && "bg-[var(--brand)]/10 font-medium")}>
                        <td className="px-3 py-1.5">{r.size}</td>
                        {r.values.map((v, i) => (
                          <td key={i} className="px-3 py-1.5">
                            {v}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {chartFor.chart.note ? <p className="text-xs text-muted-foreground">{chartFor.chart.note}</p> : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

/** One personal detail with an inline "Wijzig". */
export function PersonalRow({
  label,
  field,
  value,
  placeholder,
  inputMode,
}: {
  label: string;
  field: "full_name" | "phone";
  value: string | null;
  placeholder: string;
  inputMode?: "tel" | "text";
}) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value ?? "");
  const [draft, setDraft] = useState(value ?? "");
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updatePersonal(field, draft);
      if (res.ok) {
        setCurrent(draft.trim());
        setEditing(false);
        toast.success(`${label} opgeslagen`);
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
      <dt className="w-40 shrink-0 text-sm text-muted-foreground">{label}</dt>
      {editing ? (
        <form onSubmit={save} className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            inputMode={inputMode}
            aria-label={label}
            className="h-9 max-w-xs"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {label} opslaan
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(current);
              setEditing(false);
            }}
          >
            Annuleren
          </Button>
        </form>
      ) : (
        <>
          <dd className={cn("flex-1 text-sm", !current && "text-muted-foreground")}>{current || "Niet ingevuld"}</dd>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="self-start text-sm font-medium text-[var(--brand)] hover:underline sm:self-auto"
          >
            {current ? "Wijzig" : "Toevoegen"}
            <span className="sr-only"> {label.toLowerCase()}</span>
          </button>
        </>
      )}
    </div>
  );
}

export function RequestBudgetButton({ unit }: { unit: "euro" | "credits" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlusCircle className="h-4 w-4" /> Meer budget aanvragen
      </Button>
      {open ? <RequestBudgetDialog unit={unit} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function PasswordButton() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setCurrent("");
    setNext("");
    setRepeat("");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setError("Het nieuwe wachtwoord moet minimaal 8 tekens hebben.");
    if (next !== repeat) return setError("De nieuwe wachtwoorden zijn niet gelijk.");
    setError(null);
    start(async () => {
      const res = await changeMyPassword(current, next);
      if (res.ok) {
        toast.success("Wachtwoord gewijzigd");
        reset();
        setOpen(false);
      } else setError(res.error);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <KeyRound className="h-4 w-4" /> Wachtwoord wijzigen
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) {
              reset();
              setOpen(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Wachtwoord wijzigen</DialogTitle>
              <DialogDescription>Ter controle vragen we eerst je huidige wachtwoord.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <Field label="Huidig wachtwoord" htmlFor="pw-current">
                <Input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                />
              </Field>
              <Field label="Nieuw wachtwoord" htmlFor="pw-new" hint="Minimaal 8 tekens.">
                <Input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  required
                />
              </Field>
              <Field label="Herhaal nieuw wachtwoord" htmlFor="pw-repeat">
                <Input
                  id="pw-repeat"
                  type="password"
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  required
                />
              </Field>
              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              ) : null}
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Wachtwoord opslaan
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

export function SignOutEverywhereButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Je wordt op al je apparaten uitgelogd, ook hier. Doorgaan?")) return;
        start(async () => {
          await signOutEverywhere();
        });
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Overal uitloggen
    </Button>
  );
}
