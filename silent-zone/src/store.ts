import {readFile} from 'node:fs/promises';
import {advanceZones, rankZones, validateZone, type Zone} from './scoring.ts';
// Replace this boundary with ACS/CDC SVI/EAGLE-I adapters; scoring stays unchanged.
export async function loadZones(): Promise<Zone[]> {
  const input = JSON.parse(await readFile(new URL('../data/zones.json', import.meta.url), 'utf8'));
  if (input.simulated !== true || !Array.isArray(input.zones)) throw new Error('Expected labeled simulated data');
  input.zones.forEach(validateZone);
  if (new Set(input.zones.map((z: Zone) => z.id)).size !== input.zones.length) throw new Error('Duplicate zone ID');
  return input.zones;
}
export function createStore(initial: Zone[]) {
  let zones = structuredClone(initial), hour = 0;
  const dispatched = new Set<string>();
  const priority = () => ({simulated: true as const, hour, zones: rankZones(zones).map(rank => ({...zones.find(z => z.id === rank.zoneId)!, ...rank, status: dispatched.has(rank.zoneId) ? 'Dispatched' as const : 'Pending' as const}))});
  return {
    priority,
    advance() {zones = advanceZones(zones); hour++; return priority();},
    dispatch(zoneId: string) {
      if (!zones.some(z => z.id === zoneId)) return undefined;
      dispatched.add(zoneId);
      return priority().zones.find(z => z.id === zoneId);
    },
  };
}
