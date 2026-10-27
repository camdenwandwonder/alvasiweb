# Plan: winkelwagen in de kop, een zijpaneel en een duidelijke afrondpagina

Status: **plan, nog niet gebouwd** (28-10-2026).

Doel: altijd zichtbaar wat er in je winkelwagen zit en wat het kost. Snel iets weghalen of
aanpassen zonder de winkel te verlaten. En een afrondpagina waarop je **vóór** je op de
knop drukt precies ziet wat er gaat gebeuren: wat het van je budget afhaalt, of het ter
goedkeuring gaat en waarom, waar het heen gaat en wanneer het ongeveer komt.

---

## 1. Wat er nu mis is

| Onderdeel | Nu | Probleem |
|---|---|---|
| Kop van de pagina | Alleen een broodkruimel; het aantal staat klein in het zijmenu | Op de winkelpagina zie je niet wat er in je wagen zit of wat het kost; op mobiel helemaal niet |
| Na toevoegen | Een korte melding rechtsboven die vanzelf verdwijnt | Makkelijk te missen; schermlezers melden niets |
| Winkelwagenpagina | Losse kaarten links, kaart "Afrekenen" rechts | "Afrekenen" klopt niet (er wordt niet betaald); het adres is een keuzelijst |
| Over budget | Pas **na** "Bestelling plaatsen" verschijnt een melding en een redenveld | Je moet twee keer klikken en schrikt achteraf |
| Over een maximum | Niet zichtbaar in de winkelwagen; de bestelling wordt stil een aanvraag | Je weet niet dat er goedkeuring nodig is |
| Goedkeuring door functie of drempel | Niet zichtbaar | Idem |
| Leveren | Geen verwachte leverdatum | Medewerkers weten niet wanneer het komt |
| Variant | "Maat: 80 × 200 cm" als ruwe tekst; maat niet te wijzigen | Verkeerde maat? Verwijderen en opnieuw zoeken |
| Verwijderen | Direct weg, niet ongedaan te maken | Per ongeluk is weg |
| Opslag | Alleen in deze browser (localStorage) | Begin je op je telefoon, dan is alles weg op je laptop |
| Prijs of product gewijzigd | Wordt pas bij plaatsen gecontroleerd | Vaag foutbericht; je weet niet welke regel |
| Na plaatsen | Je springt direct naar de bestelpagina | Geen duidelijke bevestiging van wat er nu gebeurt |

**Wat al goed is en blijft:**

- de server rekent bij plaatsen alles opnieuw na (prijs, zichtbaarheid, budget, maxima);
- openstaande aanvragen tellen al mee in het verbruikte budget, dus twee aanvragen kunnen
  samen niet ongemerkt over het budget gaan;
- bij bestellen namens iemand heeft elke medewerker al een eigen winkelwagen.

---

## 2. Wat vergelijkbare systemen doen (onderzoek)

| Bron | Patroon | Overnemen? |
|---|---|---|
| Baymard Institute | Na toevoegen moet je **zien wat je toevoegde** (foto, maat), anders twijfel je; drie duidelijke vervolgstappen: verder winkelen, wagen bekijken, afronden | Ja |
| Baymard | Aantal wijzigen en verwijderen moet makkelijk zijn: −/+ knoppen, geen "Bijwerken"-knop (86% van de sites doet dit fout) | Ja |
| Baymard | **Leverdatum** tonen in plaats van "x werkdagen" (41% laat het weg; een duur laat mensen rekenen) | Ja |
| Baymard | Winkelwagen **bewaren over apparaten** en **bewaren voor later** zijn essentieel | Ja |
| Nielsen Norman Group | **Ongedaan maken** in plaats van een "Weet je het zeker?"-vraag bij verwijderen | Ja |
| Nielsen Norman Group | Geen pop-up voor belangrijke stappen: afronden hoort op een pagina, niet in een paneel | Ja: het paneel is om te bekijken en aan te passen, afronden gebeurt op de pagina |
| Shopify Horizon | Zijpaneel als winkelwagen; instelbaar of het opent bij toevoegen | Ja |
| GOV.UK Design System | **"Controleer je antwoorden"**: één overzichtspagina met blokken en "Wijzig"; knoptekst zegt wat er gebeurt; **bevestigingspagina** met nummer en wat er nu gebeurt | Ja |
| Coupa / Precoro (inkoopsystemen) | Vóór indienen zie je de **goedkeuringsroute** en of het binnen budget valt | Ja |
| Amazon Business | Aanvragen met reden; bij afwijzing een link om de winkelwagen opnieuw te vullen | Ja (later: "opnieuw in winkelwagen" bij afwijzing) |
| Toegankelijkheid (AudioEye, Nic Chan) | Toevoegen moet door schermlezers gemeld worden; een melding die vanzelf verdwijnt is daarvoor niet genoeg | Ja: een vaste meldingsregio + een paneel met focus |

