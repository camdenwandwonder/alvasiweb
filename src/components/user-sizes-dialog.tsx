"use client";

import { useState } from "react";
import { Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { setUserSizes } from "@/app/(app)/people/actions";

export type SizeSet = {
  id: string;
  name: string;
  values: { id: string; value: string; label: string | null; sort_order: number }[];
};

export function UserSizesDialog({
  userId,
  userName,
  sizeSets,
  current,
}: {
  userId: string;
  userName: string;
  sizeSets: SizeSet[];
  current: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  if (sizeSets.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Ruler className="h-3.5 w-3.5" /> Maten
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Standaardmaten — {userName}</DialogTitle>
        </DialogHeader>
        <p className="mb-3 text-sm text-muted-foreground">
          Stel de vaste maten in. Bij het bestellen worden deze automatisch
          voorgeselecteerd.
        </p>
        <form
          action={async (fd) => {
            await setUserSizes(userId, fd);
            setOpen(false);
          }}
          className="space-y-3"
        >
          {sizeSets.map((s) => (
            <Field key={s.id} label={s.name}>
              <NativeSelect name={`size_${s.id}`} defaultValue={current[s.id] ?? ""}>
                <option value="">—</option>
                {[...s.values]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((v) => (
                    <option key={v.id} value={v.value}>
                      {v.label ?? v.value}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          ))}
          <SubmitButton className="w-full">Maten opslaan</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
