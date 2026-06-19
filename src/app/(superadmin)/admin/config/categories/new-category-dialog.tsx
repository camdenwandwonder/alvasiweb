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
        <Plus className="h-4 w-4" /> New category
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>
            You can set default rules and option axes after creating it.
          </DialogDescription>
        </DialogHeader>
        <form action={createCategory} className="space-y-4">
          <Field label="Name">
            <Input name="name" required placeholder="Clothing" />
          </Field>
          <Field label="Description">
            <Textarea name="description" rows={2} />
          </Field>
          <SubmitButton className="w-full">Create category</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
