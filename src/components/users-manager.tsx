"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
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
import { Field, NativeSelect, StatusBadge } from "@/components/primitives";
import { UserSizesDialog, type SizeSet } from "@/components/user-sizes-dialog";
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

const STATUS: Record<
  string,
  { label: string; tone: "green" | "red" | "amber" }
> = {
  active: { label: "Actief", tone: "green" },
  disabled: { label: "Gedeactiveerd", tone: "red" },
  invited: { label: "Uitgenodigd", tone: "amber" },
};

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function initials(u: ManagedUser): string {
  const base = u.full_name || u.email || "?";
  return base
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

export function UsersManager({
  companyId,
  users,
  roles,
  sizeSets,
  currentUserId,
  canInvite,
  canUpdate,
  canRemove,
}: {
  companyId: string;
  users: ManagedUser[];
  roles: Role[];
  sizeSets: SizeSet[];
  currentUserId: string;
  canInvite: boolean;
  canUpdate: boolean;
  canRemove: boolean;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const roleName = (id: string | null) =>
    roles.find((r) => r.id === id)?.name ?? "Geen rol";

  function sizeSummary(sizes: Record<string, string> | null): string {
    if (!sizes) return "";
    return sizeSets
      .filter((s) => sizes[s.id])
      .map((s) => {
        const v = s.values.find((x) => x.value === sizes[s.id]);
        return `${s.name}: ${v?.label ?? sizes[s.id]}`;
      })
      .join(", ");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        (!roleFilter || u.role_id === roleFilter) &&
        (!q ||
          (u.full_name ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q)),
    );
  }, [users, query, roleFilter]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek op naam of e-mail"
              className="pl-9"
            />
          </div>
          <NativeSelect
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="sm:w-48"
          >
            <option value="">Alle rollen</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </NativeSelect>
          <span className="text-sm text-muted-foreground sm:ml-1">
            {filtered.length} van {users.length} gebruiker
            {users.length === 1 ? "" : "s"}
          </span>
        </div>
        {canInvite ? (
          <NewUserDialog companyId={companyId} roles={roles} />
        ) : null}
      </div>

      {/* List */}
      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="h-5 w-5" />
          </span>
          <p className="font-medium">Nog geen gebruikers</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Voeg de eerste gebruiker toe met de knop rechtsboven.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-3">Gebruiker</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Standaardmaten</th>
                <th className="px-4 py-3 text-right">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((u) => {
                const isSelf = u.id === currentUserId;
                const st = STATUS[u.status] ?? STATUS.active;
                const sizes = sizeSummary(u.sizes);
                return (
                  <tr key={u.id} className="align-middle hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-semibold text-[var(--brand-foreground)]">
                          {initials(u)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {u.full_name || u.email}
                            {isSelf ? (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                (jij)
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                        {roleName(u.role_id)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {sizes || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate ? (
                          <>
                            <UserSizesDialog
                              userId={u.id}
                              userName={u.full_name || u.email || "Gebruiker"}
                              sizeSets={sizeSets}
                              current={u.sizes ?? {}}
                              iconOnly
                            />
                            <EditUserDialog
                              user={u}
                              roles={roles}
                              isSelf={isSelf}
                            />
                            <PasswordDialog user={u} />
                          </>
                        ) : null}
                        {canRemove && !isSelf ? <DeleteUserDialog user={u} /> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Geen gebruikers gevonden voor deze zoekopdracht.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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

function NewUserDialog({ companyId, roles }: { companyId: string; roles: Role[] }) {
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
        <Plus className="h-4 w-4" /> Nieuwe gebruiker
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe gebruiker</DialogTitle>
          <DialogDescription>
            De gebruiker kan direct inloggen met dit e-mailadres en wachtwoord.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) =>
            submit(e, (fd) => createCompanyUser(companyId, fd), "Gebruiker aangemaakt")
          }
          className="space-y-3"
        >
          <Field label="Volledige naam">
            <Input name="full_name" placeholder="Jan Jansen" />
          </Field>
          <Field label="E-mailadres">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Rol">
            <NativeSelect name="role_id" required defaultValue={defaultRole}>
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
          <PasswordField value={password} onChange={setPassword} />
          <FormError error={error} />
          <SaveButton pending={pending}>Gebruiker aanmaken</SaveButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  roles,
  isSelf,
}: {
  user: ManagedUser;
  roles: Role[];
  isSelf: boolean;
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
          <Button variant="ghost" size="icon-sm" aria-label="Bewerken" title="Bewerken" />
        }
      >
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gebruiker bewerken</DialogTitle>
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
          <Field label="Rol">
            <NativeSelect name="role_id" required defaultValue={user.role_id ?? ""}>
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

function PasswordDialog({ user }: { user: ManagedUser }) {
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
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Wachtwoord wijzigen"
            title="Wachtwoord wijzigen"
          />
        }
      >
        <KeyRound className="h-4 w-4" />
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

function DeleteUserDialog({ user }: { user: ManagedUser }) {
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
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Verwijderen"
            title="Verwijderen"
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2 className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gebruiker verwijderen?</DialogTitle>
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
