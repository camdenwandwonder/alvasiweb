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
        <Plus className="h-4 w-4" /> New option set
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New option set</DialogTitle>
          <DialogDescription>
            A reusable list of values (a size system or color palette).
          </DialogDescription>
        </DialogHeader>
        <form action={createOptionSet} className="space-y-4">
          <Field label="Name">
            <Input name="name" required placeholder="Clothing sizes" />
          </Field>
          <Field label="Type">
            <NativeSelect name="kind" defaultValue="size">
              <option value="size">Size system</option>
              <option value="color">Color palette</option>
              <option value="text">Other attribute</option>
            </NativeSelect>
          </Field>
          <SubmitButton className="w-full">Create option set</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
