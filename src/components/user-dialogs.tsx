"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/primitives";
import {
  createCompanyUser,
  deleteCompanyUser,
  setCompanyUserPassword,
  updateCompanyUser,
} from "@/lib/user-admin-actions";

export type ManagedUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  role_id: string | null;
  sizes: Record<string, string> | null;
};

type Role = { id: string; name: string };
type Result = { ok: true } | { ok: false; error: string };

export function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/* ---------- shared form plumbing ---------- */

function useActionForm(onDone: () => void) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(
    e: React.FormEvent<HTMLFormElement>,
    action: (fd: FormData) => Promise<Result>,
    success: string,
  ) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await action(fd);
      if (res.ok) {
        toast.success(success);
        onDone();
      } else {
        setError(res.error);
      }
    });
  }
  return { pending, error, setError, submit };
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </p>
  );
}

function PasswordField({
  value,
  onChange,
  label = "Wachtwoord",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <Field label={label} hint="Minimaal 8 tekens. Deel het wachtwoord veilig met de gebruiker.">
      <div className="flex gap-2">
        <Input
          name="password"
          type="text"
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={8}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange(generatePassword())}
        >
          <Wand2 className="h-4 w-4" /> Genereer
        </Button>
      </div>
    </Field>
  );
}

function SaveButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

/* ---------- dialogs ---------- */

export function NewUserDialog({ companyId, roles }: { companyId: string; roles: Role[] }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const defaultRole =
    roles.find((r) => r.name.toLowerCase() === "personeel")?.id ?? "";
  const { pending, error, setError, submit } = useActionForm(() => {
    setOpen(false);
    setPassword("");
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setError(null);
          setPassword(generatePassword());
        }
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" /> Nieuwe medewerker
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe medewerker</DialogTitle>
          <DialogDescription>
            De gebruiker kan direct inloggen met dit e-mailadres en wachtwoord.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) =>
            submit(e, (fd) => createCompanyUser(companyId, fd), "Medewerker toegevoegd")
          }
          className="space-y-3"
        >
          <Field label="Volledige naam">
            <Input name="full_name" placeholder="Jan Jansen" />
          </Field>
          <Field label="E-mailadres">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Functie">
            <NativeSelect name="role_id" required defaultValue={defaultRole}>
              <option value="" disabled>
                Kies een functie…
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <PasswordField value={password} onChange={setPassword} />
          <FormError error={error} />
          <SaveButton pending={pending}>Medewerker toevoegen</SaveButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditUserDialog({
  user,
  roles,
  isSelf,
  labeled = false,
}: {
  user: ManagedUser;
  roles: Role[];
  isSelf: boolean;
  labeled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, setError, submit } = useActionForm(() => setOpen(false));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setError(null);
      }}
    >
      <DialogTrigger
        render={
          labeled ? (
            <Button variant="outline" size="sm" />
          ) : (
            <Button variant="ghost" size="icon-sm" aria-label="Bewerken" title="Bewerken" />
          )
        }
      >
        <Pencil className="h-4 w-4" />
        {labeled ? "Gegevens" : null}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gegevens bewerken</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) =>
            submit(e, (fd) => updateCompanyUser(user.id, fd), "Wijzigingen opgeslagen")
          }
          className="space-y-3"
        >
          <Field label="Volledige naam">
            <Input name="full_name" defaultValue={user.full_name ?? ""} />
          </Field>
          <Field label="E-mailadres" hint="Dit is ook het inlogadres van de gebruiker.">
            <Input name="email" type="email" defaultValue={user.email ?? ""} required />
          </Field>
          <Field label="Functie">
            <NativeSelect name="role_id" required defaultValue={user.role_id ?? ""}>
              <option value="" disabled>
                Kies een functie…
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Status"
            hint={
              isSelf
                ? "Je kunt je eigen account niet deactiveren."
                : "Een gedeactiveerde gebruiker kan niet meer inloggen."
            }
          >
            <NativeSelect
              name="status"
              defaultValue={user.status === "disabled" ? "disabled" : "active"}
              disabled={isSelf}
            >
              <option value="active">Actief</option>
              <option value="disabled">Gedeactiveerd</option>
            </NativeSelect>
            {isSelf ? <input type="hidden" name="status" value="active" /> : null}
          </Field>
          <FormError error={error} />
          <SaveButton pending={pending}>Opslaan</SaveButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PasswordDialog({
  user,
  labeled = false,
}: {
  user: ManagedUser;
  labeled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const { pending, error, setError, submit } = useActionForm(() => {
    setOpen(false);
    setPassword("");
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setError(null);
          setPassword("");
        }
      }}
    >
      <DialogTrigger
        render={
          labeled ? (
            <Button variant="outline" size="sm" />
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Wachtwoord wijzigen"
              title="Wachtwoord wijzigen"
            />
          )
        }
      >
        <KeyRound className="h-4 w-4" />
        {labeled ? "Wachtwoord" : null}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wachtwoord wijzigen</DialogTitle>
          <DialogDescription>
            Nieuw wachtwoord voor {user.full_name || user.email}. Het oude
            wachtwoord werkt daarna niet meer.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) =>
            submit(e, (fd) => setCompanyUserPassword(user.id, fd), "Wachtwoord gewijzigd")
          }
          className="space-y-3"
        >
          <PasswordField
            value={password}
            onChange={setPassword}
            label="Nieuw wachtwoord"
          />
          <FormError error={error} />
          <SaveButton pending={pending}>Wachtwoord opslaan</SaveButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteUserDialog({
  user,
  labeled = false,
  onDone,
}: {
  user: ManagedUser;
  labeled?: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    start(async () => {
      const res = await deleteCompanyUser(user.id);
      if (res.ok) {
        toast.success("Gebruiker verwijderd");
        setOpen(false);
        onDone?.();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setError(null);
      }}
    >
      <DialogTrigger
        render={
          labeled ? (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
            />
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Verwijderen"
              title="Verwijderen"
              className="text-muted-foreground hover:text-destructive"
            />
          )
        }
      >
        <Trash2 className="h-4 w-4" />
        {labeled ? "Verwijderen" : null}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Medewerker verwijderen?</DialogTitle>
          <DialogDescription>
            {user.full_name || user.email} wordt definitief verwijderd en kan
            niet meer inloggen. Dit kan niet ongedaan worden gemaakt.
          </DialogDescription>
        </DialogHeader>
        <FormError error={error} />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Annuleren
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={pending}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Verwijderen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
