# Plan: één Personeel-pagina + duidelijker menu

Status: **plan, nog niet gebouwd.** Doel: de vier beheerpagina's **Personeel, Rollen,
Regels & budget en Zichtbaarheid** samenvoegen tot één pagina waarop een manager in één
oogopslag ziet en regelt *wie wat mag bestellen, hoeveel, en wat hij te zien krijgt*.

---

## 1. Wat er nu mis is

De vier pagina's beantwoorden samen één vraag: *"Wat kan deze medewerker bestellen?"*.
Maar het antwoord staat verspreid, en de manager moet de puzzel zelf leggen.

| Pagina | Wat er nu staat | Probleem |
|---|---|---|
| Personeel | Lijst met naam, rol, status, maten | Je ziet niet wat iemand mag of nog over heeft aan budget |
| Rollen | Lijst met "15 rechten"; aparte bewerkpagina met technische vinkjes | Je ziet niet wie de rol heeft, wat het budget is of welke producten de rol ziet |
| Regels & budget | Bestelwijze, drempel, budgetten via losse keuzelijsten (rol/gebruiker) | Los van de mensen; geen verbruik zichtbaar |
| Zichtbaarheid | Per categorie vinkjes per rol | "Geen vinkje = iedereen" is verwarrend; vinkje **Manager** doet niets (managers zien altijd alles); broodkruimel toont Engels "Visibility" |

Gevonden fouten die het plan meteen oplost:
- **Rol verwijderen sloopt stil gebruikers:** `profiles.role_id` wordt leeg, die
  medewerkers verliezen al hun rechten en kunnen niets meer. Budgetten die aan de rol
  hingen blijven verweesd in de database achter.
- **Zichtbaarheid voor Manager is schijnkeuze:** wie alle bestellingen mag zien, ziet in
  de winkel de volledige catalogus. Het vinkje suggereert iets dat niet gebeurt.
- **Menu:** knoppen zijn 32px hoog met 16px-iconen; 11 items in één platte lijst.

---

## 2. Wat vergelijkbare systemen doen (onderzoek)

| Systeem | Patroon | Overnemen? |
|---|---|---|
| Payhawk, Ramp | Eén **beleid** per groep bundelt limiet + goedkeuringsregel; een kaart kiest beleid óf eigen limiet | Ja: een **functie** bundelt rechten, budget, goedkeuring en catalogus |
| Spendesk | Standaardregel + uitzondering per persoon, **maximaal één regel per persoon per soort** | Ja: geen twijfel welke regel geldt |
| Brex | Budget per persoon (eenmalig of terugkerend); medewerker kan **verhoging aanvragen** | Later: "meer budget aanvragen" |
| Google Workspace | Bij een persoon: elk recht met **"via rol X"** | Ja: "Wat mag Jan?"-blok met herkomst per regel |
| Linear, Slack | Eén ledenlijst met filters; **deactiveren boven verwijderen**, geschiedenis blijft | Ja (deels al gebouwd) |
| Personio | Rechten alleen via rollen; controleren door **"inloggen als"** | Ja, veilig: **"Bekijk de winkel als Jan"** |
| GitHub | Eigen rol bouwen vanaf een **basisrol** (sjabloon) | Ja: sjablonen Medewerker / Leidinggevende / Beheerder |
| Experlogix (uniformen) | **Starterspakket** per functie bij indiensttreding, maten per medewerker | Later: welkomstpakket |
| Shopify B2B | Te grove vaste rechten → klanten klagen | Valkuil: onder de motorkap fijnmazig houden |
| UniformMarket | Onduidelijk hoe functie- en persoonsquota samengaan | Valkuil: altijd tonen welke regel wint |

Bronnen: Payhawk, Spendesk, Brex, Ramp, Pleo, Google Workspace, Linear, Slack, Personio,
GitHub, Shopify B2B, UniformMarket, Experlogix help-/productpagina's (onderzoek 27-10-2026).

---

## 3. Het idee in één zin

