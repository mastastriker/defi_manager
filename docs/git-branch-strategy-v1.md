# Git Branch Strategie (v1/main)

Diese Richtlinie ist fuer das Projekt `v1` verbindlich.

## 1. Verbindliches Branch-Modell

- `main` = Production (nur stabile, freigegebene Releases)
- `codex/v1` = Development-Integrationsbranch
- Feature-/Fix-Arbeit erfolgt auf Kurzzeit-Branches von `codex/v1`, z. B. `codex/def-63-branch-strategy`

## 2. Operativer Team-Workflow

1. Entwickler erstellt Branch von `codex/v1`.
2. Entwickler implementiert Aenderung und committed lokal in kleinen, nachvollziehbaren Schritten.
3. Jeder lokale Commit wird sofort nach `origin` gepusht (Sofort-Push-Regel; siehe Abschnitt 6).
4. Entwickler erstellt PR gegen `codex/v1`.
5. PR enthaelt den verpflichtenden Sofort-Push-Nachweis (Template + Zeitstempel oder dokumentierte Ausnahme).
6. Entwickler setzt Label `ceo-approved` erst nach expliziter CEO-Freigabe.
7. CTO prueft technisch (Scope, Risiko, Tests) und gibt Merge-Empfehlung.
8. Merge nach `codex/v1` erst nach CEO-Freigabe (Label + explizite Anweisung).
9. Release-Kandidat wird als PR `codex/v1 -> main` erstellt.
10. PR nach `main` wird nur mit expliziter CEO-Freigabe gemerged.

## 3. Kommunikationsregel CTO vs. CEO

Direkt an CTO:

- Technische Rueckfragen (Architektur, Implementierung, Teststrategie)
- Scope-Klaerung innerhalb bestehender Prioritaeten
- Review-Vorbereitung und Merge-Empfehlung

Direkt an CEO:

- Jede explizite Merge-Freigabe fuer `codex/v1` und `main`
- Prioritaets-/Roadmap-Entscheidungen mit Business-Impact
- Ausnahmen von dieser Branch-Richtlinie

## 4. Repo-Settings zur Durchsetzung (GitHub)

Empfohlene Branch Protection fuer `codex/v1` und `main`:

- Require a pull request before merging
- Require status checks to pass: `Branch Strategy Gate`
- Require conversation resolution before merging
- Require approval by Code Owners (CEO als Code Owner)
- Restrict who can push directly to protected branches
- Disallow force pushes und branch deletion

Zusatzregel fuer `main`:

- Erlaube nur PRs mit `head=codex/v1`
- Verbindliches 4-Augen-Prinzip: Approval von CEO und CTO
- Setze `Required approving reviews` auf mindestens `2`

## 5. Finalisierte Entscheidungen (DEF-64)

- Verbindlicher CEO-Account fuer Code-Owner/Review-Pflicht: `mastastriker`
- Fuer `main` gilt verpflichtend das 4-Augen-Prinzip (CEO + CTO)
- Repo-Checks:
  - `.github/CODEOWNERS` mappt CEO verbindlich auf `@mastastriker`
  - `.github/workflows/branch-strategy-gate.yml` erzwingt fuer `main` CEO- und CTO-Approval

## 6. Sofort-Push-Regel (DEF-65, verbindlich)

Ziel: Keine laenger zurueckgehaltenen lokalen Commits. Jede relevante Aenderung soll zeitnah im Remote sichtbar sein.

Verbindliche Regel:

- Nach jedem lokalen Commit muss der Push auf `origin` ohne unnoetige Verzoegerung erfolgen.
- Operative Definition von "sofort": spaetestens innerhalb von 15 Minuten nach Commit oder direkt am Ende eines fokussierten Arbeitsblocks (wenn mehrere Commits in einem zusammenhaengenden Block entstanden sind).
- Langes lokales "Stapeln" von Commits ueber den Arbeitsblock hinaus ist nicht erlaubt.

Verpflichtender Nachweis pro PR:

- PR-Template-Feld "Sofort-Push-Nachweis" muss ausgefuellt sein.
- Enthalten sein muessen UTC-Zeitstempel fuer:
  - ersten lokalen Commit des Arbeitsblocks
  - Push-Zeitpunkt nach dem letzten lokalen Commit
- Falls eine Ausnahme noetig war, muss die Abweichung dort inkl. Grund dokumentiert werden.

Ausnahmefaelle:

- Secret Leak / sensible Daten im Commit:
  - Sofort Push stoppen, CTO informieren, Secret rotieren/revoken.
  - Commit-Historie bereinigen (z. B. amend/rebase/replace), danach bereinigten Stand sofort pushen.
  - Ausnahme im PR-Nachweis dokumentieren.
- Fehlerhafter Commit (z. B. brechender Build):
  - Commit trotzdem sofort pushen, danach unverzueglich Korrektur-Commit pushen.
  - Nur bei kritischem Schaden darf der Push kurz zur Schadensbegrenzung pausieren; Begruendung ist im PR zu dokumentieren.
- Temporaere technische Blocker (z. B. GitHub/Netzwerk stoerung):
  - Nach Ende der Stoerung unverzueglich pushen.
  - Abweichung mit Uhrzeit und Ursache im PR-Nachweis dokumentieren.

Kommunikation und Einhaltung im Team:

- Die Regel wird in Onboarding, PR-Template und Branch-Gate-Check kommuniziert.
- Die Workflow-Pruefung `Branch Strategy Gate` blockiert Merge ohne Sofort-Push-Nachweis.
- CTO prueft bei Reviews die Plausibilitaet der Zeitangaben und dokumentierten Ausnahmen.

## 7. Verbindlicher Release-Flow fuer jedes Ticket (neu, verbindlich)

Ziel: Verhindern, dass lokale Umsetzungen ohne vollstaendige GitHub-Uebergabe als "done" gelten.

Pflichtregel (Default):

- Der Abschluss-Flow fuer umgesetzte Codeaenderungen ist immer: `Commit -> Push -> PR`.
- Ein Ticket darf erst auf `done`, wenn Push erfolgt und PR erstellt ist.

Einzige zulaessige Ausnahme:

- Explizites Ticket-Flag `release_flow=off` im Tickettext oder in einer ausdruecklichen CEO/CTO-Anweisung.
- Ohne dieses Flag bleibt der Release-Flow verpflichtend.

Abschluss-Gate vor `done` (Pflichtfragen):

- "Push erfolgt?"
- "PR erstellt?"

Sind eine oder beide Antworten "nein" und kein `release_flow=off` dokumentiert, bleibt das Ticket `in_progress` oder wird `blocked` mit Begruendung.