Valkuilen uit hetzelfde onderzoek:

- pas na indienen horen dat het over budget is;
- een knop "Plaatsen" die eigenlijk een aanvraag indient;
- een "ander adres" dat stilletjes goedkeuring vereist;
- het paneel vanzelf laten sluiten;
- eurobedragen tonen aan wie geen prijzen hoort te zien;
- budget en maxima alleen in de browser controleren.

Bronnen: baymard.com (bevestiging na toevoegen, checkout, leverdatum, bewaren, later
bestellen), nngroup.com (bevestigingsvragen, modale vensters), Shopify Horizon,
design-system.service.gov.uk (check answers, button, confirmation pages),
inkoophandleidingen voor Coupa en UGAmart, business.amazon.com, developer.audioeye.com,
nicchan.me (onderzoek 28-10-2026).

---

## 3. Het idee in één zin

> Een **winkelwagenknop in de kop** die altijd laat zien hoeveel en hoeveel het kost.
> Die opent een **zijpaneel** om snel te kijken en aan te passen. Afronden gebeurt op
> **één overzichtelijke pagina** die vooraf vertelt wat er gaat gebeuren.

---

## 4. De knop in de kop

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [menu]  Winkel                                         [ Winkelwagen  3 · € 297,00 ]│
└────────────────────────────────────────────────────────────────────────────┘
```

- **Rechtsboven in de kop, op elke pagina** van de bestelomgeving: winkel, bestellingen,
  start. Op mobiel alleen het icoon met het aantal.
- **Inhoud**:
  - het icoon;
  - het **aantal artikelen** (stuks, niet regels);
  - het bedrag in de eenheid van het bedrijf: "€ 297,00" of "99 credits".
  - Mag de medewerker geen prijzen zien, dan alleen het aantal.
  - Bij een lege winkelwagen alleen het icoon.
- **Bij bestellen namens iemand**: "Winkelwagen van Jan · 3".
- **Na toevoegen**:
  - het aantal "springt" kort (niet als iemand minder beweging wil);
  - de knop in het product wordt even "Toegevoegd";
  - een schermlezer meldt "Polo maat L toegevoegd, 3 artikelen in je winkelwagen";
  - het zijpaneel opent vanzelf, zie beslispunt 1;
  - de huidige korte melding vervalt.

---

## 5. Het winkelwagen-zijpaneel

```
┌─────────────────────────────────────┐
│ Winkelwagen (3)                   × │
│ ─────────────────────────────────── │
│ [foto] Softshell jas Tulsa          │
│        L · Navy                     │
│        [−] 1 [+]          € 99,00   │
│        Verwijderen                  │
│ [foto] Polo Blaklader               │
│        M · Navy                     │
│        [−] 2 [+]         € 138,00   │
│        ! Boven je maximum: nog 1    │
│          van 3. Wordt een aanvraag. │
│ ─────────────────────────────────── │
│ Budget dit jaar                     │
│ ████████████░░░░  na deze bestelling│
│                   nog € 263 over    │
│ Totaal                     € 237,00 │
│ [   Bestelling afronden   ]         │
│ [   Verder winkelen       ]         │
└─────────────────────────────────────┘
```

- **Opent** bij een klik op de knop in de kop, en na toevoegen (beslispunt 1).
- **Per regel**:
  - foto, naam en de variant leesbaar ("L · Navy" in plaats van "Maat: L, Kleur: Navy");
  - een aantal met − en +;
  - "Verwijderen" met **ongedaan maken** ("Polo verwijderd. Ongedaan maken");
  - waarschuwingen direct onder de regel: boven het maximum, niet meer beschikbaar,
    prijs gewijzigd.
- **Onderaan**:
  - een **budgetbalk** met "na deze bestelling nog € 263 over". Gaat het erover, dan in
    oranje met "Dit wordt een aanvraag".
  - Bij maxima zonder budget: "2 producten boven je maximum".
  - Het totaal.
  - Een **hoofdknop "Bestelling afronden"** en daaronder *Verder winkelen*.
- **Leeg**: "Je winkelwagen is leeg", met *Naar de winkel* en, als die er zijn, je drie
  laatst bestelde producten met *Nogmaals*.
- **Toegankelijk**:
  - het paneel krijgt de focus en sluit met Escape;
  - daarna gaat de focus terug naar de knop;
  - het sluit nooit vanzelf;
  - elke knop heeft een eigen naam ("Verwijder Polo M").
- **Mobiel**: volledig scherm, met de knop *Bestelling afronden* vast onderaan.
- **Geen** adres, reden of indienen in het paneel; dat hoort op de pagina.

---

## 6. De afrondpagina (vervangt de huidige winkelwagenpagina)

Titel: **"Bestelling afronden"**. Eén pagina: links de blokken, rechts een overzicht dat
blijft staan tijdens het scrollen. Op mobiel staat het overzicht onderaan en blijft de
knop vast onderin.

```
Bestelling afronden                                    Er is nog niets verstuurd.

