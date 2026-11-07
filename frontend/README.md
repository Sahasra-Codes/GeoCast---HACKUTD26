# GEO — Disaster intelligence frontend

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

The warm ivory, sage, and dusty-blue interface uses locally bundled **Instrument Serif**, including its italic style. The map uses geographic vector tiles and actual state and county polygons, with a geographic latitude/longitude grid.

- Disaster dropdown filters markers and geographic scenario overlays. Types without sample data show an empty state.
- Geographic search covers the bundled states and counties, plus eight explicitly labeled sample city / ZIP locations. Broader city and ZIP geocoding is not connected.
- Twenty population-need chips are organized into five expandable groups. Select multiple needs, choose Match Any or Match All, then press **Find affected areas**. Results use county polygons and camera bounds computed from matching real geography; empty searches do not move the camera randomly.
- Disaster markers open anchored information cards and contextual details. Community selection opens a right-hand panel; it is closed by default to give the map more space.
- Four map layers cover scenario activity, risk estimates, potential unmet needs, and example assistance resources. Overlays can be toggled independently of markers.
- Community panels include illustrative population/exposure, vulnerability indicators, potential needs, model explanations, sample resources, and assistance coordination.
- Demo requests support assignment, status, and delayed-response controls. Changes update locally in the current page session, are included in JSON exports, and reset on reload. Nothing is dispatched.
- Native information dialogs support keyboard focus handling; mobile filters collapse behind a menu button. Map zoom, reset, hover, selection, and camera transitions remain functional.

## Data provenance

**This is a demo, not operational intelligence.** All disaster events, forecast corridors, declaration statuses, community population/exposure figures, vulnerability indicators, model confidence values, potential needs, assistance resources, and requests are synthetic fixtures. They are not verified impact, trained-model outputs, historical disaster records, actual emergency requests, or verified shelters. Missing predictions do not imply low risk. Model categories may overlap and should not be interpreted as unique households.

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

- `GeoDashboard`: application state, filter application, map/detail coordination, export
- `GeoSidebar` / `PopulationNeedFilters`: geography search, disaster selection, needs chips
- `USMap`: MapLibre lifecycle, geographic layers, hover, filtering, and camera controls
- `DisasterMarker` / `DisasterPopup` / `DisasterSymbol`: anchored event interactions
- `CommunityDetailsPanel` / `AssistanceTracker`: community context and editable demo requests
- `RiskHeatmap` / `MapLayerControls`: county choropleths and map layers
- `src/geo.css`: responsive atlas styling

## Browser verification

Playwright checks Instrument Serif loading, marker filtering, floating event cards, county details, Any/All needs matching, empty states, ZIP suggestions, request assignment/status updates, resource layers, source information, snapshot export, and mobile overflow.

On Windows, tests use the installed Google Chrome path by default. Override it with `PLAYWRIGHT_CHROME_PATH`. Elsewhere, install Playwright Chromium with `npx playwright install chromium`. Generated screenshots and reports are ignored by Git.
