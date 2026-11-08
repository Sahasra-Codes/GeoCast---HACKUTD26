# 🌎 GeoCast

**Turning disaster data into relief that reaches everyone.**

GeoCast is an AI-assisted disaster intelligence dashboard built for the HackUTD 2026 State Farm challenge, *"The Worst Day, at Scale."* It helps response teams find the communities most at risk of being overlooked by combining live public data with a transparent priority score and an AI-generated relief plan.

> **Demo notice:** Hurricane Marlow is a **fictional** storm used to demonstrate the workflow. County geography, Census figures and resource records come from real public sources. Anything labeled **Simulated** is fictional. GeoCast is a screening tool, not operational emergency guidance.

## Features

- **Map:** active National Weather Service alerts, observed USGS earthquakes, county severity shading, and state/county filters
- **Community filters:** households without vehicles or internet, recent federal declarations, and long-term risk; Census age indicators appear in Insights
- **Insights:** counties ranked by severity, vulnerability and distance to help
- **Relief:** county-specific Gemini relief plans grounded in source records, with general guidance if generation fails
- **Resources:** public shelter, food bank and medical resource data
- **Silent Zone prototype:** a separate six-zone simulated scoring/briefing service retained in `silent-zone/`; this is not real reporting data
- **GEO Guide:** a Gemini-powered chatbot that helps users navigate the dashboard

## How the priority score works

Each alerted county gets a score:

```
S = round(100 × w × (0.55·V + 0.45·A))
```

- **w, alert weight:** NWS severity (Minor to Extreme) ÷ 4, times a certainty factor
- **V, vulnerability:** weighted Census indicators for age 65+, no vehicle, poverty and no internet
- **A, access gap:** mean of `min(nearest distance / 50 miles, 1)` across reported-open shelters, mapped food banks, and hospitals with usable data

The score is computed in code. **Gemini never sets scores or ordering.** It drafts the relief plan; a general preparedness guide is available if Gemini or the local data service fails. The county ranking is computed by the pure `frontend/src/lib/priority.ts` module. Missing resource categories are excluded from the access average. Missing Census inputs or no positioned resource data produce a flagged alert-weight-only score. The table preserves every linked county. These fixed weights are a hackathon screening policy, not a trained or validated triage model.

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, MapLibre GL, Framer Motion
- **Backend:** Python, FastAPI
- **Relief and prototype service:** Node.js 24
- **AI:** Google Gemini API
- **Auth:** Supabase email/password and Google sign-in; sign-in is required to enter the app
- **Testing:** Playwright, Python unittest, and Node.js tests

## Data sources

