# Sentinel frontend

A full-screen disaster intelligence workspace built with React + TypeScript, Vite, Tailwind CSS, MapLibre GL JS, Framer Motion, and Lucide.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended).

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

On macOS/Linux, use `npm` in place of `npm.cmd`. Open the URL Vite prints.

```powershell
npm.cmd run build
npm.cmd run preview
npm.cmd run typecheck
npm.cmd run lint
```

## What works

- Key-free dark vector basemap with roads, coastlines, and geographic labels.
- Bundled, geographically accurate US state and county boundaries; state selection at national zoom and county selection after zooming in.
- Five synthetic disaster scenarios with animated, keyboard-accessible markers and anchored information cards.
- A simulated hurricane path and impact corridor, highlighted scenario counties, and an illustrative declaration status.
- Four switchable layers: disaster activity, county risk estimates, unmet needs, and example assistance locations.
- County risk colors use actual county polygons, never rectangular placeholder regions. Only the 15 counties with synthetic predictions are colored. Unmodeled counties explicitly display no prediction.
- Geographic search across the bundled states and counties, camera transitions, selected-area outlines, map controls, contextual insights, source settings, and JSON snapshot export.
- Responsive mobile layout, reduced-motion CSS, a native modal with focus handling, and data loading/error states.

**Demo data is not live.** All disaster events, impact corridors, exposure counts, vulnerability percentages, needs, resources, and confidence figures are synthetic. They are neither historical records nor outputs of a trained model. Assistance locations are examples, not verified shelters or services. Missing predictions do not imply low risk. Do not use the demo for operational decisions.

## Geography and basemap

The bundled `public/data/us-counties.topo.json` is [US Atlas v3](https://github.com/topojson/us-atlas), derived from US Census Bureau 2017 cartographic boundaries. Boundaries may differ from current county definitions. Attribution appears on the map and in Data & settings.

The customized `src/data/basemap.json` derives from [OpenFreeMap Dark](https://openfreemap.org/quick_start/). Map tiles, glyphs, and sprites are served by OpenFreeMap, using OpenStreetMap / OpenMapTiles data. No API key is required. An internet connection is needed for detailed basemap tiles. If tiles fail, bundled US polygons remain available; a notice identifies the reduced-detail mode. WebGL and browser hardware acceleration are required for the interactive map.

## Future FastAPI integration

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL`, then restart Vite. Without this variable, the app uses the bundled demo adapter. A configured backend failure displays an error instead of silently falling back to simulated data.

The service requests `GET {VITE_API_BASE_URL}/intelligence`. The response must match `IntelligenceData` in `src/types.ts`:

```typescript
{
  mode: 'demo' | 'connected',
  updatedAt: string, // ISO 8601
  events: DisasterEvent[],
  predictions: RiskPrediction[], // countyId is a five-character FIPS string
  resources: AssistanceResource[]
}
```

`DisasterEvent` supports optional `forecast` (a longitude/latitude line), `impactZone` (a closed longitude/latitude polygon ring), and `declarationStatus`. All coordinates use WGS 84 `[longitude, latitude]`. The backend must allow CORS for the frontend origin. Do not put secrets in `VITE_*` variables; they are public browser configuration.

`src/services/api.ts` owns loading, error handling, and geography conversion. Integration points for NOAA/NWS, NHC GIS, OpenFEMA, Census, CDC SVI, and ML models should be implemented in FastAPI, normalized to these interfaces, and given appropriate provenance and timestamps. These services are not currently connected. The demo-oriented labels and model-disclaimer text should be reviewed when production sources are connected.

## Structure

- `src/components/Dashboard.tsx`: layout, state, search, export, and settings
- `USMap.tsx`: MapLibre lifecycle, real boundaries, overlays, camera and geographic selection
- `DisasterMarker.tsx` / `DisasterPopup.tsx`: portal-based geographic interactions
- `RiskHeatmap.tsx`: county prediction and needs choropleths
- `AIInsightsPanel.tsx`: exposure, vulnerability, needs, explanations, and uncertainty
- `MapLayerControls.tsx` / `Sidebar.tsx`: navigation and layer selection
- `src/data/mock.ts`: explicitly synthetic scenarios and model examples
- `src/services/api.ts` / `src/types.ts`: backend-ready data contract

## Browser checks

```powershell
npm.cmd run test:e2e
```

Playwright uses installed Google Chrome on Windows by default. Set `PLAYWRIGHT_CHROME_PATH` to override the browser path. On other systems, install Playwright Chromium (`npx playwright install chromium`); the config uses it when the Windows Chrome path is absent. Tests cover map markers, event cards, county search and scores, layer changes, resource selection, missing predictions, settings, export, and mobile overflow. Browser artifacts are ignored by Git.
