# GeoCast — Disaster explorer

An interactive geographic atlas for exploring disaster scenarios, community vulnerability, and potential assistance needs. Built with React + TypeScript, Vite, Tailwind CSS, MapLibre GL JS, Framer Motion, and Lucide.

## Run

Requires Node.js 22.12+; Node 24 is recommended.

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Use `npm` instead of `npm.cmd` on macOS/Linux. Vite prints the local URL. The existing `/api` development proxy to FastAPI on port 8000 is preserved.

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:e2e
```

## Design and interactions

The State Farm / GeoCast interface uses a red-and-cream shell around a detailed green geographic map, using **Segoe UI** with Tahoma, Arial, and sans-serif fallbacks. Navigation includes Map, Insights, Resources, and Relief. The supplied `public/geo.png` is used unchanged as GEO, the globe mascot, with a small interactive introduction. The map uses geographic vector tiles and actual state and county polygons.

- The georeferenced **radar simulation** uses a synthetic raster image and geodesic range rings spaced 75 km apart. Six frames support play/pause, keyboard-accessible scrubbing, and independent radar visibility. It follows the selected hurricane scenario. This is a visualization fixture, not observed radar, a NOAA feed, or a meteorological forecast.
- The right-hand Area overview summarizes the selected demo counties and links to example relief resources. Detailed community information opens in a dismissible drawer.
- Disaster dropdown filters markers and geographic scenario overlays. Types without sample data show an empty state.
- Geographic search covers the bundled states and counties, plus eight explicitly labeled sample city / ZIP locations. Broader city and ZIP geocoding is not connected.
- Twenty population-need chips are organized into five expandable, checkable categories. Category checkboxes select or clear the needs in that group. Select multiple needs, choose Match Any or Match All, then press **Apply filters**. Results use county polygons and camera bounds computed from matching real geography; empty searches do not move the camera randomly.
- Disaster markers open anchored information cards and contextual details. Community selection opens a right-hand panel; it is closed by default to give the map more space.
- Four map layers cover scenario activity, risk estimates, potential unmet needs, and example assistance resources. Overlays can be toggled independently of markers.
- Community panels include illustrative population/exposure, vulnerability indicators, potential needs, model explanations, sample resources, and assistance coordination.
- Demo requests support assignment, status, and delayed-response controls. Changes update locally in the current page session, are included in JSON exports, and reset on reload. Nothing is dispatched.
- Native information dialogs support keyboard focus handling; mobile filters collapse behind a menu button. Map zoom, reset, hover, selection, and camera transitions remain functional.

## Data provenance

**This is a demo, not operational intelligence.** All radar intensities, weather animation frames, disaster events, forecast corridors, declaration statuses, community population/exposure figures, vulnerability indicators, model confidence values, potential needs, assistance resources, and requests are synthetic fixtures. They are not verified impact, trained-model outputs, historical disaster records, actual emergency requests, or verified shelters. Missing predictions do not imply low risk. Model categories may overlap and should not be interpreted as unique households.

Real geography is bundled as `public/data/us-counties.topo.json` from [US Atlas v3](https://github.com/topojson/us-atlas), derived from US Census Bureau 2017 cartographic boundaries. These may differ from current county definitions. Map labels, roads, and coastlines use [OpenFreeMap](https://openfreemap.org/quick_start/), OpenStreetMap, and OpenMapTiles; attribution appears on the map. The customized basemap style lives in `src/data/basemap.json`. No API key is needed. Detailed tiles require internet access; bundled US polygons remain available when basemap details fail. WebGL/hardware acceleration is required.

## Future FastAPI integration

Leave `VITE_API_BASE_URL` unset for the bundled demo. To connect a future backend, copy `.env.example` to `.env.local`, set the base URL, and restart Vite. The service requests `GET {VITE_API_BASE_URL}/intelligence`. Setting the base to `/api` uses the existing development proxy.

The response must match `IntelligenceData` in `src/types.ts`:

```typescript
{
  mode: 'demo' | 'connected',
  updatedAt: string, // ISO 8601
  events: DisasterEvent[],
  predictions: RiskPrediction[],
  resources: AssistanceResource[]
}
```

County identifiers are five-character FIPS strings. Coordinates are WGS 84 `[longitude, latitude]`. Events support optional affected county IDs, forecast lines, closed impact-zone polygon rings, and declaration status. A configured backend failure displays an error instead of silently substituting mock data. The backend must provide suitable CORS configuration. `VITE_*` variables are public browser configuration, never secrets.

`src/services/api.ts` owns data loading and geography conversion. `src/data/geo.ts` contains the separate synthetic community profiles, requests, search fixtures, and typed filters. These local demo profiles and requests remain synthetic even if an event/prediction backend is configured. Replace those fixtures and review all provenance labels before production use. NOAA/NWS, NHC, OpenFEMA, Census, CDC SVI, and ML integrations are not implemented.

## Components

- `GeoDashboard`: application state, GeoCast navigation, filtering, radar playback, map/detail coordination, export
- `RadarOverlay`: synthetic georeferenced image source and real geographic range rings
- `AreaOverview`: demo impact summary, tab-specific results, relief resources, and the supplied GEO mascot
- `GeoSidebar` / `PopulationNeedFilters`: geography search, disaster selection, needs chips
- `USMap`: MapLibre lifecycle, geographic layers, hover, filtering, and camera controls
- `DisasterMarker` / `DisasterPopup` / `DisasterSymbol`: anchored event interactions
- `CommunityDetailsPanel` / `AssistanceTracker`: community context and editable demo requests
- `RiskHeatmap` / `MapLayerControls`: county choropleths and map layers
- `src/geo.css`: shared map/details styles; `src/geocast.css`: responsive GeoCast theme

## Browser verification

Playwright checks the GeoCast layout, supplied mascot loading and interaction, radar playback and scrubbing, theme switching, Segoe UI typography, marker filtering, floating event cards, county details, Any/All needs matching, empty states, ZIP suggestions, request assignment/status updates, resource layers, source information, snapshot export, and mobile overflow.

On Windows, tests use the installed Google Chrome path by default. Override it with `PLAYWRIGHT_CHROME_PATH`. Elsewhere, install Playwright Chromium with `npx playwright install chromium`. Generated screenshots and reports are ignored by Git.

## GEO Guide chatbot (from Prapti)

The chatbot component and FastAPI chat route were integrated from Prapti commit `6dfc2d8`. The existing GeoCast layout, Segoe UI typography, and `public/geo.png` mascot are retained. Its shortcuts open the sidebar search, switch to the Resources tab, and open About the data.

Start the backend from the repository root:

```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload
```

A local virtual environment and backend dependencies are installed in this checkout. For a fresh clone, create a venv with `python -m venv backend/.venv`, then run `backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt`.

Copy `backend/.env.example` to `backend/.env` and add `GEMINI_API_KEY` for general AI answers. `GEMINI_MODEL` is configurable. Basic greetings and website/filter/resource help work without a key when the backend is running; general questions return an explicit configuration error until a key is supplied. Real Gemini calls have not been verified with credentials.

Chat posts to `/api/chat` through the existing Vite proxy. `VITE_CHAT_API_BASE_URL` can override its origin independently of the intelligence-data API. A direct cross-origin backend requires suitable CORS configuration. Keep API keys in backend configuration, never in public `VITE_*` variables. Failed chat requests preserve the user's text for retry.

## Public sources

Public sources is now the default workspace. Use the Data mode bar or `/?mode=demo` to explicitly choose synthetic scenarios. The public view never uses demo exposure, risk predictions, requests, or radar. Start FastAPI as described above.

- `/api/public/state/TX`: NWS active warnings (2-minute cache), up to 200 recent OpenFEMA declaration records, Census TIGERweb 2024 county polygons, and FEMA NRI county context. State selection supports US states, DC, and Puerto Rico. The UI refreshes visible public workspaces every two minutes and on return to the tab.
- `/api/public/county/48201`: ACS 2024 five-year population, households, no-vehicle households, and no-internet households; count MOEs; up to 100 county declaration records; county NRI. Census queries currently require an activated `CENSUS_API_KEY` in `backend/.env`. Missing or suppressed values remain missing. Percentages use their respective table universes, not a substitute household denominator.
- `/api/public/boundaries/tracts/48201`: actual 2024 TIGERweb tract geometry, loaded on request. County and tract polygons are simplified for map display (about 22 meters). The national context still uses the labeled bundled 2017 US Atlas boundaries.

Every source carries its own classification, retrieval time, vintage description, and availability/error status. Live alerts preserve official severity, timing, affected-area text, and instructions. Alerts without issued geometry use linked county shading as an explicitly approximate area; alerts without geographic identifiers remain visible in the list. FEMA declarations are historical county records, not unique disaster totals. NRI is long-term relative risk/resilience context, never current flood severity or an AI prediction. ACS population is never labeled as exposed population. Recent declaration results are limited and the UI identifies that limit.

Sources: [NWS API](https://www.weather.gov/documentation/services-web-api), [OpenFEMA](https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries), [Census TIGERweb 2024](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer), [ACS 2024 variables](https://api.census.gov/data/2024/acs/acs5/variables.html), [FEMA NRI county service](https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0). The old NRI downloadable ZIP URL redirected to another FEMA page during verification; the application uses the published FEMA GIS service instead.

Backend verification: `backend/.venv/Scripts/python.exe -m unittest discover -s backend/tests -v`.

## Authentication UI from Arpita

Login, session restoration, Google OAuth with PKCE, and sign-out were imported from Arpita commit `ca2d11e` and adapted to GeoCast, Segoe UI, and `geo.png`. Visit `/login` or use Sign in in the header. The public map remains accessible without an account.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `frontend/.env.local`, or the corresponding `SUPABASE_PROJECT_URL` and `SUPABASE_PUBLISHABLE_KEY` in `backend/.env`, then restart Vite. Only those explicitly allowlisted public identifiers are exposed to the browser. Enable Google in Supabase Auth and allow your frontend `/login` URL as an OAuth redirect. Without configuration, the form is shown with an explicit message and disabled sign-in buttons. Existing hosted sign-ins have not been tested against a real project.

`tests/auth.spec.ts` uses mocked Supabase requests. Run it with `GEOCAST_TEST_AUTH=1`, `VITE_SUPABASE_URL=https://geocast-test.supabase.co`, and `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_only` in an isolated test process. Normal UI tests use the unconfigured state.


## Silent Zone responder demo

Open **Insights** for deterministic prioritization of six fictional zones, the simulated clock, score explanations and briefing generation. **Relief** shows dispatched zones. Existing map, navigation, sources, authentication and chatbot remain in place. All Silent Zone values and assignments are simulated.

Start the Node 24 service in a separate terminal:

```powershell
cd ../silent-zone
npm.cmd install
npm.cmd start
```

The existing Vite server proxies the four Silent Zone routes to port 8001; other API routes still use the Python backend on port 8000. Configure the optional server-only Gemini key/model in `silent-zone/.env`; otherwise a labeled template briefing is returned. See [Silent Zone setup, API and tests](../silent-zone/README.md). State resets on Node restart. This loopback demo does not enforce organizational staff roles; enforce them server-side before deployment.
