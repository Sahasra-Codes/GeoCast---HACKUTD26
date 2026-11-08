# Hurricane Marlow (fictional)

Only Hurricane Marlow and its hypothetical weather alerts are fictional. County geography, Census estimates, shelter/facility records, FEMA declaration records, and official safety guidance come from real sources. No fictional shelters, facilities, capacities, or safety guides are added.

The scenario covers the 18 requested South Texas counties. No Houston-area counties were added.

- `hurricane-marlow.json`: three explicitly labeled hypothetical alerts. Times are Nov 8, 2026, 9 AM CST through Nov 9, noon CST. The shelters array is intentionally empty.
- `hurricane-marlow.snapshot.json`: real Texas NWS, TIGERweb, Census ACS, FEMA, and resource results with original status and retrieval times, plus verified official safety-guide links. Failed OSM lookups remain unavailable; no facility names or coordinates are invented.
- `hurricane-marlow.plans.json`: county plans pre-generated with Gemini using the fictional storm plus real supporting source snapshots. Nearby resources in each plan are limited to 50 miles of the real county centroid. No current open shelters means no open shelters reported in that real source snapshot, not no possible evacuation sites.
- `hurricane-marlow.ranks.json`: the existing fixed priority formula applied to hypothetical storm alerts and real county/resource inputs, with actual ranks recorded for review.

Public Resources searches use the real source loaders regardless of the storm toggle. Safety Guides show actual NWS alerts and published NWS/Ready.gov guidance, never a fictional alert as a guide. Priority ranking uses the captured real resource records; the storm toggle does not create resources.

The exercise clock is fixed at the scenario issue time only for explicitly simulated Marlow alerts. The simulation view evaluates captured real alerts at snapshot capture time; real mode uses the actual clock. Alert source timestamps remain unchanged.

Pre-generate/retry plans with `node --env-file-if-exists=.env scripts/pregenerate-marlow.ts` from `silent-zone`. Plans are invalidated when their source snapshot or generation policy changes. Keys stay in server environment files outside these artifacts.

With real supporting resources only and the unchanged fixed formula, Brooks improves from Severity-only rank 7 to Coverage-gap rank 1, and Duval improves from 8 to 2. The ranks artifact records the actual evidence and snapshot time.
