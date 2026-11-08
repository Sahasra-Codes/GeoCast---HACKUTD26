"""Public-source adapters. Live warnings, historical records and survey estimates stay separate."""
import asyncio
import os
import time
from collections import OrderedDict
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix='/api/public', tags=['Public data'])
STATES = dict(item.split(':') for item in 'AL:01 AK:02 AZ:04 AR:05 CA:06 CO:08 CT:09 DE:10 DC:11 FL:12 GA:13 HI:15 ID:16 IL:17 IN:18 IA:19 KS:20 KY:21 LA:22 ME:23 MD:24 MA:25 MI:26 MN:27 MS:28 MO:29 MT:30 NE:31 NV:32 NH:33 NJ:34 NM:35 NY:36 NC:37 ND:38 OH:39 OK:40 OR:41 PA:42 RI:44 SC:45 SD:46 TN:47 TX:48 UT:49 VT:50 VA:51 WA:53 WV:54 WI:55 WY:56 PR:72'.split())
TIGER = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer'
NRI = 'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0'
FEMA = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries'
ACS = 'https://api.census.gov/data/2024/acs/acs5'
CACHE: OrderedDict[str, tuple[float, dict]] = OrderedDict()
LOCKS: dict[str, asyncio.Lock] = {}


def now():
    return datetime.now(timezone.utc).isoformat()


class SourceError(Exception):
    def __init__(self, message, status='unavailable'):
        super().__init__(message)
        self.status = status


async def get_json(url, params=None):
    headers = {'User-Agent': os.getenv('PUBLIC_DATA_USER_AGENT', 'GeoCast/1.0 (public disaster-data explorer)'), 'Accept': 'application/geo+json, application/json'}
    async with httpx.AsyncClient(timeout=httpx.Timeout(25, connect=7), follow_redirects=True, headers=headers) as client:
        response = await client.get(url, params=params)
    if 'api.census.gov/data/missing_key' in str(response.url):
        raise SourceError('Census requires an activated API key. Set CENSUS_API_KEY in backend/.env.', 'configuration_required')
    if response.status_code == 429:
        raise SourceError('The source is rate-limiting requests. Try again later.')
    if response.status_code in (401, 403):
        raise SourceError('The upstream source denied access. Check source availability or API-key configuration.')
    response.raise_for_status()
    try:
        data = response.json()
    except ValueError:
        raise SourceError('The source returned an unexpected non-JSON response.') from None
    if isinstance(data, dict) and data.get('error'):
        raise SourceError('The geographic service rejected the query.')
    return data


async def source(key, name, classification, url, vintage, ttl, loader):
    lock = LOCKS.setdefault(key, asyncio.Lock())
    async with lock:
        cached = CACHE.get(key)
        if cached and cached[0] > time.monotonic():
            return cached[1]
        result = {'name': name, 'classification': classification, 'sourceUrl': url, 'vintage': vintage, 'retrievedAt': now(), 'status': 'available', 'data': None, 'error': None}
        try:
            result['data'] = await loader()
        except SourceError as error:
            result.update(status=error.status, error=str(error))
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            result.update(status='unavailable', error='This public source could not be retrieved. No demo values have been substituted.')
        CACHE[key] = (time.monotonic() + (ttl if result['status'] == 'available' else 30), result)
        CACHE.move_to_end(key)
        while len(CACHE) > 256:
            expired, _ = CACHE.popitem(last=False)
            LOCKS.pop(expired, None)
        return result


def state_code(state):
    state = state.upper()
    if state not in STATES:
        raise HTTPException(422, 'Use a supported two-letter US state abbreviation.')
    return state


def county_code(county):
    if len(county) != 5 or not county.isascii() or not county.isdigit() or county[:2] not in STATES.values() or county[2:] == '000':
        raise HTTPException(422, 'Use a five-digit county FIPS code.')
    return county


