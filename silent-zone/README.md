# GeoCast Silent Zone

Internal responder demonstration, integrated into **Insights** and **Relief** without replacing the existing map or navigation. All six zones, report counts, outage values and dispatch assignments are fictional and labeled **Simulated data**. No dispatch is sent to a real agency.

Requires Node 24 (native TypeScript support). From this directory:

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd start
```

Optionally set `GEMINI_API_KEY` and `GEMINI_MODEL` in this server's `.env`. Neither value is injected into Vite. Missing configuration, provider errors, empty output or a 12-second SDK timeout return a deterministic briefing from the ranked reasons. The official `@google/genai` SDK sends only the top three zones. Gemini explains the existing ranking; it cannot change scores, ordering or dispatch state.

Run the frontend separately with `npm.cmd run dev` from `../frontend`. Its Vite proxy routes `/api/priority`, `/api/advance`, `/api/briefing` and `/api/dispatch` to this Node server on port 8001, preserving the existing Python API on port 8000 for other routes. Production hosting must configure the same route split.

- `GET /api/priority`: `{simulated:true, hour, zones:[...ranked zone inputs, score, breakdown, reasons, status]}`.
- `POST /api/advance`: adds one simulated hour and returns the new snapshot. Silent means reports below the hourly baseline. Power-off silent zones gain an outage hour and a signal-age hour; powered loud zones gain one report. No random numbers. Zone 3 reaches #1 at hour 4 with the supplied seed.
- `POST /api/briefing`: `{text, source:"gemini"|"template", hour, simulated:true}`. Human responders make the final decision.
- `POST /api/dispatch` with `{zoneId:"zone-3"}`: returns the zone with `status:"Dispatched"`. Assignment persists across requests, route changes and clock advances. Priority remains unchanged: assignment does not mean resolution.

State is held by one process and resets on restart. The hour is simulated, not elapsed wall time; last-signal timers advance with it. Browser views poll every 10 seconds and refresh on focus. This loopback-only service is a local hackathon demonstration, not a production authorization boundary. Before a responder deployment, enforce verified organizational roles on all four server endpoints and add durable transactional storage. Existing optional Supabase sign-in is not staff authorization.

`data/zones.json` explicitly labels its contents simulated. `src/store.ts::loadZones` is the replacement boundary for future source adapters: Census ACS age/population estimates, CDC SVI CSV scores, EAGLE-I county outage rows and a real reporting feed/baseline. Validate and align geography, vintages and reporting windows before connecting them. The pure scorer rejects zero report baselines or invalid numbers instead of treating missing data as zero need. Current vulnerability weights and silence thresholds are demo policy, not validated operational triage.

Checks: `npm.cmd test` and `npm.cmd run typecheck`. Frontend integration: from `../frontend`, `npx.cmd playwright test tests/silent-zone.spec.ts` with both servers running.
