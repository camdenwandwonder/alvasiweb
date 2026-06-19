# Alvasi Platform — Product Plan

> The definitive plan for what we're building and in what order. Read this top
> to bottom; comment on anything. **No further code is written until you sign off.**

---

## 1. The goal

Alvasi is a B2B production house making custom physical products (workwear,
banners, accessories, etc.) for client companies. The platform is the system
Alvasi uses to run that business online, and the **branded ordering portal**
each client company's staff use to order their gear.

In one line: **a configurable product catalog + branded "company stores" +
ordering rules/budgets + production tracking** — modelled on how the leading
company-store / custom-apparel platforms work (OrderMyGear, InkSoft,
uniform-program software), but tailored to Alvasi.

---

## 2. Who uses it, and what each person can do

### Alvasi (the production house)
**Superadmin / Owner** — runs the whole platform:
- Configure the catalog system: **categories**, **size systems & color palettes**, **default rules per category**.
- Onboard **client companies** and set their branding (logo + colors).
- Build each company's **product catalog** (custom products, pricing, images, variants).
- See and manage **all orders** across companies; move them through **production**.
- Manage **artwork proofs**; receive a notification on every order.
- View **reports** (spend, volume) and manage the Alvasi **team**.

*(Later: "Alvasi Operator" sub-role that can handle orders/catalog but not global settings.)*

### Client company
**Manager / Company Admin** — runs their company's store:
- Decide which products/categories staff can see, and the **prices/limits**.
- Manage **people** (invite, deactivate, assign roles).
- Build **custom roles** with granular permissions (a true permissions matrix).
- Set **ordering rules**: require approval (always / over an amount / over a quantity), per-item caps.
- Set **budgets / allowances** per person or role (e.g. €250/year) with live tracking.
- **Approve / reject** orders; see all company orders & reports.
- Edit their own **branding**.

**Approver** *(optional role)* — only approves/rejects orders.

**Member / Personnel** — the everyday user:
- Browse their company's **branded catalog** (image-first), see prices and **budget remaining**.
- Add items to a **cart** and **check out** (respecting rules & budget).
- Track their **orders** through production (Received → In production → Shipped → Delivered).
- Approve **artwork proofs** when required; manage their own **size profile**.

---

## 3. The core idea (why the current version felt shallow)

Two layers with a clean **cascade**:

1. **Global configuration (Alvasi-managed, shared):** Categories, reusable **option sets** (size systems like S–XXL or shoe EU; color palettes with swatches; banner dimensions), and **default rules per category** (needs approval? max qty? needs proof? lead time?).
2. **Per-company catalog:** the actual custom products, which **pick a category** and automatically inherit its standard sizes/colors and default rules — with the ability to override per product.

This is what makes "category is a managed dropdown," "standard sizes per category," and "standard rules per category" real — and it's what was missing.

---

## 4. Full feature set

**Configuration (Alvasi)**
- Categories (CRUD, default rules, which option axes apply, active/inactive, ordering).
- Option sets / size systems / color palettes (CRUD + values, color swatches).
- Global defaults & general settings (platform name, theme, email).