async def alerts(state=None):
    async def load():
        url = 'https://api.weather.gov/alerts/active'
        params = {'status': 'actual'}
        if state: params['area'] = state
        features = []
        updated = None
        next_url = None
        for _ in range(5):
            data = await get_json(url, params)
            if data.get('type') != 'FeatureCollection':
                raise SourceError('The weather source returned an invalid alert collection.')
            updated = data.get('updated') or updated
            for item in data.get('features', []):
                p = item.get('properties') or {}
                if p.get('status') != 'Actual':
                    continue
                features.append({'id': p.get('id') or item.get('id'), 'event': p.get('event'), 'severity': p.get('severity'), 'urgency': p.get('urgency'), 'certainty': p.get('certainty'), 'area': p.get('areaDesc'), 'headline': p.get('headline'), 'description': p.get('description'), 'instruction': p.get('instruction'), 'sent': p.get('sent'), 'effective': p.get('effective'), 'expires': p.get('expires'), 'ends': p.get('ends'), 'countyIds': sorted({str(code)[1:] for code in p.get('geocode', {}).get('SAME', []) if len(str(code)) == 6 and str(code).isdigit() and str(code)[1:3] in STATES.values()}), 'stateCodes': sorted({code[:2] for code in p.get('geocode', {}).get('UGC', []) if code[:2] in STATES} | {abbreviation for abbreviation,fips in STATES.items() if any(str(code)[1:3]==fips for code in p.get('geocode',{}).get('SAME',[]))}), 'geometry': item.get('geometry'), 'sourceUrl': p.get('web') or 'https://www.weather.gov/alerts'})
            next_url = (data.get('pagination') or {}).get('next')
            if not next_url:
                break
            parsed = urlparse(next_url)
            if parsed.scheme != 'https' or parsed.hostname != 'api.weather.gov' or not parsed.path.startswith('/alerts'):
                raise SourceError('The weather source returned an unexpected pagination URL.')
            url, params = next_url, None
        return {'alerts': features, 'updated': updated, 'truncated': bool(next_url)}
    return await source('nws:'+(state or 'national'), 'NOAA / National Weather Service', 'live_warnings', 'https://api.weather.gov/alerts/active'+('?area='+state if state else ''), 'Active alert feed; cached up to 2 minutes', 120, load)


async def declarations(state, county=None):
    async def load():
        filters = ("state ne null" if state == 'ALL' else f"state eq '{state}'") if county is None else f"fipsStateCode eq '{county[:2]}' and fipsCountyCode eq '{county[2:]}'"
        limit = 200 if county is None else 100
        data = await get_json(FEMA, {'$filter': filters, '$orderby': 'declarationDate desc', '$top': limit, '$select': 'id,disasterNumber,femaDeclarationString,state,declarationDate,incidentType,declarationTitle,designatedArea,fipsStateCode,fipsCountyCode,incidentBeginDate,incidentEndDate,lastRefresh,declarationType'})
        rows = data.get('DisasterDeclarationsSummaries')
        if not isinstance(rows, list):
            raise SourceError('FEMA returned an invalid declaration collection.')
        return {'records': [{'id': r['id'], 'disasterNumber': r['disasterNumber'], 'declaration': r.get('femaDeclarationString'), 'title': r.get('declarationTitle'), 'type': r.get('incidentType'), 'declarationType': r.get('declarationType'), 'declaredAt': r.get('declarationDate'), 'beganAt': r.get('incidentBeginDate'), 'endedAt': r.get('incidentEndDate'), 'area': r.get('designatedArea'), 'countyId': str(r.get('fipsStateCode','')).zfill(2)+str(r.get('fipsCountyCode','')).zfill(3), 'updatedAt': r.get('lastRefresh')} for r in rows], 'limit': limit, 'truncated': len(rows) == limit}
    return await source('fema:'+(county or state), 'FEMA OpenFEMA declarations', 'historical_records', FEMA, 'Most recent declaration records, not current incident severity', 3600, load)


