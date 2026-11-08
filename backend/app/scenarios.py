"""Explicit request-scoped overlays. Live source caches are never written or mutated."""
import json
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from fastapi import APIRouter, HTTPException

SCENARIO_ID = 'hurricane-marlow'
ROOT = Path(__file__).resolve().parents[2] / 'data' / 'scenarios'
router = APIRouter(prefix='/api/public/scenarios', tags=['Fictional scenarios'])

def enabled(value):
    if value and value != SCENARIO_ID:
        raise HTTPException(422, 'Unknown fictional scenario.')
    return value == SCENARIO_ID

@lru_cache(maxsize=1)
def snapshot():
    return json.loads((ROOT / 'hurricane-marlow.snapshot.json').read_text(encoding='utf-8'))

@lru_cache(maxsize=1)
def definition():
    value = json.loads((ROOT / 'hurricane-marlow.json').read_text(encoding='utf-8'))
    counties = {str(f['id']) for f in snapshot()['state']['sources']['boundaries']['data']['features']}
    for alert in value['alerts']:
        if not alert.get('simulated') or not alert['event'].startswith('SIMULATED:') or not set(alert['countyIds']) <= counties:
            raise ValueError('Scenario must be labeled and use loaded Texas counties.')
    return value

def county_ids():
    return sorted({id for alert in definition()['alerts'] for id in alert['countyIds']})

def centroid(geometry):
    polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    total = xsum = ysum = 0
    for polygon in polygons:
        for index, ring in enumerate(polygon):
            crosses = [a[0]*b[1]-b[0]*a[1] for a,b in zip(ring, ring[1:]+ring[:1])]
            cross_sum = sum(crosses)
            if abs(cross_sum) < 1e-12: continue
            weight = abs(cross_sum)/2 * (1 if index == 0 else -1)
            total += weight
            xsum += sum((a[0]+b[0])*c for a,b,c in zip(ring,ring[1:]+ring[:1],crosses))/(3*cross_sum)*weight
            ysum += sum((a[1]+b[1])*c for a,b,c in zip(ring,ring[1:]+ring[:1],crosses))/(3*cross_sum)*weight
    if total <= 0: raise ValueError('County centroid unavailable.')
    return {'latitude': ysum/total, 'longitude': xsum/total}

def merge_alerts(source):
    result = deepcopy(source)
    real = result.get('data') or {'alerts': [], 'updated': None, 'truncated': False}
    real['alerts'] = [a for a in real.get('alerts', []) if not a.get('simulated')] + deepcopy(definition()['alerts'])
    result.update(data=real, status='available', name=source['name']+' + Hurricane Marlow (fictional)',
        simulated=True, realSourceStatus=source['status'])
    return result

def scenario_state(state):
    result = deepcopy(snapshot()['state'])
    result['sources']['noaa'] = merge_alerts(result['sources']['noaa'])
    result['simulated'] = True
    result['scenario'] = SCENARIO_ID
    return result

def scenario_resources():
    # Only the weather hazard is fictional. Resources and their availability stay real.
    results = deepcopy(snapshot()['resources'])
    for result in results.values():
        result['items'] = [item for item in result['items'] if not item.get('simulated')]
    return results

def scenario_context(county, city=None):
    if county not in county_ids():
        raise HTTPException(422, 'Choose a county included in Hurricane Marlow (fictional).')
    saved = snapshot()
    feature = next(f for f in saved['state']['sources']['boundaries']['data']['features'] if str(f['id']) == county)
    name = feature['properties']['NAME']
    resources = scenario_resources()
    center = centroid(feature['geometry'])
    import math
    def distance(item):
        point = item.get('coordinates') or {}
        lat, lon = point.get('latitude'), point.get('longitude')
        if lat is None or lon is None: return float('inf')
        rad = math.pi/180
        h = math.sin((lat-center['latitude'])*rad/2)**2 + math.cos(lat*rad)*math.cos(center['latitude']*rad)*math.sin((lon-center['longitude'])*rad/2)**2
        return 3958.7613*2*math.asin(math.sqrt(min(1, max(0, h))))
    for kind in ('shelter','food','medical'):
        result = resources[kind]
        if result['status'] == 'available':
            result['items'] = [{**item,'distanceMiles':round(distance(item),1)} for item in result['items'] if distance(item)<=50]
            result['note'] = ('Real reported-open shelters' if kind=='shelter' else 'Real mapped facilities') + ' within 50 miles of the county center. Confirm availability directly.'
            if not result['items']: result['note'] = 'No '+('open shelters reported' if kind=='shelter' else 'mapped facilities returned')+' within 50 miles in this real source snapshot.'
    census = saved['census']
    county_estimates = next((c for c in (saved['state']['sources'].get('acs', {}).get('data') or {}).get('counties', []) if c['countyId'] == county), {})
    metadata = census['sources']['B01001']
    alerts_source = merge_alerts(saved['state']['sources']['noaa'])
    alerts = [a for a in alerts_source['data']['alerts'] if county in a['countyIds']]
    fema = saved['state']['sources']['fema']
    records = [r for r in (fema.get('data') or {}).get('records', []) if r['countyId'] == county]
    resources['financial'] = {'source':fema['name'], 'status':fema['status'], 'retrievedAt':fema['retrievedAt'],
        'items':[{'title':r['title'],'description':r['area'],'url':f"https://www.fema.gov/disaster/{r['disasterNumber']}"} for r in records],
        'note':'County records from the captured state declaration snapshot; incomplete historical coverage, not an eligibility check.'}
    return {'simulated':True, 'scenario':SCENARIO_ID, 'scenarioName':definition()['name'], 'exerciseTime':definition()['issued'],
        'location':{'city':city or name, 'state':'TX','countyId':county,'countyName':name, **centroid(feature['geometry'])},
        'generatedAt':saved['capturedAt'], 'rankedLiveAlerts':alerts,
        'scopeNote':'SIMULATED: Hurricane Marlow (fictional). Real counties and Census data, fictional storm. Only the storm and its alert conditions are fictional. County facts, facilities, and official safety guidance come from real sources. The plan describes proposed actions if this storm occurred; it does not invent current local impacts or resource availability. Source snapshots retain their original retrieval times.',
        'insights':{'alerts':{**alerts_source,'data':{'alerts':alerts}},
            'census':{**metadata,'name':'Census ACS 2024 county estimates (real)',
                'data':{**county_estimates, **census['counties'].get(county, {}), 'inputSources':census['sources']}}},
        'resources':resources}

@router.get('/hurricane-marlow')
async def get_scenario():
    return {**deepcopy(definition()), 'shelters':[], 'capturedAt':snapshot()['capturedAt']}

@router.get('/hurricane-marlow/context/{county}')
async def get_scenario_context(county: str):
    return scenario_context(county)
