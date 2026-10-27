# Plan: één Personeel-pagina + duidelijker menu

Status: **plan, nog niet gebouwd.** Doel: de vier beheerpagina's **Personeel, Rollen,
Regels & budget en Zichtbaarheid** samenvoegen tot één pagina waarop een manager in één
oogopslag ziet en regelt *wie wat mag bestellen, hoeveel, en wat hij te zien krijgt*.
Plus een helder prijsmodel: euro, credits of aantallen per product, met een duidelijke
rekenregel tussen de europrijs van Alvasi en de credits van de medewerker (§5).

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

## 5. Prijzen, credits en aantallen

Alvasi (superadmin) zet per organisatie de producten klaar met een **europrijs**. Dat
blijft altijd de basis: de factuur en de JamesPRO-koppeling werken in euro's. De
manager bepaalt alleen hoe medewerkers dat **ervaren**.

### 5.1 Wat er nu mis is

- **Credits staan los van de europrijs.** Alvasi vult per product handmatig een
  creditwaarde in. Vergeet Alvasi dat, dan kost het product **0 credits** en is het in
  credit-modus onbeperkt gratis te bestellen.
- **De manager kan niets met credits.** Hij zet de modus aan, maar de creditprijzen en de
  verhouding tot de euro bepaalt alleen Alvasi; een rekenregel bestaat niet.
- **Credits negeren prijsverschillen per variant** (bijvoorbeeld een duurdere XXL).
- **Aantallen-modus toont nooit een prijs**, en producten zonder limiet zijn zonder
  waarschuwing onbeperkt te bestellen.
- **De drie modi sluiten elkaar uit.** "€ 500 per jaar én maximaal 2 jassen" kan niet,
  terwijl dat in uniformprogramma's juist gebruikelijk is. Bij wisselen van modus worden
  bestaande budgetten van de andere soort stil genegeerd.

### 5.2 Wat het onderzoek laat zien

- **Uniformprogramma's** werken met een eurobudget, met vaste **punten per artikel**
  (Gemeente Vught: T-shirt = 1 punt, nieuwe medewerker 64 punten, daarna 34 per jaar),
  of met **aantallen per functie** ("2 shirts per 2 maanden, 1 jas per 2 jaar",
  UniformMarket). Aantallen worden daar **gecombineerd** met een budget, niet als
  aparte modus.
- **Puntenplatforms** (Bonusly, Perkbox, Reward Gateway) gebruiken een **vaste koers**
  (bijv. £ 1 = 10 punten) en raden eenvoudige verhoudingen aan.
- **Medewerkers zien in een creditprogramma nooit euro's**: wie beide ziet, rekent de
  koers terug en het idee van credits verdwijnt. Managers zien wel beide.
- **Valkuilen:** halve credits, **stille devaluatie** (prijsstijging die ongemerkt de
  creditprijs verhoogt, een bekende klacht bij Workhuman), en heel grote getallen
  (duizenden punten maken mensen terughoudend met besteden). Kies tientallen tot lage
  honderden per periode.

Bronnen: UniformMarket, Gemeente Vught (kledingregeling), Bonusly, Perkbox, Reward
Gateway, Adobe Commerce reward points, MangoApps, Mater Health, Workhuman-reviews
(onderzoek 27-10-2026).

### 5.3 Het nieuwe model: twee losse keuzes

In plaats van drie elkaar uitsluitende modi kiest de manager **twee dingen
onafhankelijk** van elkaar:

**Keuze 1: Hoe betalen medewerkers?** (één optie)

| Optie | Medewerker ziet | Budget per periode |
|---|---|---|
| **Geen budget** (bedrijf betaalt alles) | Prijs aan/uit (instelbaar) | Geen |
| **Budget in euro** | Europrijzen | In euro's |
| **Budget in credits** | Alleen credits | In credits |

**Keuze 2: Maximaal aantal per product** (aan/uit, combineerbaar met elk van de drie)

- Per functie (en als uitzondering per persoon): "Jas: max 2 per jaar".
- Instelbaar wat er gebeurt met **producten zonder limiet**: vrij te bestellen, of niet
  te bestellen. (Nu: stilzwijgend onbeperkt.)
- Bij **Geen budget + aantallen** bepaalt de manager met een schakelaar of de prijs
  naast "Nog 1 van 2 dit jaar" getoond wordt. Standaard uit; aanzetten geeft
  kostenbewustzijn. Bij een budget wordt de prijs altijd getoond in de eenheid van het
  budget (anders kan iemand zijn budget niet beoordelen).
- Is het maximum bereikt, dan wordt de knop **"Aanvragen"** (bestaande aanvraagflow
  met reden en goedkeuring).

Je huidige opties blijven zo allemaal mogelijk: euro = "Budget in euro", credits =
"Budget in credits", aantallen = "Geen budget + aantallen". Bestaande instellingen
worden automatisch omgezet.