- [NWS API](https://www.weather.gov/documentation/services-web-api): active alerts
- [OpenFEMA](https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries): disaster declarations
- [Census ACS](https://api.census.gov/data/2024/acs/acs5/variables.html): population indicators
- [FEMA National Risk Index](https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0): long-term risk
- [FEMA Open Shelters](https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/FeatureServer/0) and [OpenStreetMap Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API): reported-open shelters, mapped food banks, and hospitals
- [USGS earthquakes](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson): observed earthquakes in the past 24 hours
- [NWS safety guidance](https://www.weather.gov/safety/hurricane) and Ready.gov: published preparedness guidance
- [Census TIGERweb](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer) and [OpenFreeMap](https://openfreemap.org/): geography and basemap

## Getting started

Run commands from the repository root. Requires **Node.js 24**, **Python 3.11+**, internet access, and a WebGL-capable browser. Windows PowerShell commands are shown below; use `npm` instead of `npm.cmd` on macOS/Linux and the corresponding virtual-environment Python path.

### 1. Install dependencies and configure the project

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm.cmd --prefix silent-zone ci
npm.cmd --prefix frontend ci
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

Set your own values in `backend/.env`:

- `SUPABASE_PROJECT_URL` and `SUPABASE_PUBLISHABLE_KEY`: required for sign-in.
- `CENSUS_API_KEY`: activated Census key for live ACS queries.
- `GEMINI_API_KEY` and `GEMINI_MODEL`: server-side plan generation and chat. Set the model to one available to your key; the example provides the project's configured model name.

The Node service also reads `backend/.env`. Creating `silent-zone/.env` is optional; its values override that shared configuration. Do not copy empty key values into an override file if you want to use the shared keys.

For Supabase, enable your desired email/Google provider and add `http://localhost:5173/login` and `http://127.0.0.1:5173/login` as permitted redirect URLs. Google sign-in also requires the OAuth provider configuration in your Supabase project. The login screen remains visible when authentication is unconfigured; there is no guest bypass.

### 2. Start the three services in separate terminals

**Terminal A - Python API, port 8002:**

```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8002
```

**Terminal B - relief service, port 8001:**

```powershell
npm.cmd --prefix silent-zone start
```

**Terminal C - frontend, port 5173:**

```powershell
npm.cmd --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

Open **http://127.0.0.1:5173** and sign in. The Vite development proxy sends `/api/relief`, `/api/priority`, `/api/briefing`, `/api/advance`, and `/api/dispatch` to port 8001; other `/api` requests go to port 8002.

## Suggested demonstration

1. Open Map, choose Texas and a county if needed, select filters, then press **Apply filters**. Draft filter changes do not move the map.
2. Choose **Hurricane (simulation)** in Disaster type and apply. Only Hurricane Marlow and its assumed weather conditions are fictional. The rotating radar-style image is an illustration, not observed radar. Supporting geography, Census estimates, and resource records are real.
3. Open Insights: Demographics charts, Priority ranking, Severity Radar, and the county map. Compare **Coverage gap** with **Severity only** and expand Evidence for the inputs and source times.
4. Open Resources for real reported-open shelters, mapped food banks/hospitals, FEMA declarations, and official guidance. Empty or failed lookups do not create facilities or imply verified closures.
5. Open Relief, enter city/state and optionally county, and generate a plan. Saved Marlow county plans load immediately; Regenerate requests a fresh plan. Provider failures show general guidance without inventing local facts.
6. Return to Map and apply a real disaster category or All alerts to leave the simulation.

For judges, prepare working sign-in access and a demonstration video. Do not publish account passwords or API keys. `localhost` is a local demo, not a hosted public application; production hosting needs the same API route split and authentication redirect configuration.

## Environment variables

Keep Gemini/Census secrets in server-side `.env` files; never expose them as `VITE_*` variables or commit them. Supabase project URLs and publishable keys are public browser configuration; Supabase secret/service-role keys must stay private.

| Variable | Where | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | `backend/.env`; optional `silent-zone/.env` override | Gemini relief plans and chatbot |
| `GEMINI_MODEL` | same | Optional model override |
| `CENSUS_API_KEY` | `backend/.env` | Census ACS data (key must be activated) |
| `SUPABASE_PROJECT_URL`, `SUPABASE_PUBLISHABLE_KEY` | `backend/.env` | Required public auth configuration |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional `frontend/.env.local` override | Public browser auth configuration |

Without a Gemini key, relief generation and prototype briefings use general/template guidance; the chatbot reports that AI chat is unavailable. Without live county/source data, missing figures stay missing and official directory/general-guidance links remain available.

## Validation

```powershell
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run typecheck
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -q
npm.cmd --prefix silent-zone run typecheck
npm.cmd --prefix silent-zone test
```

Current-flow browser checks, from `frontend/`:

```powershell
npx.cmd playwright install chromium
npx.cmd playwright test tests/login.spec.ts tests/auth-routing.spec.ts tests/insights.spec.ts tests/priority.spec.ts tests/priority-ui.spec.ts tests/resource-hub.spec.ts tests/relief.spec.ts tests/relief-format.spec.ts tests/marlow-ranking.spec.ts tests/marlow-ui.spec.ts tests/area-overview.spec.ts
```

Playwright uses installed Chrome when available on Windows, otherwise its installed Chromium. These tests mock source failures and verify general-guidance fallbacks without dispatching real assistance. Older prototype browser specs are retained and may target previous UI flows; the list above covers the current app.

## Project structure

```
backend/        FastAPI public-data adapters, relief context, chat
frontend/       React + TypeScript dashboard
silent-zone/    Node relief API, Gemini generation, general fallback, and optional simulated-zone prototype
data/scenarios/ Hurricane Marlow scenario, snapshots and ranks
```

## Limitations

- Hurricane Marlow and all Silent Zone values are fictional or simulated.
- Census figures are survey estimates with sampling uncertainty. They show estimated vulnerability, not confirmed need.
- Score weights and thresholds are demo policy, not validated emergency-management triage.
- Resource lookups depend on public sources that can be incomplete or unavailable. Missing results stay missing instead of being invented.
- Before any real deployment, add verified organizational roles on every server endpoint and durable storage.

## Acknowledgments

State Farm and HackUTD 2026, the National Weather Service, FEMA, the U.S. Census Bureau, OpenStreetMap, Google Gemini, and Supabase.
