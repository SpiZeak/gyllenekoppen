# Gyllene Koppen

Kaffesajt på svenska byggd med [Zola](https://www.getzola.org/) (statiskt innehåll) och
[Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/) + D1
(bryggdagboken med inloggning). Styling via Tailwind CSS v4 med egen färgpalett.

## Arkitektur

```
.
├── compose.yml               # Docker: zola serve + tailwind watch (innehållsdev)
├── zola.toml                 # Zola-konfiguration
├── wrangler.toml             # Cloudflare Pages + D1-binding (DB)
├── schema.sql                # D1-schema (users, sessions, brews)
│
├── content/                  # Markdown-innehåll → URLs
│   ├── kaffe/                # Kaffevarianter (espresso/ som subsection)
│   ├── guider/               # Steg-för-steg-guider
│   └── bryggdagbok.md        # Inloggade sidan (template brew_log.html)
│
├── functions/                # Pages Functions (API)
│   ├── _utils/auth.js        # Sessioner, PBKDF2, rate limit, felhantering
│   └── api/
│       ├── auth/             # setup (första användaren), login, logout, me
│       └── brews/            # CRUD för bryggningar (autentiserat)
│
├── static/                   # Kopieras rakt av till sajten
│   ├── brew-log.js           # Bryggdagbokens klientlogik
│   ├── timer.js / ratio-calc.js / theme-init.js
│   └── fonts/                # Self-hostade woff2 (Montserrat, Playfair Display)
│
├── css/                      # Tailwind-källor (theme, prose, guide, fonts)
├── templates/                # Tera-mallar (macros.html har återanvända kort)
├── tests/                    # Vitest-tester för functions (mock-D1)
└── docker/tailwind/          # Tailwind CLI-image (Bun-baserad)
```

## Förutsättningar

- [Bun](https://bun.sh) (eller Node 18+) för Tailwind, Biome, Vitest och Wrangler
- Docker med Compose v2 — alternativ för Zola/Tailwind utan lokal toolchain
- Zola v0.22.1 lokalt, eller Docker-varianten nedan

## Utveckling

### Innehåll och styling (ingen backend)

```bash
docker compose up
# → http://localhost:1111 (zola serve + tailwind watch)
```

### Fullstack med Functions och lokal D1

```bash
bun install
bun run build:css            # kompilerar static/tailwind.css (minifierad)
zola build                   # eller: docker compose run --rm zola build
bun run db:migrate:local     # applicera schema.sql på lokal D1 (miniflare)
bun run dev                  # wrangler pages dev → http://localhost:8788
```

CSS-watcher under fullstack-dev: `bun run watch:css` i en andra terminal.

Lokal D1-lagring ligger i `.wrangler/state` (gitignorad). Nollställ genom att ta
bort den katalogen och kör `db:migrate:local` igen.

## Databas

`schema.sql` skapar `users`, `sessions` och `brews` med `ON DELETE CASCADE` och
index. Sessions-tabellen lagrar SHA-256-hashen av sessionstoken — aldrig
tokenet i klartext.

```bash
bun run db:create            # engångs: skapa fjärr-D1 (id ska in i wrangler.toml)
bun run db:migrate:remote    # applicera schema på fjärr-D1
```

Notera vid migrering av en befintlig databas: schema.sql ändrades 2026-08-31
(`CASCADE`, index, hashade tokens). Befintliga klartext-sessioner blir ogiltiga
— användare loggar in igen. Tabellerna behöver återskapas för att få nya
FK-villkor.

## Autentisering (design)

- Lösenord hashas med PBKDF2-SHA-256, 100 000 iterationer. OWASP rekommenderar
  600 000, men varje derivation kostar CPU-tid i Workers-runtime; 100k är en
  medveten avvägning för den här hotbilden.
- `/api/auth/setup` skapar endast den första användaren via ett atomiskt
  `INSERT ... WHERE NOT EXISTS` — race-säkert.
- Login/setup rate-limitas (best effort per isolate, 10 försök/15 min per IP).
  Med Cloudflare Turnstile framför endpoints kan skyddet göras hårt.
- Jämförelse av lösenordshash sker i konstant tid.
- `id`/`created_at` på bryggningar genereras server-side; numeriska fält
  tvingas till tal innan lagring.

## Bygg och deploy

```bash
bun run build        # tailwind --minify + zola build → public/
wrangler pages deploy   # eller git-integrerad deploy i Cloudflare-dashboarden
```

## Kvalitet

```bash
bun run lint         # biome check
bun run format       # biome format --write
bun run test         # vitest (functions-logik mot mock-D1)
```

CI (`.github/workflows/ci.yml`) kör lint, tester och en full sitebyggnad på
varje push och PR.

## Licens

MIT