async def boundaries(state, county=None):
    async def load():
        layer = 8 if county else 82
        where = ("1=1" if state == 'ALL' else f"STATE='{STATES[state]}'") + (f" AND COUNTY='{county[2:]}'" if county else '')
        features = []
        for offset in range(0, 10000, 1000):
            page = await get_json(f'{TIGER}/{layer}/query', {'where': where, 'outFields': 'GEOID,STATE,COUNTY,NAME,BASENAME', 'returnGeometry': 'true', 'outSR': '4326', 'f': 'geojson', 'geometryPrecision': 5, 'maxAllowableOffset': 0.0002, 'resultRecordCount': 1000, 'resultOffset': offset, 'orderByFields':'GEOID'})
            if page.get('type') != 'FeatureCollection':
                raise SourceError('The geographic service returned invalid boundaries.')
            features.extend(page.get('features', []))
            if not page.get('exceededTransferLimit'):
                break
        else:
            raise SourceError('The geographic service returned incomplete boundaries.')
        data = {'type':'FeatureCollection', 'features':features}
        for feature in data.get('features', []):
            feature['id'] = feature['properties']['GEOID']
        return data
    url = f'{TIGER}/{8 if county else 82}'
    return await source('tiger:'+(county or state), 'Census TIGERweb '+('tracts' if county else 'counties'), 'geographic_boundaries', url, 'January 1, 2024; simplified for display (approximately 22 m)', 86400, load)


def number(value):
    try:
        n = float(value)
        return n if n >= 0 else None
    except (ValueError, TypeError):
        return None


async def demographics(county, aggregate=False):
    async def load():
        key = os.getenv('CENSUS_API_KEY', '').strip()
        if not key:
            raise SourceError('Set an activated CENSUS_API_KEY in backend/.env to load ACS estimates.', 'configuration_required')
        ids = ['B01003_001E','B01003_001M','B11001_001E','B11001_001M','B08201_001E','B08201_001M','B08201_002E','B08201_002M','B28002_001E','B28002_001M','B28002_013E','B28002_013M']
        children_ids = [f'B01001_{i:03d}E' for i in [3,4,5,6,27,28,29,30]]
        older_ids = [f'B01001_{i:03d}E' for i in [20,21,22,23,24,25,44,45,46,47,48,49]]
        ids += ['B01001_001E', 'B17001_001E', 'B17001_002E'] + children_ids + older_ids
        params = {'get':'NAME,'+','.join(ids),'for':'county:*' if aggregate else 'county:'+county[2:],'in':'state:'+('*' if county=='ALL' else STATES[county]) if aggregate else 'state:'+county[:2],'key':key}
        table = await get_json(ACS, params)
        if not isinstance(table, list) or len(table)<2 or (not aggregate and len(table)!=2):
            raise SourceError('Census did not return a county estimate.')
        row = dict(zip(table[0], table[1]))
        if aggregate:
            records = [dict(zip(table[0],values)) for values in table[1:]]
            row = {'NAME':'All counties' if county=='ALL' else 'All counties in '+county}
            for code in ids:
                values = [number(record.get(code)) for record in records]
                row[code] = sum(values) if code.endswith('E') and all(value is not None for value in values) else None
        def metric(code):
            return {'estimate': number(row.get(code+'E')), 'marginOfError': number(row.get(code+'M')), 'variable': code+'E'}
        def percent(numerator, denominator):
            n, d = number(row.get(numerator)), number(row.get(denominator))
            return round(n/d*100, 1) if n is not None and d and n <= d else None
        def total(codes):
            values = [number(row.get(code)) for code in codes]
            return sum(values) if all(value is not None for value in values) else None
        age_total = number(row.get('B01001_001E'))
        children, older = total(children_ids), total(older_ids)
        adults = age_total - children - older if all(value is not None for value in [age_total, children, older]) and children + older <= age_total else None
        age_groups = {'total': age_total, 'children': children, 'adults': adults, 'olderAdults': older} if adults is not None else None
        context = {'ageGroups': age_groups, 'povertyPercent': percent('B17001_002E','B17001_001E')}
        return {**context, 'countyId': county, 'name': row['NAME'], 'period': '2020–2024', 'population': metric('B01003_001'), 'households': metric('B11001_001'), 'noVehicleHouseholds': metric('B08201_002'), 'vehicleUniverse': metric('B08201_001'), 'noInternetHouseholds': metric('B28002_013'), 'internetUniverse': metric('B28002_001'), 'noVehiclePercent': percent('B08201_002E','B08201_001E'), 'noInternetPercent': percent('B28002_013E','B28002_001E')}
    return await source(('acs-aggregate-v1:' if aggregate else 'acs-insights-v2:')+county, 'Census ACS 2024 five-year estimates', 'survey_estimates', ACS+'.html', '2020–2024; count margins of error are 90% confidence', 86400, load)


