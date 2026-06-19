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
import { Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { createOptionSet } from "../actions";

export function NewOptionSetDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" /> Nieuwe optieset
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe optieset</DialogTitle>
          <DialogDescription>
            Een herbruikbare lijst met waarden (een matensysteem of kleurpalet).
          </DialogDescription>
        </DialogHeader>
        <form action={createOptionSet} className="space-y-4">
          <Field label="Naam">
            <Input name="name" required placeholder="Kledingmaten" />
          </Field>
          <Field label="Type">
            <NativeSelect name="kind" defaultValue="size">
              <option value="size">Matensysteem</option>
              <option value="color">Kleurpalet</option>
              <option value="text">Ander kenmerk</option>
            </NativeSelect>
          </Field>
          <SubmitButton className="w-full">Optieset aanmaken</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
