export interface Zone {
  id: string; name: string; population: number; pct65plus: number; sviScore: number;
  powerOff: boolean; outageHours: number; normalReportsPerHour: number;
  reportsNow: number; hoursSinceLastReport: number;
}
export type Breakdown = {outage: number; vulnerability: number; silence: number; reportedNeed: number};
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export function validateZone(zone: Zone): void {
  if (!zone.id || !zone.name || typeof zone.powerOff !== 'boolean') throw new Error('Invalid zone identity or power status');
  for (const key of ['population','pct65plus','sviScore','outageHours','normalReportsPerHour','reportsNow','hoursSinceLastReport'] as const) {
    if (!Number.isFinite(zone[key]) || zone[key] < 0) throw new Error(`Invalid ${key}`);
  }
  if (zone.pct65plus > 100 || zone.sviScore > 1 || zone.normalReportsPerHour <= 0) throw new Error('Invalid vulnerability or report baseline');
}
// All priority decisions live here. Gemini never supplies scores or ordering.
export function scoreZone(zone: Zone) {
  validateZone(zone);
  const dropRatio = clamp(1 - zone.reportsNow / zone.normalReportsPerHour);
  const breakdown: Breakdown = {
    outage: zone.powerOff ? 30 * Math.min(zone.outageHours, 24) / 24 : 0,
    vulnerability: 25 * (0.6 * Math.min(zone.pct65plus / 40, 1) + 0.4 * zone.sviScore),
    silence: 25 * (0.6 * dropRatio + 0.4 * Math.min(zone.hoursSinceLastReport / 12, 1)),
    reportedNeed: 20 * Math.min(zone.reportsNow / (zone.normalReportsPerHour * 3), 1),
  };
  const reasons = [zone.powerOff ? `No power for ${zone.outageHours}h` : 'Power on', `${zone.pct65plus}% age 65+; SVI ${zone.sviScore.toFixed(2)}`];
  if (dropRatio > 0) reasons.push(`Reports down ${Math.round(dropRatio * 100)}% from normal`);
  reasons.push(`Last signal ${zone.hoursSinceLastReport}h ago`, `${zone.reportsNow} reports vs ${zone.normalReportsPerHour}/h normal`);
  return {zoneId: zone.id, score: clamp(Object.values(breakdown).reduce((sum, n) => sum + n, 0), 0, 100), breakdown, reasons};
}
export function rankZones(zones: readonly Zone[]) {
  return zones.map(scoreZone).sort((a, b) => b.score - a.score || a.zoneId.localeCompare(b.zoneId));
}
// Silence is a report rate below baseline; no random values or wall-clock dependency.
export function advanceZones(zones: readonly Zone[]): Zone[] {
  return zones.map(zone => zone.powerOff && zone.reportsNow < zone.normalReportsPerHour
    ? {...zone, outageHours: zone.outageHours + 1, hoursSinceLastReport: zone.hoursSinceLastReport + 1}
    : !zone.powerOff && zone.reportsNow > zone.normalReportsPerHour
      ? {...zone, reportsNow: zone.reportsNow + 1, hoursSinceLastReport: 0}
      : {...zone});
}