> Een **functie** (nu "rol") is een pakket: wat iemand mag, hoeveel budget hij heeft,
> of zijn bestellingen goedgekeurd moeten worden, en welke producten hij ziet.
> Een **medewerker** krijgt een functie en eventueel een zichtbare **uitzondering**.

Daaruit volgt de indeling: **mensen eerst** (de dagelijkse vragen gaan over personen:
"kan Piet een jas bestellen?"), **functies tweede** (daar stel je het één keer in),
**bedrijfsregels als compacte balk** (verander je zelden).

---

## 4. Ideale layout

### 4.1 Paginaopbouw (`/personeel`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Personeel                                         [+ Nieuwe medewerker]  │
│ Beheer wie wat mag bestellen, hoeveel, en wat ze zien.                   │
├──────────────────────────────────────────────────────────────────────────┤
│ Bestelregels: Budget in euro · Goedkeuring boven € 250 · reset 1 jan     │
│                                                          [Wijzigen]      │
├──────────────────────────────────────────────────────────────────────────┤
│  Medewerkers (24)   Functies (4)                                         │
├──────────────────────────────────────────────────────────────────────────┤
│ [Zoek…]  Functie ▾   Filters: Inactief 2 · Budget bijna op 3 ·           │
│                               Maat ontbreekt 5 · Uitzondering 1          │
├──────────────────────────────────────────────────────────────────────────┤
│ ☐ Naam            Functie     Budget dit jaar       Maten   Status       │
│ ☐ Jan Jansen      Monteur     ██████░░ € 320/€ 500  M · 42  Actief    ›  │
│ ☐ Piet de Vries   Verkoop     █████████ € 490/€ 500  L      Actief    ›  │
│ ☐ Anna Smit       Monteur     ░░░░░░░ € 0/€ 500      —      Actief    ›  │
└──────────────────────────────────────────────────────────────────────────┘
  Bij selectie: [Functie wijzigen] [Maten instellen] [Deactiveren]
