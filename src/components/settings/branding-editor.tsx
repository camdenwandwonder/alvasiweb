"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ClipboardList, Home, Loader2, Package, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUploader } from "@/components/image-uploader";
import { cn } from "@/lib/utils";
import { checkColor, formatRatio, normalizeHex, readableShade } from "@/lib/contrast";
import { saveBranding } from "@/lib/settings/actions";
import { SettingsBlock, UnsavedHint, useUnsavedWarning } from "./section";

export type BrandingValues = {
  logo_url: string;
  logo_icon_url: string;
  primary_color: string;
  secondary_color: string;
};

export function BrandingEditor({
  companyId,
  companyName,
  initial,
}: {
  companyId: string;
  companyName: string;
  initial: BrandingValues;
}) {
  const [form, setForm] = useState(initial);
  const [pending, start] = useTransition();
  const [resetKey, setResetKey] = useState(0);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedWarning(dirty);
  const primary = normalizeHex(form.primary_color) ?? initial.primary_color;
  const secondary = normalizeHex(form.secondary_color) ?? initial.secondary_color;
  const set = (k: keyof BrandingValues, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    start(async () => {
      const res = await saveBranding(companyId, form);
      if (res.ok) toast.success("Opgeslagen");
      else toast.error(res.error);
    });
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <SettingsBlock
        title="Logo"
        description={
          <>
            Een liggend logo voor de kop, en een vierkant icoon voor de smalle zijbalk en het tabblad van de
            browser.
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_160px]">
          <div>
            <p className="mb-1.5 text-sm font-medium">Logo (liggend)</p>
            <ImageUploader
              key={`logo-${initial.logo_url}-${resetKey}`}
              name="logo_url"
              bucket="logos"
              aspect="video"
              fit="contain"
              maxMb={2}
              hint="PNG, SVG of JPG · liggend, minimaal 400 px breed · maximaal 2 MB"
              defaultUrl={form.logo_url}
              onChange={(u) => set("logo_url", u)}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Icoon (vierkant)</p>
            <ImageUploader
              key={`icon-${initial.logo_icon_url}-${resetKey}`}
              name="logo_icon_url"
              bucket="logos"
              aspect="square"
              fit="contain"
              maxMb={2}
              hint="Vierkant, minimaal 128 px · maximaal 2 MB"
              defaultUrl={form.logo_icon_url}
              onChange={(u) => set("logo_icon_url", u)}
            />
          </div>
        </div>

        <p className="mt-5 mb-2 text-sm font-medium">Zo ziet het eruit, op ware grootte</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["light", "dark"] as const).map((mode) => (
            <div
              key={mode}
              className={cn(
                "space-y-3 rounded-lg border p-3",
                mode === "dark" ? "border-neutral-700 bg-neutral-900 text-neutral-50" : "bg-white text-neutral-900",
              )}
            >
              <p className={cn("text-[11px] uppercase tracking-wide", mode === "dark" ? "text-neutral-400" : "text-neutral-500")}>
                {mode === "dark" ? "Donkere achtergrond" : "Lichte achtergrond"}
              </p>
              <div className="flex items-center gap-2.5">
                <LogoSquare icon={form.logo_icon_url || form.logo_url} name={companyName} primary={primary} />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{companyName}</p>
                  <p className={cn("text-xs", mode === "dark" ? "text-neutral-400" : "text-neutral-500")}>Bestelportaal</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("rounded-md p-1.5", mode === "dark" ? "bg-neutral-800" : "bg-neutral-100")}>
                  <LogoSquare icon={form.logo_icon_url || form.logo_url} name={companyName} primary={primary} />
                </span>
                <span className={cn("text-xs", mode === "dark" ? "text-neutral-400" : "text-neutral-500")}>
                  Zijbalk ingeklapt
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border bg-white p-4 text-neutral-900">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">Pakbon</p>
          <div className="flex items-center justify-between border-b border-neutral-300 pb-2">
            {form.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_url} alt="" className="h-10 max-w-48 object-contain" />
            ) : (
              <span className="text-base font-semibold">{companyName}</span>
            )}
            <span className="text-lg font-semibold">Pakbon</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">ALV-2026-00128 · 28 oktober 2026</p>
        </div>
      </SettingsBlock>

      <SettingsBlock
        title="Kleuren"
        description="De hoofdkleur gebruikt het portaal voor knoppen, het actieve menu-item en labels. Er staat altijd witte tekst op, dus die moet goed leesbaar zijn."
      >
        <div className="space-y-5">
          <ColorField
            label="Hoofdkleur"
            value={form.primary_color}
            onChange={(v) => set("primary_color", v)}
            textCheck
          />
          <ColorField
            label="Tweede kleur"
            value={form.secondary_color}
            onChange={(v) => set("secondary_color", v)}
          />
        </div>
      </SettingsBlock>

      <SettingsBlock
        title="Voorbeeld"
        description="Zo ziet je portaal eruit met deze kleuren. Pas na opslaan wordt het echt."
      >
        <MiniPortal name={companyName} icon={form.logo_icon_url || form.logo_url} primary={primary} secondary={secondary} />
      </SettingsBlock>

      <div className="flex flex-wrap items-center gap-3 lg:pl-[292px]">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Huisstijl opslaan
        </Button>
        {dirty ? (
          <Button type="button" variant="ghost" onClick={() => {
              setForm(initial);
              setResetKey((k) => k + 1);
            }}>
            Wijzigingen ongedaan maken
          </Button>
        ) : null}
        <UnsavedHint dirty={dirty} />
      </div>
    </form>
  );
}