### 5.4 Hoe credits berekend worden (de rekenregel)

**Eén koers per organisatie**, ingesteld door de manager: **1 credit = € X**.

1. **Creditprijs = europrijs ÷ koers, naar boven afgerond op hele credits.**
   Per variant, dus een duurdere XXL kost ook meer credits. Een regel kost
   aantal × creditprijs per stuk (nooit het regeltotaal apart afronden).
   Belofte aan de klant: N credits kosten nooit meer dan N × € X.
2. **De manager kan per product een eigen creditprijs zetten** (bijv. "alle shirts 25
   credits"). Zo'n product krijgt het label *handmatig*; de rest volgt de koers.
3. **Creditprijzen staan vast** tot de manager ze bijwerkt. Verandert Alvasi een
   europrijs, dan ziet de manager een melding ("Jas: € 99 → € 109, voorstel 99 → 109
   credits") en kiest *nu bijwerken* of *laten staan*. **Nooit stil bijwerken.**
4. **Koers wijzigen** toont eerst een voorbeeld: alle creditprijzen en budgetten worden
   in één keer omgerekend zodat de **eurowaarde gelijk blijft** (budget Monteur
   500 → 1.000 credits bij halvering van de koers). Al geplaatste bestellingen houden
   hun eigen waarde, omdat elke bestelling de koers van dat moment vastlegt.
5. **De app stelt een verstandige koers voor**: zo dat de afronding bij het goedkoopste
   product onder ~5% blijft, en budgetten in tientallen tot honderden credits uitkomen.
   Bijvoorbeeld 1 credit = € 1 bij producten vanaf € 20.

**Wat wordt opgeslagen**
- Creditbudgetten in **hele credits**; eurobudgetten in euro's.
- Elke bestelregel bewaart een momentopname: creditprijs, europrijs en koers. Een
  geannuleerde of afgewezen bestelling telt niet meer mee; het budget komt vanzelf terug.
- De factuur aan de organisatie blijft in euro's, met optioneel een creditkolom.

**Wie ziet wat**
- **Medewerker (credits):** overal alleen credits: winkel, winkelwagen, bestelling,
  e-mails. De budgetbalk toont "320 van 500 credits over, reset 1 januari".
- **Manager:** beide, ook in goedkeuringen en rapportages ("120 credits · € 120").
- **Alvasi/superadmin:** altijd euro's, credits als extra informatie.

### 5.5 Waar de manager dit instelt

In de popup achter **Bestelregels** (de balk bovenaan Personeel), in drie stappen:

```
┌─ Bestelregels ─────────────────────────────────────────────────────┐
│ 1  Hoe betalen medewerkers?                                        │
│    ( ) Geen budget   ( ) Budget in euro   (•) Budget in credits    │
│                                                                    │
│ 2  Creditkoers   1 credit = € [1,00]   (voorstel: € 1,00)          │
│    Rekenvoorbeeld met jullie producten:                            │
│    Jas Verkoop Printer   € 99,00  →  99 credits                    │
│    Werkplaats T-shirt    € 24,95  →  25 credits  (afgerond)        │
│    Iemand met 500 credits kan bijv. 2 jassen + 3 shirts (273)      │
│    [Alle creditprijzen bekijken en aanpassen]                      │
│                                                                    │
│ 3  Maximaal aantal per product      [aan]                          │
│    Producten zonder limiet:  (•) vrij bestellen  ( ) niet bestelbaar│
│    Prijs tonen naast "nog X over":  [uit]  (alleen bij Geen budget) │
│                                                                    │
│    Goedkeuring nodig boven  [ 250 ] credits                         │
└────────────────────────────────────────────────────────────────────┘
```

- **Budgetten en maxima per functie** stel je in bij de functie (tabblad Functies),
  uitzonderingen bij de persoon. De popup bevat alleen wat voor de hele organisatie geldt.
- Het **rekenvoorbeeld** gebruikt de echte producten van de organisatie, zodat de
  manager direct ziet wat de koers betekent.
- De goedkeuringsdrempel volgt de gekozen eenheid (euro of credits).

### 5.6 Rol van Alvasi (superadmin)

- Zet producten en **europrijzen** klaar (ongewijzigd). Het losse veld
  "creditprijs" in de producteditor verdwijnt: credits worden automatisch afgeleid.
- Kan bij een organisatie dezelfde Bestelregels-popup openen om het voor de klant in te
  richten (bijv. bij de start).
- Ziet in de productie en rapportages altijd euro's.

---

## 6. Extra functionaliteit (geprioriteerd)

**Nu meebouwen (maakt het verschil)**
1. "Wat kan Jan?"-samenvatting met herkomst per regel.
2. Budgetverbruik per persoon (balk, oranje vanaf 80%, rood als op).
3. Filters met tellers: inactief, budget bijna op, maat ontbreekt, uitzondering, geen functie.
4. Bulkacties: functie wijzigen, maten instellen, deactiveren.
5. Veilig functie verwijderen (eerst verplaatsen) + wijzigingsvoorbeeld.
6. **"Bekijk de winkel als Jan"**: alleen-lezen voorbeeld van wat Jan ziet en wat
   goedkeuring nodig heeft.

**Daarna (fase 5, los te kiezen)**
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

## 7. Technische aanpak

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
- **Database:** fase 1 en 2 hebben **geen migratie** nodig. De "Alle categorieën"-keuze
  blijft opgeslagen als "geen regels". Het nieuwe prijsmodel (§5) vraagt één migratie:
  - Organisatie-instellingen: `payment_mode` (geen / euro / credits), `credit_rate`,
    `caps_enabled`, `uncapped_products` (vrij / geblokkeerd), `show_price_with_caps`.
    Bestaande `budget_mode` wordt automatisch omgezet (euro → euro, credits → credits,
    aantallen → geen budget + aantallen).
  - `products.credit_cost` wordt de vastgezette creditprijs (hele credits) +
    `credit_cost_manual` (handmatig of volgt koers); `product_variants.credit_cost`
    voor varianten met een eigen prijs.
  - Momentopname van de koers op elke bestelling (`orders.credit_rate`), zodat
    budgetverbruik na een koerswijziging juist blijft.
  - Extra's (geschiedenis, aanvragen, welkomstpakket) vragen later een eigen migratie.
- **Bestel- en budgetlogica (§5):** `getAllowance` wordt opgesplitst in *betaling*
  (budget in euro of credits) en *maxima per product*, die allebei tegelijk kunnen
  gelden. Afrekenen controleert beide; overschrijding blijft een aanvraag met reden.
  Creditprijzen worden server-side berekend en vastgelegd, nooit van de browser
  vertrouwd. Het 0-credits-gat verdwijnt doordat elke prijs een creditprijs heeft.
- **Superadmin:** dezelfde component komt in Bedrijven → bedrijf; de tabbladen
  *Gebruikers*, *Zichtbaarheid* en *Bestelwijze* worden één tabblad *Personeel*.
- **Mobiel:** paneel schermvullend; lijst wordt kaarten.
- **Kleine fixes:** broodkruimels (Nederlands), en de tekst "geldt na opnieuw inloggen"
  wordt correct (de app past rechten direct toe).

---

## 8. Bouwvolgorde (elke fase live en controleerbaar)

| Fase | Inhoud | Controle |
|---|---|---|
| **1** | Groter, gegroepeerd menu; pagina `/personeel` met Bestelregels-balk, tab Medewerkers met filters, budgetbalken en schuifpaneel; doorverwijzingen | Manager-menu heeft 8 items; Jan openen toont "Wat kan Jan?" met juiste budget |
| **2** | Tab Functies: kaarten, paneel met sjablonen, schakelaars in gewone taal, budget, catalogus, medewerkers; veilig verwijderen; wijzigingsvoorbeeld | Functie aanpassen → kaart en medewerkerlijst kloppen direct |
| **3** | Nieuw prijsmodel (§5): betaling + maxima los van elkaar, creditkoers met rekenvoorbeeld, creditprijzen per variant, prijs-schakelaar bij aantallen, wijzigingsvoorbeeld bij koers- en prijswijziging; migratie + omzetting bestaande instellingen | Koers € 1 → shirt € 24,95 toont 25 credits; "€ 500 én max 2 jassen" werkt samen; medewerker in credit-modus ziet nergens euro's |
| **4** | Bulkacties, "Bekijk de winkel als", functies vergelijken, superadmin-hergebruik | Superadmin ziet dezelfde Personeel-tab bij een bedrijf |
| **5** | Keuze uit de extra's van §6 | Per onderdeel |

---

## 9. Beslissingen voor Camden

1. **Naam van de rollen:** "Functies" (begrijpelijker voor een monteur of verkoper) of
   "Rollen" laten staan? Advies: **Functies**.
2. **Budget per functie, uitzondering per persoon** als vaste regel? Advies: **ja**.
3. **Bestelregels als balk** bovenaan in plaats van een eigen tab? Advies: **ja**.
4. **Prijsmodel (§5): betaling en maxima als twee losse keuzes**, zodat "budget én
   maximaal 2 jassen" kan? Advies: **ja**.
5. **Credits afgeleid van een koers**, met handmatige uitzondering per product, in
   plaats van losse creditwaarden die Alvasi per product invult? Advies: **ja**.
6. **Producten zonder limiet** (bij maxima per product): standaard vrij te bestellen of
   niet bestelbaar? Advies: **vrij**, met een duidelijke instelling.
7. **Prijs bij aantallen:** standaard verbergen (aanzetbaar per organisatie)? Advies: **ja**.
8. **Welke extra's uit fase 5** wil je, en in welke volgorde?
9. **Wachtwoord:** handmatig blijven instellen, of (later) resetten via een e-maillink?
