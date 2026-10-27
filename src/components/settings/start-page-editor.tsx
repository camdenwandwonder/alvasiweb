"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Megaphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/primitives";
import { ImageUploader } from "@/components/image-uploader";
import { addStartImage, moveStartImage, removeStartImage, saveStartPage } from "@/lib/settings/actions";
import { SettingsBlock, UnsavedHint, useUnsavedWarning } from "./section";

export type StartPageValues = {
  welcome_text: string;
  announcement_text: string;
  announcement_from: string;
  announcement_until: string;
};

export function StartPageEditor({
  companyId,
  companyName,
  initial,
  images,
}: {
  companyId: string;
  companyName: string;
  initial: StartPageValues;
  images: { id: string; url: string }[];
}) {
  const [form, setForm] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedWarning(dirty);
  const subtitle = form.welcome_text.trim() || `Bestel de producten van ${companyName}.`;

  function save() {
    start(async () => {
      const res = await saveStartPage(companyId, form);
      if (res.ok) toast.success("Opgeslagen");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-8">
      <form
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <SettingsBlock
          title="Welkomsttekst"
          description="Staat onder de begroeting op de startpagina van managers en leidinggevenden."
        >
          <Field label="Welkomsttekst" htmlFor="welcome">
            <Textarea
              id="welcome"
              rows={2}
              maxLength={140}
              value={form.welcome_text}
              onChange={(e) => setForm({ ...form, welcome_text: e.target.value })}
              placeholder={`Bestel de producten van ${companyName}.`}
            />
          </Field>
          <p className="mt-1 text-right text-xs text-muted-foreground">{form.welcome_text.length}/140</p>
          <p className="mt-3 mb-1.5 text-sm font-medium">Voorbeeld</p>
          <div
            className="relative flex min-h-32 flex-col justify-end overflow-hidden rounded-lg bg-neutral-800 bg-cover bg-center p-4 text-white"
            style={images[0] ? { backgroundImage: `url(${images[0].url})` } : undefined}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
            <p className="relative text-xl font-semibold">Welkom, Jan</p>
            <p className="relative text-sm text-white/85">{subtitle}</p>
          </div>
        </SettingsBlock>

        <SettingsBlock
          title="Mededeling in de winkel"
          description="Een korte melding bovenaan de winkel, bijvoorbeeld een deadline. Laat leeg om niets te tonen."
        >
          <Field label="Tekst" htmlFor="ann-text">
            <Input
              id="ann-text"
              maxLength={160}
              value={form.announcement_text}
              onChange={(e) => setForm({ ...form, announcement_text: e.target.value })}
              placeholder="Bijvoorbeeld: bestel je winterjas vóór 1 december"
            />
          </Field>
          <p className="mt-1 text-right text-xs text-muted-foreground">{form.announcement_text.length}/160</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Tonen vanaf (optioneel)" htmlFor="ann-from">
              <Input
                id="ann-from"
                type="date"
                value={form.announcement_from}
                onChange={(e) => setForm({ ...form, announcement_from: e.target.value })}
              />
            </Field>
            <Field label="Tonen tot en met (optioneel)" htmlFor="ann-until">
              <Input
                id="ann-until"
                type="date"
                value={form.announcement_until}
                onChange={(e) => setForm({ ...form, announcement_until: e.target.value })}
              />
            </Field>
          </div>
          {form.announcement_text.trim() ? (
            <>
              <p className="mt-3 mb-1.5 text-sm font-medium">Voorbeeld</p>
              <div className="flex items-start gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-4 py-3 text-sm">
                <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
                {form.announcement_text}
              </div>
            </>
          ) : null}
        </SettingsBlock>

        <div className="flex flex-wrap items-center gap-3 lg:pl-[292px]">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Startpagina opslaan
          </Button>
          <UnsavedHint dirty={dirty} />
        </div>
      </form>

      <StartImages companyId={companyId} images={images} />
    </div>
  );
}

function StartImages({ companyId, images }: { companyId: string; images: { id: string; url: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploadKey, setUploadKey] = useState(0);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (done) toast.success(done);
        router.refresh();
      } else toast.error(res.error ?? "Dat is niet gelukt.");
    });
  }

  return (
    <SettingsBlock
      title="Sfeerbeelden"
      description="Wisselende foto's bovenaan de startpagina. Wijzigingen gelden meteen."
    >
      {images.length ? (
        <ul className="mb-4 grid gap-3 sm:grid-cols-2">
          {images.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`Sfeerbeeld ${i + 1}`} className="aspect-video w-full object-cover" />
              <div className="flex items-center gap-1 px-2 py-1.5 text-sm">
                <span className="flex-1 text-muted-foreground">{i === 0 ? "Eerste beeld" : `Beeld ${i + 1}`}</span>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Eerder tonen" disabled={i === 0 || pending} onClick={() => run(() => moveStartImage(companyId, img.id, -1))}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Later tonen"
                  disabled={i === images.length - 1 || pending}
                  onClick={() => run(() => moveStartImage(companyId, img.id, 1))}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Sfeerbeeld ${i + 1} verwijderen`}
                  disabled={pending}
                  onClick={() => run(() => removeStartImage(companyId, img.id), "Sfeerbeeld verwijderd")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">Nog geen sfeerbeelden. Zonder beelden toont de startpagina een gewone kop.</p>
      )}
      <ImageUploader
        key={uploadKey}
        name="sfeerbeeld"
        bucket="logos"
        aspect="video"
        maxMb={5}
        hint="Liggend, minimaal 1600 px breed · JPG of PNG · maximaal 5 MB"
        onChange={(url) => {
          if (!url) return;
          run(async () => {
            const res = await addStartImage(companyId, url);
            setUploadKey((k) => k + 1);
            return res;
          }, "Sfeerbeeld toegevoegd");
        }}
      />
      {pending ? <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" /> : null}
    </SettingsBlock>
  );
}