┌ 1  Voor wie ─────────────────────────────┐   ┌ Overzicht ────────────────────┐
│ Jan de Vries · Monteur  (namens jou)     │   │ 3 artikelen        € 237,00   │
│ [Wijzig]                                 │   │ Budget dit jaar               │
└──────────────────────────────────────────┘   │ €500 · deze €237 · daarna €263│
┌ 2  Producten ────────────────────────────┐   │ ████████████░░░░              │
│ [foto] Softshell jas Tulsa               │   │                               │
│        Maat [L ▾] · Navy  [−] 1 [+]  € 99│   │ Goedkeuring                   │
│ [foto] Polo Blaklader                    │   │ Gaat ter goedkeuring naar je  │
│        Maat [M ▾]         [−] 2 [+] €138 │   │ leidinggevende, omdat:        │
│   ! Boven je maximum (nog 1 van 3)       │   │ • Polo: boven je maximum      │
│        [Later bestellen]                 │   │                               │
└──────────────────────────────────────────┘   │ Verwacht: 4 – 7 november      │
┌ 3  Levering ─────────────────────────────┐   │                               │
│ (●) Alvasi Nieuwleusen    ( ) Werkplaats │   │ [ Aanvraag indienen ]         │
│     Rollecate 79              Backxlaan  │   └───────────────────────────────┘
│ ( ) Ander adres (vraagt goedkeuring)     │
└──────────────────────────────────────────┘
┌ 4  Opmerking (optioneel) ────────────────┐
└──────────────────────────────────────────┘
```

**Blok 1, Voor wie.** Alleen bij bestellen namens iemand, of voor managers met dat recht:
"Je bestelt voor jezelf" met *Wijzig*. Dit staat bovenaan, omdat budget en maxima
ervan afhangen.

**Blok 2, Producten.**

- De **maat is per regel te wijzigen** met een keuzelijst van de beschikbare maten, met
  "(jouw maat)" erbij. Het aantal gaat met − en +. Alles rekent direct opnieuw, zonder
  "Bijwerken"-knop.
- **Meldingen per regel**, door de server vooraf gecontroleerd:

  | Situatie | Melding | Wat er gebeurt |
  |---|---|---|
  | Boven het maximum | "Je bestelt er 2, je hebt er nog 1 van 3 dit jaar" | Aanvraag, of *Later bestellen* |
  | Boven "maximaal per bestelling" | "Maximaal 5 per bestelling" | Aantal wordt begrensd |
  | Niet meer beschikbaar | "Dit product is niet meer beschikbaar" | Regel valt buiten de bestelling; *Verwijderen* |
  | Prijs gewijzigd sinds toevoegen | "Prijs aangepast van € 89 naar € 99" | Nieuwe prijs telt |
  | Maat bestaat niet meer | "Kies een andere maat" | Keuzelijst open |

- **Later bestellen** verplaatst de regel naar een lijstje "Bewaard voor later" onder de
  producten, met *Terug in winkelwagen*. Handig als het maximum van dit jaar op is.

**Blok 3, Levering.**

- De vaste adressen van het bedrijf staan als **kaartjes** om aan te klikken, het
  standaardadres voorop.
- Het laatste kaartje is **"Ander adres"**. Dat opent een kort formulier en zegt er meteen
  bij: "Een ander adres moet worden goedgekeurd".
- Daaronder de **verwachte leverdatum**, bijvoorbeeld "Verwacht tussen 4 en 7 november".
  Die rekent met de langste levertijd van de producten, in werkdagen, plus een paar dagen
  extra als er goedkeuring nodig is. Zonder ingevulde levertijden staat er niets.

**Blok 4, Opmerking.** Gemarkeerd als optioneel.

**Het overzicht rechts** (blijft staan tijdens het scrollen):

- het aantal artikelen en het totaal, in de juiste eenheid; bij verborgen prijzen alleen
  het aantal;
- **budget**: "Budget dit jaar € 500 · deze bestelling € 237 · daarna nog € 263",
  met een balk. Bij credits hetzelfde in credits;
- **goedkeuring vooraf uitgelegd**:
  - "Gaat direct door"; of
  - "Gaat ter goedkeuring naar je leidinggevende, omdat:", met een lijst van de redenen:
    - boven budget;
    - boven het maximum voor Polo;
    - ander adres;
    - je functie vraagt altijd goedkeuring;
    - boven € 250.
- **reden** (verplicht, met een duidelijke foutmelding): alleen als het boven budget gaat,
  en dan **meteen zichtbaar**, niet pas na een mislukte poging;
- **de knop zegt wat er gebeurt**: *Bestelling plaatsen* of *Aanvraag indienen*. Na één
  klik kan hij niet nog eens; de server negeert een dubbele inzending;
- "Er is nog niets verstuurd" bovenaan, zodat het duidelijk is dat dit een controlestap is.

---

## 7. De bevestigingspagina

Na het plaatsen kom je op een eigen pagina `/bestelling-geplaatst/[nummer]`, die ook
werkt als je hem later opnieuw opent:

- een groot vinkje, met "Bestelling ALV-2026-00128 is geplaatst" of "Je aanvraag is
  ingediend";
- **wat er nu gebeurt**, in drie stappen: *Goedkeuring (als nodig) → In productie →
  Verzonden*, met de verwachte leverdatum;
- het leveradres en het aantal artikelen;
- bij een aanvraag: wie hem beoordeelt en dat je bericht krijgt;
- knoppen *Bekijk bestelling*, *Mijn bestellingen* en *Verder winkelen*.

---

## 8. Techniek

**Eén controle voor vooraf én bij plaatsen.** De regels die nu alleen in
`createOrderFromCart` staan, gaan naar één functie `evaluateCart(items, voor wie)`. Die
gebruikt de pagina voor het overzicht en de meldingen, en het plaatsen gebruikt dezelfde
functie opnieuw op de server. Zo kan het vooraf getoonde nooit afwijken van wat er echt
gebeurt. De functie rekent:

- de actuele prijzen en credits;
- of elk product beschikbaar en zichtbaar is;
- de maxima per regel, en de maxima per bestelling;
- het budget voor en na;
- de goedkeuringsredenen: functie, drempel, budget, maximum en adres;
- de verwachte leverdatum.

**Winkelwagen op de server** (beslispunt 2): een tabel `carts`, met per gebruiker en per
"voor wie" één wagen, met de regels en de "later bestellen"-lijst. De browser houdt een
kopie voor snelheid en synchroniseert op de achtergrond. Bij inloggen op een ander apparaat
staat alles klaar. De bestaande wagen in de browser wordt bij de eerste keer automatisch
overgenomen.

**Dubbel plaatsen voorkomen.** De pagina stuurt een eenmalige sleutel mee; een tweede
inzending met dezelfde sleutel geeft de eerste bestelling terug.

**Onderdelen**:

- `CartButton` (kop);
- `CartDrawer` (zijpaneel);
- `CheckoutPage` met `RecipientBlock`, `CartLines`, `DeliveryCards` en `SummaryCard`;
- `OrderPlaced` (bevestiging);
- de gedeelde server-functie `evaluateCart`;
- de `carts`-tabel met rijbeveiliging (alleen je eigen wagens).

**Toegankelijkheid**: een vaste meldingsregio voor "toegevoegd", focus in het paneel, en
knoppen met eigen namen.

---

## 9. Bouwvolgorde

**Fase 1: altijd zien en snel aanpassen**

1. De knop in de kop met aantal en bedrag, het springende aantal en de schermlezermelding.
2. Het zijpaneel met regels, aantal, verwijderen met ongedaan maken, budgetbalk en de
   twee knoppen.
3. Leesbare varianten overal ("L · Navy").

**Fase 2: de afrondpagina**

4. `evaluateCart` als gedeelde controle, plus een server-actie voor het overzicht vooraf.
5. De pagina met de vier blokken:
   - maat wijzigen per regel;
   - meldingen per regel;
   - adreskaartjes en ander adres;
   - verwachte leverdatum.
6. Het overzicht rechts: budget voor en na, goedkeuring met redenen, de reden direct
   zichtbaar, en de knoptekst die meebeweegt.
7. Dubbel plaatsen voorkomen, en de bevestigingspagina.

**Fase 3: bewaren en later**

8. De winkelwagen op de server, over apparaten heen, met automatische overname.
9. "Later bestellen" (bewaard voor later).
10. Bij een afgewezen aanvraag: *Opnieuw in winkelwagen* op de bestelling.

---

## 10. Beslispunten

1. **Het zijpaneel automatisch openen na toevoegen?**
   Advies: **alleen bij het eerste product per bezoek**. Daarna springt alleen het aantal
   in de kop en wordt de knop even "Toegevoegd". Zo stoort het niet als je meerdere
   producten achter elkaar toevoegt.
2. **De winkelwagen op de server bewaren (alle apparaten)?**
   Advies: **ja**. Iedereen is altijd ingelogd, en beginnen op je telefoon en afronden
   op je laptop is normaal.
3. **"Later bestellen" toevoegen?**
   Advies: **ja**, vooral handig als het maximum van dit jaar op is.
4. **Eigen bevestigingspagina of een melding op de bestelpagina?**
   Advies: **eigen bevestigingspagina** met "wat gebeurt er nu".
5. **Verwachte leverdatum tonen?**
   Advies: **ja**, als een periode ("tussen 4 en 7 november"), alleen als er levertijden
   bij de producten zijn ingevuld.
6. **Bedrag in de kopknop?**
   Advies: **ja op desktop** (aantal + bedrag of credits), **alleen het aantal op
   mobiel** en bij verborgen prijzen.
7. **Gewijzigde prijs sinds toevoegen?**
   Advies: **de nieuwe prijs automatisch gebruiken en dat melden** bij de regel.

### Besluiten (28-10-2026)

1. Zijpaneel opent alleen bij het eerste product per bezoek: **akkoord**.
2. Winkelwagen op de server, op alle apparaten: **ja**.
3. "Later bestellen": **ja**.
4. Bevestigingspagina: **toegelicht met een schets**, wacht op akkoord.
5. Verwachte leverdatum: **nee**. Die vervalt overal: in het overzicht, bij de levering
   en op de bevestigingspagina.
6. Bedrag in de kopknop: **ja**, in euro of in credits als het bedrijf met credits werkt.
   Op mobiel en bij verborgen prijzen alleen het aantal.
7. Gewijzigde prijs: **akkoord**, de nieuwe prijs telt en dat wordt bij de regel gemeld.

## 11. Bewust niet (nu)

- Betalen of een betaalstap: het bedrijf betaalt, er is niets af te rekenen.
- Kortingscodes.
- Een winkelwagen delen met anderen. Bestellen namens iemand dekt dit al.
- Per regel goedkeuren of afwijzen door de leidinggevende. Kan later, naar het voorbeeld
  van Amazon Business.