```

- **Bestelregels-balk** bovenaan vervangt de hele pagina "Regels & budget" voor de
  bedrijfsbrede instellingen (bestelwijze en goedkeuringsdrempel). "Wijzigen" opent een
  popup met de drie bestelwijzen als uitlegkaarten en de drempel.
- **Twee tabbladen**, met deelbare URL (`/personeel?tab=functies`).
- **Alleen velden van de actieve bestelwijze**: in euro-modus geen credits- of
  stuks-velden; in stuks-modus toont de kolom "Budget" bijvoorbeeld "Jas 1/2 · Shirt 3/5".

### 4.2 Medewerker-paneel (schuift rechts in, lijst blijft zichtbaar)

```
┌─ Jan Jansen ─────────────────────────────── ✕ ┐
│ jan@zieleman.nl · Actief                       │
│ Functie: [Monteur ▾]                           │
├────────────────────────────────────────────────┤
│ Wat kan Jan?                                   │
│ ✓ Bestellen uit Kleding, Reclame  (via Monteur)│
│ ✓ € 180 over van € 500, reset 1 jan (Monteur)  │
│ ! Bestellingen boven € 250 → goedkeuring       │
│   (bedrijfsregel)                              │
│ ✗ Ziet geen bestellingen van anderen           │
│ [Bekijk de winkel als Jan]                     │
├────────────────────────────────────────────────┤
│ Budget                                         │
│ Volgt functie Monteur (€ 500 per jaar)         │
│ [Eigen budget instellen]  ← maakt uitzondering │
├────────────────────────────────────────────────┤
│ Standaardmaten   Kleding M · Schoenen 42 [✎]   │
├────────────────────────────────────────────────┤
│ Recente bestellingen                           │
│ ALV-2026-00004 · 24 jun · € 101,50 · Productie │
├────────────────────────────────────────────────┤
│ Account  [Gegevens] [Wachtwoord] [Deactiveren] │
└────────────────────────────────────────────────┘
```

- Het **"Wat kan Jan?"-blok** is de kern: één leesbare samenvatting, elke regel met
  herkomst ("via Monteur", "persoonlijke uitzondering", "bedrijfsregel").
- **Uitzondering** krijgt een badge in de lijst en een link "Terug naar functie".
- Maximaal **één budgetregel per persoon** (Spendesk-principe).

### 4.3 Tab Functies (kaarten)

```
┌ Monteur ──────────────────────┐ ┌ Verkoop ───────────────────────┐
│ Kan bestellen voor zichzelf.  │ │ Kan bestellen voor zichzelf.   │
│ ●●●● 18 medewerkers           │ │ ●● 4 medewerkers               │
│ Budget  € 500 per jaar        │ │ Budget  € 300 per jaar         │
│ Ziet    Kleding · Reclame     │ │ Ziet    Iedereen               │
│ Goedkeuring  alleen > € 250   │ │ Goedkeuring  altijd            │
└───────────────────────────────┘ └────────────────────────────────┘
[+ Nieuwe functie]                     [Functies vergelijken]
```

Klik op een kaart → zelfde schuifpaneel, met vijf secties:

1. **Algemeen:** naam en één zin uitleg.
2. **Wat mag deze functie?** Start vanaf een sjabloon (*Medewerker*, *Leidinggevende*,
   *Beheerder*), daarna schakelaars in gewone taal, gegroepeerd onder *Bestellen*,
   *Team* en *Instellingen*. Afhankelijkheden gaan automatisch (wie mag goedkeuren,
   ziet ook alle bestellingen).
3. **Bestellen:** goedkeuring altijd / boven drempel / nooit; budget per periode, of
   per product (alleen de velden van de actieve bestelwijze).
4. **Catalogus:** per categorie aan/uit, met een expliciete keuze **"Alle categorieën"**.
   Voor functies met beheerrechten: "Ziet altijd de volledige catalogus" in plaats van
   een nutteloos vinkje.
5. **Medewerkers:** wie deze functie heeft, met verplaatsen.

Veiligheid:
- **Wijzigingsvoorbeeld** vóór opslaan: "Dit verandert het budget van 18 medewerkers."
- **Verwijderen** kan pas als de medewerkers naar een andere functie zijn verplaatst
  (in hetzelfde venster); verwijzende budgetten en zichtbaarheid worden opgeruimd.
- **Functies vergelijken:** tabel met functies als kolommen, voor wie het overzicht wil.

### 4.4 Menu (alle portalen)

- Knoppen **40px** hoog (nu 32), tekst **15px**, iconen **20px**, iets meer ruimte.
- **Groepering** met kopjes:
  - *Bestellen:* Start, Winkel, Winkelwagen, Bestellingen
  - *Beheer:* Goedkeuringen, Personeel, Instellingen
- **Tellers** bij Goedkeuringen (wachtend) en Winkelwagen.
- Manager-menu gaat van **11 naar 8** items; medewerkers houden hun korte menu.
- Zelfde verbetering in het superadmin-menu.

---

## 5. Extra functionaliteit (geprioriteerd)

**Nu meebouwen (maakt het verschil)**
1. "Wat kan Jan?"-samenvatting met herkomst per regel.
2. Budgetverbruik per persoon (balk, oranje vanaf 80%, rood als op).
3. Filters met tellers: inactief, budget bijna op, maat ontbreekt, uitzondering, geen functie.
4. Bulkacties: functie wijzigen, maten instellen, deactiveren.
5. Veilig functie verwijderen (eerst verplaatsen) + wijzigingsvoorbeeld.
6. **"Bekijk de winkel als Jan"**: alleen-lezen voorbeeld van wat Jan ziet en wat
   goedkeuring nodig heeft.

**Daarna (fase 4, los te kiezen)**
7. **Meer budget aanvragen** vanuit de winkel, met goedkeuren in één klik.
8. **Welkomstpakket** per functie: eenmalig budget of producten bij indiensttreding,
   plus verzoek om maten in te vullen.
9. **Wijzigingsgeschiedenis** per persoon en functie ("Marieke wijzigde budget van
   € 300 naar € 400 op 12-10") — vereist een nieuwe tabel.
10. **Excel/CSV-import** van medewerkers met proefrun ("24 nieuw, 2 dubbel").
11. **Uitnodigen per e-mail** en wachtwoord-reset via link (vereist e-mail via Resend).
12. **Maandelijkse samenvatting** per mail: wie bijna door budget heen is, wie nog
    nooit bestelde, ontbrekende maten.
13. Optioneel: naar rato budget voor nieuwe medewerkers; restant meenemen.

---

## 6. Technische aanpak

- **Route:** nieuwe pagina `/personeel` met `?tab=medewerkers|functies` en
  `&id=…` voor het open paneel (deelbaar, terugknop werkt). Oude routes
  `/people`, `/roles`, `/roles/[id]`, `/budgets`, `/visibility` worden doorverwijzingen.
- **Rechten per onderdeel:** `users.view` → Medewerkers; `roles.manage` → Functies;
  `settings.manage` → Bestelregels-balk en de budget/catalogus-secties.
- **Hergebruik:** `UsersManager` (lijst + popups), `user-admin-actions`,
  `BudgetSettingsPanel`-logica (opgesplitst), `UserSizesDialog`.
- **Nieuw:**
  - `getCompanyAllowances(companyId)`: berekent budgetverbruik voor álle medewerkers in
    één query (nu per persoon één query → te traag voor een lijst).
  - `saveRole(roleId, …)`: rechten, goedkeuring, budget en catalogus in één keer.
  - `reassignAndDeleteRole(roleId, targetRoleId)`.
  - Schuifpaneel-component (de Sheet uit de bestaande sidebar-bibliotheek).
- **Database:** de kernversie heeft **geen migratie** nodig. De "Alle categorieën"-keuze
  blijft opgeslagen als "geen regels". Alleen extra's (geschiedenis, aanvragen,
  welkomstpakket) vragen later een migratie.
- **Superadmin:** dezelfde component komt in Bedrijven → bedrijf; de tabbladen
  *Gebruikers*, *Zichtbaarheid* en *Bestelwijze* worden één tabblad *Personeel*.
- **Mobiel:** paneel schermvullend; lijst wordt kaarten.
- **Kleine fixes:** broodkruimels (Nederlands), en de tekst "geldt na opnieuw inloggen"
  wordt correct (de app past rechten direct toe).

---

## 7. Bouwvolgorde (elke fase live en controleerbaar)

| Fase | Inhoud | Controle |
|---|---|---|
| **1** | Groter, gegroepeerd menu; pagina `/personeel` met Bestelregels-balk, tab Medewerkers met filters, budgetbalken en schuifpaneel; doorverwijzingen | Manager-menu heeft 8 items; Jan openen toont "Wat kan Jan?" met juiste budget |
| **2** | Tab Functies: kaarten, paneel met sjablonen, schakelaars in gewone taal, budget, catalogus, medewerkers; veilig verwijderen; wijzigingsvoorbeeld | Functie aanpassen → kaart en medewerkerlijst kloppen direct |
| **3** | Bulkacties, "Bekijk de winkel als", functies vergelijken, superadmin-hergebruik | Superadmin ziet dezelfde Personeel-tab bij een bedrijf |
| **4** | Keuze uit de extra's van §5 | Per onderdeel |

---

## 8. Beslissingen voor Camden

1. **Naam van de rollen:** "Functies" (begrijpelijker voor een monteur of verkoper) of
   "Rollen" laten staan? Advies: **Functies**.
2. **Budget per functie, uitzondering per persoon** als vaste regel? Advies: **ja**.
3. **Bestelregels als balk** bovenaan in plaats van een eigen tab? Advies: **ja**.
4. **Welke extra's uit fase 4** wil je, en in welke volgorde?
5. **Wachtwoord:** handmatig blijven instellen, of (later) resetten via een e-maillink?