**Catalog & products (Alvasi)**
- Image-first catalog with search & filters (by company, category, status).
- **Full product editor** (a real page, not a cramped form): name, category dropdown, description, status (draft/active/archived); **multi-image gallery** with drag-drop upload, reorder, set primary, per-variant images; **options → variant matrix** (auto-built from the category's sizes/colors) with per-variant SKU/price/stock; pricing; per-product rule overrides.
- **Edit, duplicate, archive, delete** — full lifecycle (the big current gap).

**Storefront & ordering (Member)**
- Branded, image-first product pages with gallery + sequential option pick (color → size) + variant image.
- **Cart + multi-item checkout**; order numbers; totals; ship-to address.
- Order history with live **production status timeline**; reorder.

**Governance (Manager)**
- Permissions **matrix** for custom roles; people management.
- Ordering **rules** (approval thresholds, item caps) that inherit category/global defaults.
- **Budgets/allowances** with enforcement at checkout; **approval queue**.

**Production (Alvasi + visible to company)**
- Order **status pipeline** + a **kanban board** for Alvasi.
- **Artwork/proof approval**: upload a proof, company approves or requests changes, **version history**; blocks production until approved when the product requires it.

**Notifications & intelligence**
- In-app **realtime** notifications (built) + **email** (later).
- Reports/analytics + CSV export; audit log; ⌘K command palette; size profiles & kits.

---

## 5. Information architecture (the sidebar each role sees)

- **Alvasi:** Dashboard · Companies · Catalog · Orders / Production · Reports · **Configuration** · Team
- **Manager:** Dashboard · Shop · Orders · Approvals · People · Roles · Rules & Budgets · Settings
- **Member:** Home · Shop · My orders · My profile

---

## 6. UX / UI principles
Image-first catalog; full-page editors with progressive disclosure (not sidebar
forms); managed **dropdowns** everywhere (categories, sizes, colors with
swatches); **data tables** with search/filter/sort; variant **matrix** with
inline edit; drag-drop media gallery; toasts, skeletons, empty states; ⌘K
palette; fully responsive (mobile drawer); every company's logo + colors applied
throughout. Built on shadcn/ui.

---

## 7. Data model (high level)
Global: `categories`, `option_sets`, `option_values`, `category_option_sets`.
Catalog: `products` (+category, status, price, rules), `product_variants`
(+price/stock), `product_images`, `product_options`.
Commerce/governance/production: `orders` (+number, statuses, totals, ship-to,
production timestamps), `order_items`, `order_events` (timeline), `proofs`
(versions), `order_rules`/`order_limits`, `budgets`, `addresses`, `audit_log`,
`member_sizes`. All company data isolated by Row Level Security.

## 8. Tech stack
Next.js 16 + TypeScript, shadcn/ui + Tailwind, Supabase (Postgres/Auth/Storage/
Realtime/RLS), Vercel, GitHub. Forms: react-hook-form + zod. Tables: TanStack.
Email (later): Resend. **All already set up and deploying.**

---

## 9. Delivery roadmap (phase by phase — you review each on the live site)

| Phase | What you'll get | Fixes |
|---|---|---|
| **A. Configuration + Catalog** | Configuration area (categories, size systems, default rules) **+ full product editor** (edit/duplicate/archive, image gallery, category dropdown, auto sizes → variant matrix, pricing) + image-first catalog & storefront | "can't edit products", "no images", "text category", "no config/rules page", "no standard sizes per category" |
| **B. Commerce core** | Shopping cart + multi-item checkout, order numbers, totals, ship-to, order detail | one-item-only ordering |
| **C. Governance** | Permissions matrix, people management, ordering rules (cascade), budgets/allowances, approval queue | managers can't configure rules/roles/budgets |
| **D. Production house** | Status pipeline + kanban, company status timeline, artwork/proof approval with versions | no production/proofing workflow |
| **E. Intelligence & polish** | Reports/CSV, email notifications, audit log, ⌘K search, size profiles/kits, self-service branding | insight, automation, finish |

---

## 10. What already exists (foundation, deployed)
Accounts + infra (GitHub/Supabase/Vercel); multi-tenant database with security;
auth; per-company branding; sidebar app shell + role dashboards; basic
company/product/user creation; single-item ordering + approve/reject; realtime
order notifications; drag-drop image upload component. **Phase A configuration
back-end exists but is paused pending your sign-off on this plan.**

## 11. Decisions already made (changeable)
- Pricing **and** monetary budgets (not just quantity limits).
- Production **status pipeline + artwork proofs**.
- **Flat** company structure now (departments/locations later).
- Products are **per-company** (custom) but use **global** categories/sizes; a product can be duplicated to another company.

---

## 12. Open questions for you
1. Anything missing from the feature set or roles above?
2. Right phase order — or should something move earlier (e.g. production/proofs before governance)?
3. Should **Members see prices**, or only Managers (some B2B stores hide prices from staff)?
4. Currency — **€ only**, or multiple?
