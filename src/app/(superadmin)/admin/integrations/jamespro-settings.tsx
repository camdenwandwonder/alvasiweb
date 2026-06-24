"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  Plug,
  RefreshCw,
  Unplug,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import {
  DEFAULT_TEMPLATES,
  TOKEN_REFERENCE,
  SAMPLE_TOKENS,
  renderTemplate,
} from "@/lib/jamespro/templates";
import {
  connectJamespro,
  testJamesproConnection,
  disconnectJamespro,
  saveJamesproSettings,
  testSendOrderToJamespro,
} from "@/lib/jamespro/actions";

type TestOrder = { id: string; label: string };

type Safe = {
  connected: boolean;
  enabled: boolean;
  deviceType: string;
  defaultUserId: number | null;
  connectedUser: { id: number; name: string } | null;
  lastTestedAt: string | null;
  projectTitleTemplate: string | null;
  projectBriefingTemplate: string | null;
  taskDescriptionTemplate: string | null;
  taskNoteTemplate: string | null;
};

export function JamesproSettings({
  integration,
  testOrders,
}: {
  integration: Safe;
  testOrders: TestOrder[];
}) {
  const [pending, startTransition] = useTransition();
  const [testOrderId, setTestOrderId] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  function sendTest() {
    setTestResult(null);
    startTransition(async () => {
      const res = await testSendOrderToJamespro(testOrderId);
      if (res.ok) {
        const msg = `Gelukt! Project #${res.projectId} en taak #${res.taskId} aangemaakt in JamesPRO.`;
        setTestResult(msg);
        toast.success(msg);
      } else {
        setTestResult(res.error ?? "Mislukt");
        toast.error(res.error ?? "Mislukt");
      }
    });
  }

  // Live-preview state for the templates.
  const [title, setTitle] = useState(
    integration.projectTitleTemplate ?? DEFAULT_TEMPLATES.project_title_template,
  );
  const [briefing, setBriefing] = useState(
    integration.projectBriefingTemplate ??
      DEFAULT_TEMPLATES.project_briefing_template,
  );
  const [taskDesc, setTaskDesc] = useState(
    integration.taskDescriptionTemplate ??
      DEFAULT_TEMPLATES.task_description_template,
  );
  const [taskNote, setTaskNote] = useState(
    integration.taskNoteTemplate ?? DEFAULT_TEMPLATES.task_note_template,
  );

  function connect(formData: FormData) {
    startTransition(async () => {
      const res = await connectJamespro(formData);
      if (res.ok) toast.success(`Verbonden met JamesPRO als ${res.user}`);
      else toast.error(res.error ?? "Verbinden mislukt");
    });
  }

  function test() {
    startTransition(async () => {
      const res = await testJamesproConnection();
      if (res.ok) toast.success(`Verbinding werkt — ingelogd als ${res.user}`);
      else toast.error(res.error ?? "Test mislukt");
    });
  }

  function disconnect() {
    startTransition(async () => {
      await disconnectJamespro();
      toast.success("JamesPRO ontkoppeld");
    });
  }

  return (
    <div className="space-y-6">
      {/* Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">JamesPRO-verbinding</CardTitle>
        </CardHeader>
        <CardContent>
          {integration.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Verbonden
                {integration.connectedUser
                  ? ` als ${integration.connectedUser.name}`
                  : ""}
                {integration.lastTestedAt
                  ? ` · laatst getest ${new Date(integration.lastTestedAt).toLocaleString("nl-NL")}`
                  : ""}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={test} disabled={pending}>
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Test verbinding
                </Button>
                <Button
                  variant="ghost"
                  onClick={disconnect}
                  disabled={pending}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Unplug className="h-4 w-4" /> Ontkoppelen
                </Button>
              </div>
            </div>
          ) : (
            <form action={connect} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Log eenmalig in met je JamesPRO-account. Alvasi wisselt dit in
                voor een API-sleutel; je wachtwoord wordt niet opgeslagen.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="JamesPRO gebruikersnaam (e-mail)">
                  <Input name="username" type="email" required />
                </Field>
                <Field label="Wachtwoord">
                  <Input name="password" type="password" required />
                </Field>
              </div>
              <Field label="Apparaatnaam">
                <Input name="device_type" defaultValue={integration.deviceType} />
              </Field>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4" />
                )}
                Verbinden
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Manual test */}
      {integration.connected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test met een bestelling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Stuur een bestaande bestelling nu naar JamesPRO. Hiermee wordt
              echt een project en taak aangemaakt op de gekoppelde relatie —
              kies een veilige testbestelling.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1">
                <Field label="Bestelling">
                  <NativeSelect
                    value={testOrderId}
                    onChange={(e) => setTestOrderId(e.target.value)}
                  >
                    <option value="">Kies een bestelling…</option>
                    {testOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <Button onClick={sendTest} disabled={pending || !testOrderId}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Verstuur naar JamesPRO
              </Button>
            </div>
            {testResult ? (
              <p className="text-sm text-muted-foreground">{testResult}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Settings + templates */}
      <form action={saveJamesproSettings}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instellingen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={integration.enabled}
                className="h-4 w-4 rounded border-input"
              />
              Koppeling actief (maak projecten/taken aan bij goedgekeurde
              bestellingen)
            </label>

            <Field
              label="Toegewezen JamesPRO-gebruiker (user_id)"
              hint="Het ID van de medewerker aan wie alle projecten/taken worden toegewezen. Te vinden in JamesPRO."
            >
              <Input
                name="default_user_id"
                type="number"
                defaultValue={integration.defaultUserId ?? ""}
                className="w-40"
              />
            </Field>

            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="mb-1 text-xs font-medium">Beschikbare tokens</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {TOKEN_REFERENCE.map((t) => (
                  <span key={t.token} title={t.description}>
                    <code className="rounded bg-background px-1">{t.token}</code>
                  </span>
                ))}
              </div>
            </div>

            <Field label="Projecttitel">
              <Input
                name="project_title_template"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <PreviewLine value={renderTemplate(title, SAMPLE_TOKENS)} />

            <Field label="Projectomschrijving (briefing, HTML toegestaan)">
              <Textarea
                name="project_briefing_template"
                rows={7}
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
              />
            </Field>
            <PreviewHtml value={renderTemplate(briefing, SAMPLE_TOKENS)} />

            <Field label="Taaknaam">
              <Input
                name="task_description_template"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
              />
            </Field>
            <PreviewLine value={renderTemplate(taskDesc, SAMPLE_TOKENS)} />

            <Field label="Taakomschrijving (notitie)">
              <Input
                name="task_note_template"
                value={taskNote}
                onChange={(e) => setTaskNote(e.target.value)}
              />
            </Field>
            <PreviewLine value={renderTemplate(taskNote, SAMPLE_TOKENS)} />

            <SubmitButton>Instellingen opslaan</SubmitButton>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function PreviewLine({ value }: { value: string }) {
  return (
    <p className="-mt-1 text-xs text-muted-foreground">
      <span className="font-medium">Voorbeeld:</span> {value}
    </p>
  );
}

function PreviewHtml({ value }: { value: string }) {
  return (
    <div className="-mt-1 rounded-lg border bg-muted/30 p-3 text-xs">
      <p className="mb-1 font-medium text-muted-foreground">Voorbeeld</p>
      <div
        className="prose prose-sm max-w-none [&_a]:text-[var(--brand-2)]"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  );
}