async def risk_index(state, county=None):
    async def load():
        where = f"STCOFIPS='{county}'" if county else ("1=1" if state == 'ALL' else f"STATEABBRV='{state}'")
        fields = 'STCOFIPS,COUNTY,STATEABBRV,RISK_SCORE,RISK_RATNG,EAL_VALT,SOVI_SCORE,SOVI_RATNG,RESL_SCORE,RESL_RATNG,HRCN_RISKR,IFLD_RISKR,CFLD_RISKR'
        features = []
        for offset in range(0, 10000, 1000):
            page = await get_json(NRI+'/query', {'where': where, 'outFields': fields, 'returnGeometry': 'false', 'f': 'json', 'resultRecordCount': 1000, 'resultOffset':offset, 'orderByFields':'STCOFIPS'})
            if not isinstance(page.get('features'), list):
                raise SourceError('FEMA returned invalid risk-index records.')
            features.extend(page['features'])
            if not page.get('exceededTransferLimit'):
                break
        else:
            raise SourceError('FEMA returned incomplete risk-index records.')
        data = {'features':features}
        return {'counties': [{'countyId': str(f['attributes']['STCOFIPS']).zfill(5), 'name': f['attributes']['COUNTY'], 'riskScore': number(f['attributes'].get('RISK_SCORE')), 'riskRating': f['attributes'].get('RISK_RATNG'), 'expectedAnnualLoss': number(f['attributes'].get('EAL_VALT')), 'socialVulnerabilityScore': number(f['attributes'].get('SOVI_SCORE')), 'socialVulnerabilityRating': f['attributes'].get('SOVI_RATNG'), 'resilienceScore': number(f['attributes'].get('RESL_SCORE')), 'resilienceRating': f['attributes'].get('RESL_RATNG'), 'hurricaneRating': f['attributes'].get('HRCN_RISKR'), 'inlandFloodRating': f['attributes'].get('IFLD_RISKR'), 'coastalFloodRating': f['attributes'].get('CFLD_RISKR')} for f in data['features']]}
    return await source('nri:'+(county or state), 'FEMA National Risk Index', 'historical_risk_context', NRI, 'Published FEMA county service; mixed historical input periods; not live flood severity', 86400, load)


@router.get('/state/{state}')
async def state_data(state: str, scenario: str = ""):
    from .scenarios import enabled, scenario_state, merge_alerts
    if enabled(scenario) and state.upper() == "TX":
        return scenario_state("TX")
    state = 'ALL' if state.upper() == 'ALL' else state_code(state)
    results = await asyncio.gather(alerts(None if state == 'ALL' else state), declarations(state), boundaries(state), risk_index(state), state_demographics(state))
    from .observations import earthquakes
    earthquake_source = await earthquakes(state, results[2])
    sources = dict(zip(['noaa','fema','boundaries','nri','acs'], results))
    sources['earthquakes'] = earthquake_source
    if scenario and state == 'ALL': sources['noaa'] = merge_alerts(sources['noaa'])
    return {'state': state, 'generatedAt': now(), 'sources': sources}


@router.get('/county/{county}')
async def county_data(county: str):
    county = county_code(county)
    state = next(k for k, v in STATES.items() if v == county[:2])
    results = await asyncio.gather(demographics(county), declarations(state, county), risk_index(state, county))
    return {'countyId': county, 'generatedAt': now(), 'sources': dict(zip(['acs','fema','nri'], results))}


