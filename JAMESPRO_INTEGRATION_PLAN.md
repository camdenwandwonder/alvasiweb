# JamesPRO Integration — Plan

Automatically create a **project** + a **task** in JamesPRO (Alvasi's CRM) for the
correct **relation/company** whenever an order is placed in Alvasi.

## 1. What the JamesPRO API gives us (research summary)

- **Base URI:** `https://start.jamespro.nl/api` · JSON only · errors/results wrapped in `{ "code", "body" }`.
- **Auth (two steps):**
  1. `POST /auth` with `{ username, password, devicetype }` → `{ key, secret }` (one-time exchange).
  2. Every later request uses **HTTP Basic auth** with `key` as username, `secret` as password.
  We store only `key`+`secret` (never the JamesPRO password after the exchange).
- **Project** — `POST /project`:
  | field | meaning |
  |---|---|
  | `name` | project **title** |
  | `briefing` | project **description** (HTML allowed) |
  | `user_id` | **assignee** (JamesPRO user) |
  | `company_id` | **relation/company link** |
  | `contact_id` | optional contact person |
  | `deadline`, `date`, `status` | optional |
  Returns the created project incl. its `id`.
- **Task** — `POST /task`:
  | field | meaning |
  |---|---|
  | `description` | task **name/text** |
  | `note` | extra task description |
  | `user_id` | **assignee** |
  | `project_id` | **link to the project** (we pass the project id from the step above) |
  | `status` | 0 = open, 1 = done |
- **Company / relation** — `GET /companies?filter[name]=…&limit=…&page=…` (searchable, paginated, 30/page default), `GET /company/:id`, `POST /company`. Each company has `id`, `name`, and an `idexternal` **string** field we can use to store the Alvasi company UUID for robust matching.
- **Contacts** — belong to a company (`company_id`), have name/email; usable for `contact_id`.
- **No `/users` endpoint.** We cannot list JamesPRO employees via the API. `/me` returns only the authenticated API user (`{ id, name, email, client }`). → The **assignee is a configured `user_id` integer** (with a "Test connection" that shows the `/me` user to help confirm).

### Consequences for the design
- **Relation linking is explicit per Alvasi company** (store the JamesPRO `company_id`), not guessed at order time. Optional name-search assist + optional auto-create.
- **Assignee is a configured integer** (global default, optional per-company override), because users aren't listable.
- **Failures must never break checkout** — JamesPRO is called out-of-band and logged.

## 2. Data model (additive Supabase migration, idempotent)

**`integration_jamespro`** (single global row — Alvasi owns one JamesPRO account):
- `enabled boolean default false`
- `auth_key text`, `auth_secret text` — obtained via `/auth`; **server-only**
- `device_type text default 'Alvasi'`
- `default_user_id int` — assignee for projects/tasks
- `trigger_on text default 'approved'` — `approved` | `placed`
- `auto_create_relation boolean default false`
- `project_title_template text`, `project_briefing_template text`
- `task_description_template text`, `task_note_template text`
- `connected_user jsonb` (cache of `/me` for display), `last_tested_at timestamptz`

RLS: **deny all** to normal clients; only the service-role admin client (used in superadmin server actions) reads/writes it. Secrets never reach the browser or git.

**`companies`** += `jamespro_company_id int`, `jamespro_contact_id int`, `jamespro_user_id int` (optional per-company assignee override).

**`jamespro_sync`** (one row per order — idempotency + audit):
- `order_id uuid unique references orders(id) on delete cascade`
- `status text` — `pending` | `success` | `error`
- `jamespro_project_id int`, `jamespro_task_id int`
- `attempts int default 0`, `last_error text`, timestamps
A **unique** `order_id` guarantees an order is synced once; retries update the same row.

## 3. Server-only JamesPRO client — `src/lib/jamespro/client.ts`
- `authenticate(username,password,deviceType)` → `{key,secret}` (used once in settings).
- `jp(method, path, body?)` — Basic-auth fetch, JSON, throws typed errors on non-200.
- `me()`, `searchCompanies(name)`, `getCompany(id)`, `createCompany(payload)`,
  `createProject(payload)`, `createTask(payload)`.
- Reads credentials from `integration_jamespro` via the **admin client**; nothing client-side.

## 4. Templates & tokens (superadmin-controlled)
Title/description/task fields are **templates** with `{{token}}` interpolation, rendered server-side:
`{{order_number}}`, `{{company_name}}`, `{{ordered_by}}`, `{{order_total}}`, `{{order_date}}`,
`{{item_count}}`, `{{items}}` (formatted line list: `2× Polo (Maat M, Navy)`),
`{{delivery_address}}`, `{{note}}`, `{{request_reason}}`, `{{order_url}}` (deep link back to Alvasi).
Sensible Dutch defaults, e.g.:
- Project title: `Bestelling {{order_number}} — {{company_name}}`
- Project briefing: HTML block with ordered items, total, delivery address, besteld door, datum, link.
- Task description: `Verwerk bestelling {{order_number}}`
- Task note: `{{item_count}} artikel(en) · {{order_total}}`

The settings page shows a **live preview** rendered from a sample order.

## 5. Trigger & execution flow (fault-isolated)
1. Order reaches the trigger point (`approved` by default, or `placed`).
2. A `jamespro_sync` row is upserted as `pending` (DB trigger or in the server action).
3. A **Route Handler** `POST /api/jamespro/sync` processes pending rows:
   - resolve relation `company_id` from `companies.jamespro_company_id`
     (if missing: error "bedrijf niet gekoppeld", or auto-create relation when enabled),
   - render templates, `createProject(...)` → get `project_id`,
   - `createTask({ project_id, ... })`,
   - write `success` + ids, or `error` + message; increment `attempts`.
   Invoked (a) fire-and-forget right after checkout (no `await` blocking the user) and
   (b) by a **Vercel Cron** every few minutes as a retry/safety net for `pending`/`error`.
4. Checkout **never throws** because of JamesPRO — all failures land in the sync log.

## 6. Superadmin UX
- **Integratie page** (under Configuratie): connect (username/password/devicetype → stores key+secret),
  "Test verbinding" (shows `/me`), default assignee `user_id` (+ how to find it),
  trigger-point selector, auto-create-relation toggle, the four templates with token reference + live preview, enable switch.
- **Per-company "JamesPRO" tab** (company detail): search the relation by name (`filter[name]`),
  pick → store `jamespro_company_id` (+ optional contact/assignee). Shows linked relation, "ontkoppelen".
  Optional: "maak relatie aan" to POST a new company and store the returned id.
- **Order detail + a sync log**: shows project/task ids (or the error) and a "opnieuw proberen" retry button.

## 7. Security & reliability
- Secrets only in the RLS-denied table, read via admin client in server actions; never committed, never in the client bundle.
- Idempotent (`jamespro_sync.order_id` unique) → no duplicate projects on retries/cron.
- Pagination + name filter for relation search; ISO inputs for dates.
- All applied DB changes shipped as idempotent SQL the superadmin runs in Supabase (Option B).

## 8. Decisions (locked)
1. **Trigger timing → on approval.** Sync fires when an order reaches `approved`
   (and on `approved`→`fulfilled` if it skipped). Pending-approval and declined
   orders never create JamesPRO projects. `trigger_on` fixed to `approved`
   (no UI selector needed in v1).
2. **Assignee → one global user.** A single `default_user_id` for all projects/tasks.
   Drop the per-company `jamespro_user_id` override from v1 (can add later).
3. **Unlinked company → block + log.** If `companies.jamespro_company_id` is null,
   the sync row is set to `error: "Bedrijf niet gekoppeld aan JamesPRO"` with a
   retry button; nothing is created. Drop `auto_create_relation` from v1 (the
   relation-search link UI is the supported path). Manual "maak relatie aan" stays
   available in the company tab as an explicit action, not an automatic fallback.
4. **Briefing → full order detail.** `{{items}}` (lines w/ size/color/qty), total,
   delivery address, besteld door, datum, and `{{order_url}}` deep link.

### Net effect on the model
- `integration_jamespro`: drop `trigger_on` and `auto_create_relation` columns (or
  keep with fixed defaults) — not surfaced in v1 UI.
- `companies`: keep `jamespro_company_id` (+ optional `jamespro_contact_id`); omit
  per-company assignee override.

## 9. Build order (each step ships + is verifiable)
- **A — Connection:** integration table + client + Integratie page (connect, test `/me`, assignee). *Verify: "Verbonden als <name>".*
- **B — Relation linking:** company "JamesPRO" tab with name search → store `jamespro_company_id`. *Verify: link Zieleman to its relation.*
- **C — Templates:** four templates + token renderer + live preview. *Verify: preview matches a sample order.*
- **D — Sync engine:** `jamespro_sync` table, route handler, fire-after-approval + cron retry, order-detail status + retry. *Verify: approve an order → project+task appear in JamesPRO on the right relation; log shows ids.*