function LogoSquare({ icon, name, primary }: { icon: string; name: string; primary: string }) {
  return icon ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={icon} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" />
  ) : (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
      style={{ background: primary }}
    >
      {(name || "A").charAt(0).toUpperCase()}
    </span>
  );
}

function ColorField({
  label,
  value,
  onChange,
  textCheck = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Check white text on this colour (the main brand colour). */
  textCheck?: boolean;
}) {
  const hex = normalizeHex(value);
  const check = hex ? checkColor(hex) : null;
  const suggestion = hex && textCheck ? readableShade(hex) : null;

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <label className="relative h-10 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border" style={{ background: hex ?? "#ffffff" }}>
          <input
            type="color"
            value={hex ?? "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label} kiezen`}
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 font-mono uppercase"
          aria-label={`${label} als kleurcode`}
          aria-invalid={!hex}
        />
        {!hex ? <span className="text-sm text-red-700">Gebruik een kleurcode zoals #1F2A44</span> : null}
      </div>
      {check ? (
        <ul className="mt-2 space-y-1 text-sm">
          {textCheck ? (
            <CheckLine ok={check.whiteText}>
              Witte tekst op deze kleur: {formatRatio(check.white)}{" "}
              {check.whiteText ? "· goed leesbaar" : "· te weinig contrast (minimaal 4,5:1)"}
            </CheckLine>
          ) : null}
          <CheckLine ok={check.onWhiteUi}>
            Zichtbaar op een witte pagina: {formatRatio(check.white)}{" "}
            {check.onWhiteUi ? "· goed" : "· te licht voor knoppen en randen (minimaal 3:1)"}
          </CheckLine>
        </ul>
      ) : null}
      {suggestion ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="h-5 w-5 rounded border border-amber-300" style={{ background: suggestion }} />
          Voorstel: <span className="font-mono">{suggestion.toUpperCase()}</span>, dezelfde kleur maar donkerder.
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(suggestion)}>
            Gebruik voorstel
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CheckLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-start gap-1.5", ok ? "text-green-800" : "text-amber-800")}>
      {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </li>
  );
}

/** A small mock of the portal in the chosen colours. */
function MiniPortal({ name, icon, primary, secondary }: { name: string; icon: string; primary: string; secondary: string }) {
  const items = [
    { label: "Start", icon: Home, active: false },
    { label: "Winkel", icon: Store, active: true },
    { label: "Bestellingen", icon: ClipboardList, active: false },
  ];
  return (
    <div className="flex overflow-hidden rounded-lg border bg-white text-neutral-900" aria-hidden>
      <div className="w-40 shrink-0 border-r bg-neutral-50 p-2.5">
        <div className="mb-3 flex items-center gap-2">
          <LogoSquare icon={icon} name={name} primary={primary} />
          <span className="truncate text-xs font-semibold">{name}</span>
        </div>
        {items.map((i) => (
          <div
            key={i.label}
            className="mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
            style={i.active ? { background: `color-mix(in oklch, ${primary} 12%, white)`, color: primary, fontWeight: 600 } : undefined}
          >
            <i.icon className="h-3.5 w-3.5" />
            {i.label}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 p-3">
        <div className="w-36 overflow-hidden rounded-lg border">
          <div className="relative flex aspect-[4/3] items-center justify-center bg-neutral-100 text-neutral-400">
            <Package className="h-6 w-6" />
            <span className="absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: primary }}>
              Nieuw
            </span>
          </div>
          <div className="space-y-1.5 p-2">
            <p className="truncate text-xs font-medium">Softshell jas</p>
            <p className="text-xs font-semibold">€ 99,00</p>
            <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `color-mix(in oklch, ${secondary} 15%, white)`, color: secondary }}>
              Voor jouw functie
            </span>
            <div className="rounded-md py-1 text-center text-[11px] font-medium text-white" style={{ background: primary }}>
              Toevoegen
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