@router.get('/boundaries/tracts/{county}')
async def tract_data(county: str):
    county = county_code(county)
    state = next(k for k, v in STATES.items() if v == county[:2])
    return await boundaries(state, county)



async def state_demographics(state):
    async def load():
        key=os.getenv('CENSUS_API_KEY','').strip()
        if not key: raise SourceError('An activated CENSUS_API_KEY is required for population-indicator filters.', 'configuration_required')
        variables=['B01003_001E','B11001_001E','B08201_001E','B08201_002E','B28002_001E','B28002_013E']
        table=await get_json(ACS,{'get':'NAME,'+','.join(variables),'for':'county:*','in':'state:'+('*' if state == 'ALL' else STATES[state]),'key':key})
        if not isinstance(table,list) or len(table)<2: raise SourceError('Census returned no county indicator rows.')
        rows=[]
        for values in table[1:]:
            row=dict(zip(table[0],values))
            def percent(n,d):
                numerator,denominator=number(row.get(n)),number(row.get(d))
                return round(numerator/denominator*100,1) if numerator is not None and denominator and numerator<=denominator else None
            rows.append({'countyId':row['state']+row['county'],'name':row['NAME'],'population':number(row.get('B01003_001E')),'households':number(row.get('B11001_001E')),'noVehiclePercent':percent('B08201_002E','B08201_001E'),'noInternetPercent':percent('B28002_013E','B28002_001E')})
        # Request state-level estimates directly rather than treating rounded county sums as a state total.
        age_ids = [f'B01001_{index:03d}' for index in [20,21,22,23,24,25,44,45,46,47,48,49]]
        summary = None
        summary_error = None
        try:
            variables = ['B08201_002E'] + [code+'E' for code in age_ids]
            totals = await get_json(ACS, {'get':'NAME,'+','.join(variables), 'for':'state:'+('*' if state=='ALL' else STATES[state]), 'key':key})
            if not isinstance(totals,list) or len(totals)<2:
                raise SourceError('Census returned no state estimates.')
            estimates = [dict(zip(totals[0], values)) for values in totals[1:]]
            expected = set(STATES.values()) if state=='ALL' else {STATES[state]}
            if {row.get('state') for row in estimates} != expected:
                raise SourceError('Census returned incomplete state estimates.')
            def complete_sum(codes):
                values = [number(row.get(code)) for row in estimates for code in codes]
                return sum(values) if all(value is not None for value in values) else None
            summary = {'residents65Plus':complete_sum([code+'E' for code in age_ids]), 'noVehicleHouseholds':complete_sum(['B08201_002E'])}
        except (SourceError, httpx.HTTPError, ValueError, KeyError, TypeError):
            summary_error = 'State-level Census estimates are currently unavailable.'
        return {'counties':rows,'period':'2020-2024','summary':summary,'summaryError':summary_error}

    return await source('acs-state:'+state,'Census ACS county indicators','survey_estimates',ACS+'.html','2020–2024 five-year estimates; not real-time need or outage reports',86400,load)


@router.get('/alerts')
async def nationwide_alerts(scenario: str = ""):
    from .scenarios import enabled, merge_alerts
    if enabled(scenario): return merge_alerts(await alerts())
    return await alerts()


@router.get('/insights/all')
async def nationwide_insights(scenario: str = ""):
    from .scenarios import enabled, merge_alerts
    simulated = enabled(scenario)
    warning_source, county_source = await asyncio.gather(alerts(), boundaries('ALL'))
    from .observations import earthquakes
    earthquake_source = await earthquakes('ALL', county_source)
    if simulated: warning_source = merge_alerts(warning_source)
    return {'state': 'ALL', 'generatedAt': now(), 'sources': {
        'noaa': warning_source, 'boundaries': county_source, 'earthquakes': earthquake_source,
    }}


@router.get('/demographics/{state}')
async def aggregate_demographics(state: str):
    state = 'ALL' if state.upper()=='ALL' else state_code(state)
    return await demographics(state, aggregate=True)
