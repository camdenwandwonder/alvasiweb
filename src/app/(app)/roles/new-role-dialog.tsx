"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { createRole } from "./actions";

export function NewRoleDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" /> Nieuwe rol
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe rol</DialogTitle>
        </DialogHeader>
        <form action={createRole} className="space-y-4">
          <Field label="Naam">
            <Input name="name" required placeholder="Bijv. Teamleider" />
          </Field>
          <SubmitButton className="w-full">Rol aanmaken</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
