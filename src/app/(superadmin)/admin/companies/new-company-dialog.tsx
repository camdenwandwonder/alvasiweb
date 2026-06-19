"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { ImageUploader } from "@/components/image-uploader";
import { createCompany } from "./actions";

export function NewCompanyDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" /> Nieuw bedrijf
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuw bedrijf</DialogTitle>
          <DialogDescription>
            Voeg een klantbedrijf toe en stel de huisstijl in.
          </DialogDescription>
        </DialogHeader>
        <form action={createCompany} className="space-y-4">
          <Field label="Bedrijfsnaam">
            <Input name="name" required placeholder="Acme Workwear" />
          </Field>
          <Field label="Logo" hint="Optioneel">
            <ImageUploader name="logo_url" bucket="logos" aspect="square" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Primaire kleur">
              <input
                type="color"
                name="primary_color"
                defaultValue="#0f172a"
                className="h-9 w-full rounded-md border"
              />
            </Field>
            <Field label="Secundaire kleur">
              <input
                type="color"
                name="secondary_color"
                defaultValue="#6366f1"
                className="h-9 w-full rounded-md border"
              />
            </Field>
          </div>
          <SubmitButton className="w-full">Bedrijf aanmaken</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
