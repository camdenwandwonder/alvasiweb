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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { createCategory } from "../actions";

export function NewCategoryDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" /> Nieuwe categorie
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe categorie</DialogTitle>
          <DialogDescription>
            Standaardregels en optie-assen stel je na het aanmaken in.
          </DialogDescription>
        </DialogHeader>
        <form action={createCategory} className="space-y-4">
          <Field label="Naam">
            <Input name="name" required placeholder="Kleding" />
          </Field>
          <Field label="Omschrijving">
            <Textarea name="description" rows={2} />
          </Field>
          <SubmitButton className="w-full">Categorie aanmaken</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
