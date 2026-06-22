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
import { Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { createUser } from "./actions";

export function NewUserDialog({ roles }: { roles: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" /> Nieuwe gebruiker
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe gebruiker</DialogTitle>
        </DialogHeader>
        <form action={createUser} className="space-y-3">
          <Field label="Volledige naam">
            <Input name="full_name" placeholder="Jan Jansen" />
          </Field>
          <Field label="E-mailadres">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Tijdelijk wachtwoord">
            <Input name="password" type="text" required minLength={6} />
          </Field>
          <Field label="Rol">
            <NativeSelect name="role_id" required defaultValue="">
              <option value="" disabled>
                Kies een rol…
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <SubmitButton className="w-full">Gebruiker aanmaken</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
