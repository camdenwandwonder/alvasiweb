/**
 * Low-level JamesPRO API client. Server-only — never import from client code.
 * Auth is two-step: exchange username/password for a key+secret once, then send
 * HTTP Basic (key:secret) on every request. Docs: https://start.jamespro.nl/api
 */

const BASE = "https://start.jamespro.nl/api";

export type JamesproCreds = { key: string; secret: string };

function authHeader({ key, secret }: JamesproCreds): string {
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

/** Step 1 — exchange user credentials for an API key + secret. */
export async function jamesproAuth(
  username: string,
  password: string,
  deviceType: string,
): Promise<JamesproCreds> {
  const res = await fetch(`${BASE}/auth/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, password, devicetype: deviceType }),
  });
  const data = await res.json().catch(() => null);
  const key = data?.key ?? data?.body?.key;
  const secret = data?.secret ?? data?.body?.secret;
  if (!res.ok || !key || !secret) {
    throw new Error(
      "Inloggen bij JamesPRO mislukt. Controleer je gebruikersnaam en wachtwoord.",
    );
  }
  return { key, secret };
}

type JamesproResponse<T = unknown> = { code?: string; body?: T };

/** Authenticated request. Returns the parsed `{ code, body }` envelope. */
export async function jamespro<T = unknown>(
  creds: JamesproCreds,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<JamesproResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(creds),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as JamesproResponse<T> | null;
  if (!res.ok) {
    const msg =
      (data?.body && typeof data.body === "string" && data.body) ||
      `JamesPRO ${method} ${path} faalde (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  return data ?? {};
}

export type JamesproMe = {
  id: number;
  name: string;
  email: string;
  client?: { id: string; name: string };
};

export async function jamesproMe(creds: JamesproCreds): Promise<JamesproMe> {
  const { body } = await jamespro<JamesproMe>(creds, "GET", "/me/");
  if (!body) throw new Error("Geen gebruiker ontvangen van JamesPRO.");
  return body;
}

export type JamesproCompany = {
  id: number;
  name: string;
  client?: boolean;
  idexternal?: string;
};

export async function jamesproSearchCompanies(
  creds: JamesproCreds,
  name: string,
): Promise<JamesproCompany[]> {
  // JamesPRO's filter[name] matches with LIKE against the given value, so a
  // bare term only matches an exact name. Wrap it in wildcards for partial
  // matches (like the JamesPRO UI); fall back to the literal term if needed.
  const attempts = [`%${name}%`, name];
  for (const term of attempts) {
    const { body } = await jamespro<JamesproCompany[]>(
      creds,
      "GET",
      `/companies/?filter[name]=${encodeURIComponent(term)}&limit=25`,
    );
    if (Array.isArray(body) && body.length > 0) return body;
  }
  return [];
}

export async function jamesproCreateCompany(
  creds: JamesproCreds,
  payload: { name: string; client?: boolean; idexternal?: string },
): Promise<JamesproCompany> {
  const { body } = await jamespro<JamesproCompany>(
    creds,
    "POST",
    "/company",
    payload,
  );
  if (!body?.id) throw new Error("Aanmaken relatie in JamesPRO mislukt.");
  return body;
}

export async function jamesproGetProject(
  creds: JamesproCreds,
  id: number,
): Promise<{
  id: number;
  name?: string;
  user_id?: number;
  company_id?: number;
} | null> {
  const { body } = await jamespro<{
    id: number;
    name?: string;
    user_id?: number;
    company_id?: number;
  }>(creds, "GET", `/project/${id}`);
  return body ?? null;
}

export async function jamesproCreateProject(
  creds: JamesproCreds,
  payload: {
    name: string;
    briefing?: string;
    user_id?: number | null;
    company_id?: number | null;
    contact_id?: number | null;
    date?: string;
    deadline?: string;
  },
): Promise<{ id: number }> {
  const { body } = await jamespro<{ id: number }>(
    creds,
    "POST",
    "/project",
    payload,
  );
  if (!body?.id) throw new Error("Aanmaken project in JamesPRO mislukt.");
  return body;
}

export async function jamesproCreateTask(
  creds: JamesproCreds,
  payload: {
    description: string;
    note?: string;
    user_id?: number | null;
    project_id: number;
    status?: number;
    date?: string;
  },
): Promise<{ id: number }> {
  const { body } = await jamespro<{ id: number }>(
    creds,
    "POST",
    "/task",
    payload,
  );
  if (!body?.id) throw new Error("Aanmaken taak in JamesPRO mislukt.");
  return body;
}
