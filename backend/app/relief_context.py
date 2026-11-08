"""Source-backed location context for the simplified Relief form."""
import asyncio
import math
import time
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from . import public_data as public
from .observations import point_in_geometry
from .resources import resources, open_shelters

router = APIRouter(prefix='/api/public', tags=['Relief context'])
GEOCODER = 'https://nominatim.openstreetmap.org/search'
GEOCODE_LOCK = asyncio.Lock()
LAST_GEOCODE = 0.0

@router.get('/relief-context')
async def relief_context(city: str = Query(min_length=1, max_length=100), state: str = Query(pattern='^[A-Z]{2}$'), county: str = Query(default='', pattern='^([0-9]{5})?$'), scenario: str = ''):
    from .scenarios import enabled, scenario_context, snapshot
    simulated = enabled(scenario)
    state = public.state_code(state)
    city = city.strip()
    if not city or (county and (not county.startswith(public.STATES[state]) or county.endswith('000'))):
        raise HTTPException(422, 'Enter a city and a county within the selected state.')
    async def geocode():
        global LAST_GEOCODE
        async with GEOCODE_LOCK:
            await asyncio.sleep(max(0, 1.05 - (time.monotonic() - LAST_GEOCODE)))
            LAST_GEOCODE = time.monotonic()
            data = await public.get_json(GEOCODER, {'city': city, 'state': state, 'countrycodes': 'us', 'format': 'jsonv2', 'addressdetails': 1, 'limit': 1})
        if not isinstance(data, list) or not data:
            raise public.SourceError('City not found. Check the city and state.')
        lat, lon = float(data[0]['lat']), float(data[0]['lon'])
        if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
            raise public.SourceError('The city lookup returned invalid coordinates.')
        return {'latitude': lat, 'longitude': lon, 'label': data[0].get('display_name', city)}
    location_source, boundaries = await asyncio.gather(
        public.source('relief-city:'+state+':'+city.casefold(), 'OpenStreetMap / Nominatim', 'city_location', GEOCODER, 'Representative city center; cities may span counties', 86400, geocode),
        asyncio.sleep(0, result=snapshot()['state']['sources']['boundaries']) if simulated and state == 'TX' else public.boundaries(state))
    if location_source['status'] != 'available':
        raise HTTPException(422 if str(location_source['error']).startswith('City not found') else 503, location_source['error'])
    if boundaries['status'] != 'available':
        raise HTTPException(503, 'County boundaries are unavailable. Retry the location lookup.')
    location = location_source['data']
    features = boundaries['data']['features']
    point = (location['longitude'], location['latitude'])
    feature = next((f for f in features if str(f.get('id') or f.get('properties', {}).get('GEOID')) == county), None) if county else next((f for f in features if point_in_geometry(point, f.get('geometry'))), None)
    if not feature:
        raise HTTPException(422, 'Could not match this city to a county in the selected state.')
    if county and not point_in_geometry(point, feature.get('geometry')):
        raise HTTPException(422, 'The city center is outside the selected county. Clear County to use the city location.')
    county = str(feature.get('id') or feature['properties']['GEOID'])
    if simulated:
        return scenario_context(county, city)
    county_name = feature.get('properties', {}).get('NAME', county)
    location_text = f"{location['latitude']},{location['longitude']}"
    alerts, census, shelters, food, medical, financial = await asyncio.gather(
        public.alerts(state), public.demographics(county), open_shelters(),
        resources('food', location=location_text, state=state, county=county),
        resources('medical', location=location_text, state=state, county=county),
        resources('financial', location=location_text, state=state, county=county))
    food = {**food, 'note': food['note'].replace('selected county center', 'city center')}
    medical = {**medical, 'note': medical['note'].replace('selected county center', 'city center')}
    def distance(item):
        coords = item.get('coordinates') or {}
        lat, lon = coords.get('latitude'), coords.get('longitude')
        if lat is None or lon is None: return float('inf')
        rad = math.pi / 180
        h = math.sin((lat-point[1])*rad/2)**2 + math.cos(lat*rad)*math.cos(point[1]*rad)*math.sin((lon-point[0])*rad/2)**2
        return 3958.7613*2*math.asin(math.sqrt(min(1, max(0, h))))
    shelters = {**shelters, 'items': sorted((item for item in shelters['items'] if distance(item) <= 50), key=distance),
        'note': 'Reported open shelters within 50 miles of the city center; confirm access and capacity.' if shelters['status'] == 'available' else shelters['note']}
    if shelters['status'] == 'available' and not shelters['items']:
        shelters['note'] = 'No open shelters reported within 50 miles of the city center.'
    current = datetime.now(timezone.utc)
    def active(alert):
        def parse(value): return datetime.fromisoformat(value.replace('Z', '+00:00')) if value else None
        try:
            end = parse(alert.get('ends') or alert.get('expires'))
            start = parse(alert.get('effective'))
            return (not end or end > current) and (not start or start <= current)
        except (ValueError, TypeError):
            return False
    matched = [a for a in (alerts.get('data') or {}).get('alerts', []) if active(a) and (county in a.get('countyIds', []) or point_in_geometry(point, a.get('geometry')))]
    return {'location': {'city': city, 'state': state, 'countyId': county, 'countyName': county_name, **location},
        'generatedAt': public.now(), 'rankedLiveAlerts': matched,
        'scopeNote': 'Alerts and Census estimates use the matched county. Cities may span multiple counties. Resource searches use the city center; mapped coverage is incomplete.',
        'insights': {'alerts': {**alerts, 'data': {'alerts': matched}}, 'census': census},
        'resources': {'shelter': shelters, 'food': food, 'medical': medical, 'financial': financial},
        'locationSource': {k: v for k, v in location_source.items() if k != 'data'}}
