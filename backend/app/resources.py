"""Server-side resource adapters; provider credentials never reach the browser."""
import time
from collections import OrderedDict
import math
import re
from html import unescape
import os
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Query, HTTPException
from .public_data import STATES

router = APIRouter(prefix="/api/resources", tags=["Resources"])
Category = Literal["shelter", "food", "medical", "transportation", "financial", "safety"]
RED_CROSS = "https://www.redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter.html"
GUIDES = [
    {"title": "Build an emergency kit", "description": "Supplies and planning for your household.", "url": "https://www.ready.gov/kit"},
    {"title": "Make a plan", "description": "Communication, evacuation, and household planning.", "url": "https://www.ready.gov/plan"},
    {"title": "Recover after a disaster", "description": "Official recovery and returning-home guidance.", "url": "https://www.ready.gov/recovering-disaster"},
]

class OverpassUnavailable(Exception):
    pass

OVERPASS_CACHE = OrderedDict()
OPEN_SHELTERS = 'https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/FeatureServer/0'

async def open_shelters():
    from . import public_data as public
    async def load():
        items, offset = [], 0
        while True:
            data = await public.get_json(OPEN_SHELTERS + '/query', {
                'where': '1=1', 'outFields': '*', 'returnGeometry': 'true',
                'outSR': '4326', 'f': 'json', 'resultOffset': offset,
                'resultRecordCount': 2000, 'orderByFields': 'objectid'})
            if 'error' in data or not isinstance(data.get('features'), list):
                raise public.SourceError('FEMA open shelter service returned an invalid response.')
            for feature in data['features']:
                attrs = {key.lower(): value for key, value in feature.get('attributes', {}).items()}
                point = feature.get('geometry') or {}
                items.append({'title': attrs.get('shelter_name') or 'Reported open shelter',
                    'state': attrs.get('state'),
                    'description': ', '.join(str(attrs[key]) for key in ('address', 'city', 'state') if attrs.get(key)),
                    'coordinates': {'latitude': point.get('y'), 'longitude': point.get('x')},
                    'url': OPEN_SHELTERS})
            if not data.get('exceededTransferLimit'):
                return items
            if not data['features']:
                raise public.SourceError('FEMA shelter pagination was incomplete.')
            offset += len(data['features'])
    snapshot = await public.source('open-shelters', 'FEMA Open Shelters', 'open_shelters',
        OPEN_SHELTERS, 'Currently open shelters reported to FEMA; not all potential shelter locations', 300, load)
    items = snapshot['data'] or []
    # Keep the national loaded set for nearest-resource calculations across county/state lines.
    return {'source': snapshot['name'], 'retrievedAt': snapshot['retrievedAt'],
        'status': snapshot['status'], 'items': items,
        'note': ('No open shelters reported' if snapshot['status'] == 'available' and not items else
                 snapshot.get('error') or 'Currently open shelters reported to FEMA. Confirm access before traveling.')}

def mapped_facility(element):
    """Expose actual facility details, never an internal OSM tag as a name."""
    tags = element.get("tags", {})
    title = next((tags[key].strip() for key in ("name", "name:en", "official_name", "operator", "brand")
                  if isinstance(tags.get(key), str) and tags[key].strip()
                  and tags[key].strip().lower() not in {"social_facility", "hospital", "food_bank", "yes"}), None)
    if not title:
        return None
    street = " ".join(tags.get(key, "") for key in ("addr:housenumber", "addr:street") if tags.get(key))
    address = tags.get("addr:full") or ", ".join(part for part in
        (street, tags.get("addr:city"), tags.get("addr:state"), tags.get("addr:postcode")) if part)
    website = (tags.get("website") or tags.get("contact:website") or "").strip()
    if website.startswith("www."):
        website = "https://" + website
    if not re.match(r"^https?://[^\s/]+", website, re.I):
        website = None
    return {"title": title, "description": address,
            "phone": tags.get("phone") or tags.get("contact:phone"), "website": website,
            "coordinates": {"latitude": element.get("lat", element.get("center", {}).get("lat")),
                            "longitude": element.get("lon", element.get("center", {}).get("lon"))},
            "details": "Mapped hours: " + tags["opening_hours"] if tags.get("opening_hours") else None,
            "url": f"https://www.openstreetmap.org/{element['type']}/{element['id']}"}

async def query_overpass(client, query):
    cached = OVERPASS_CACHE.get(query)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    endpoints = [os.getenv("OVERPASS_API_URL", "https://overpass-api.de/api/interpreter"),
                 os.getenv("OVERPASS_FALLBACK_URL", "https://overpass.private.coffee/api/interpreter"),
                 "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
    failures = []
    deadline=time.monotonic()+(90 if "[timeout:45]" in query else 55)
    for endpoint in dict.fromkeys(endpoints):
        remaining=deadline-time.monotonic()
        if remaining<=0:break
        try:
            response = await client.post(endpoint, data={"data": query},
                headers={"User-Agent": "GeoCast/1.0 (community resource explorer)", "Accept": "application/json"},
                timeout=httpx.Timeout(min(remaining,75 if "[timeout:45]" in query else 40), connect=min(remaining,10)))
            response.raise_for_status()
            data = response.json()
            if data.get("remark") or not isinstance(data.get("elements"), list):
                raise ValueError("Incomplete Overpass response")
            OVERPASS_CACHE[query] = (time.monotonic() + 300, data)
            OVERPASS_CACHE.move_to_end(query)
            while len(OVERPASS_CACHE) > 128:
                OVERPASS_CACHE.popitem(last=False)
            return data
        except httpx.HTTPStatusError as error:
            failures.append(f"HTTP {error.response.status_code}")
        except httpx.TimeoutException:
            failures.append("timeout")
        except (httpx.HTTPError, ValueError, TypeError):
            failures.append("connection or response error")
    raise OverpassUnavailable("OpenStreetMap search is temporarily unavailable (" + ", ".join(failures) + "). No API key is needed. Retry shortly, or use the OpenStreetMap search link below.")

@router.get("/{category}")
async def resources(category: Category, location: str = Query("", max_length=120), state: str = Query("TX", pattern="^[A-Z]{2}$"), county: str = Query("", pattern="^([0-9]{5})?$"), scenario: str = ""):
    if state not in STATES:
        raise HTTPException(422, "Choose a supported US state.")
    if county and (state not in STATES or not county.startswith(STATES[state]) or county.endswith("000")):
        raise HTTPException(422, "Choose a county within the selected state.")
    from .scenarios import enabled, scenario_resources, scenario_context, county_ids
    if enabled(scenario) and state == 'TX':
        if category in ('shelter', 'food', 'medical'):
            result = scenario_resources()[category]
            if category == 'shelter' and county:
                result['items'] = [item for item in result['items'] if item.get('countyId') == county]
                result['note'] += ' Showing shelters explicitly linked to this county; real records without county links are not included.'
            return result
        if category == 'financial' and county in county_ids():
            return scenario_context(county)['resources']['financial']
        if category == 'safety' and county in county_ids():
            context = scenario_context(county)
            return {'source':'NWS + Hurricane Marlow (fictional)','retrievedAt':context['generatedAt'],'status':'available','simulated':True,'note':context['scopeNote'],
                'items':[{'title':a['event'],'description':a['headline'],'details':a['instruction'],'url':a['sourceUrl'],'simulated':a.get('simulated',False)} for a in context['rankedLiveAlerts']]}
    source = {"shelter": "American Red Cross", "food": "OpenStreetMap / Overpass", "medical": "OpenStreetMap / Overpass", "transportation": "DriveTexas / TxDOT", "financial": "OpenFEMA", "safety": "National Weather Service + Ready.gov"}[category]
    result = {"source": source, "retrievedAt": datetime.now(timezone.utc).isoformat(), "items": [], "status": "available", "note": ""}
    if category == "shelter":
        return {**result, "items": [{"title": "Find an open Red Cross shelter", "description": "Search official shelter listings and services in the Red Cross directory.", "url": RED_CROSS}], "note": "Official directory link. Live API access is not guaranteed; no live shelter status or bed availability is claimed."}
    if category == "transportation":
        if state != "TX":
            return {**result, "status": "unsupported_region", "note": "DriveTexas covers Texas road conditions only. Select TX."}
        if not os.getenv("DRIVETEXAS_API_KEY", "").strip():
            return {**result, "status": "configuration_required", "items": [{"title": "View Texas road conditions", "description": "Official TxDOT road conditions and closures.", "url": "https://drivetexas.org/"}], "note": "Add an approved DRIVETEXAS_API_KEY to backend/.env to load road conditions here."}
    statewide = category in ("food", "medical") and not county and not location
    if category in ("food", "medical") and not statewide:
        try:
            lat, lon = map(float, location.split(","))
            if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(422, "Use my location or enter latitude, longitude (for example 32.78, -96.80).") from None
    try:
        async with httpx.AsyncClient(timeout=18, follow_redirects=True) as client:
            async def get(url, **kwargs):
                response = await client.get(url, **kwargs)
                response.raise_for_status()
                return response.json()
            if category in ("food", "medical"):
                area = '(area.searchArea)' if statewide else f'(around:10000,{lat},{lon})'
                prefix = f'area["ISO3166-2"="US-{state}"]["admin_level"="4"]->.searchArea;' if statewide else ''
                tags = [("amenity", "hospital"), ("healthcare", "hospital")] if category == "medical" else [("amenity", "food_bank"), ("social_facility", "food_bank")]
                limit = 100 if statewide else 30
                query = f'[out:json][timeout:{45 if statewide else 25}];'+prefix+'('+''.join(f'nwr["{key}"="{value}"]{area};' for key,value in tags)+f');out center tags {limit};'
                data = await query_overpass(client, query)
                result["items"] = [item for e in data["elements"] if (item := mapped_facility(e)) is not None]
                omitted = len(data["elements"]) - len(result["items"])
                scope = f'in {state} (statewide search)' if statewide else 'within 10 km of the selected county center (not the entire county)'
                result["note"] = f"OpenStreetMap contributors (ODbL). Up to {limit} mapped locations {scope}. Results may be incomplete and are not ordered by proximity. " + ("Hospitals are community-mapped; confirm hours and medical services directly." if category == "medical" else "Food banks are community-mapped; confirm distribution hours and supplies directly.")
                if omitted:
                    result["note"] += f" {omitted} unnamed map records omitted because no facility name or operator was provided."

            elif category == "transportation":
                data = await get("https://api.drivetexas.org/api/conditions.geojson", params={"key": os.environ["DRIVETEXAS_API_KEY"]})
                result["items"] = [{"title": str(e.get("properties", {}).get("RTE_NM") or "Texas roadway") + " ? " + str(e.get("properties", {}).get("type") or "Road condition"), "description": unescape(re.sub(r"<[^>]+>", " ", str(e.get("properties", {}).get("description") or "See DriveTexas for details."))), "details": e.get("properties", {}).get("COND_LMT_FROM_DSCR"), "url": "https://drivetexas.org/"} for e in data.get("features", [])[:30]]
                result["note"] = "First 30 statewide TxDOT condition records, not sorted by proximity. Check DriveTexas for the complete road network."
            elif category == "safety":
                result["items"] = list(GUIDES)
                try:
                    data = await get("https://api.weather.gov/alerts/active", params={"area": state}, headers={"User-Agent": os.getenv("PUBLIC_DATA_USER_AGENT", "GeoCast/1.0 (community resource explorer)"), "Accept": "application/geo+json"})
                    features = data.get("features", [])
                    if county:
                        features = [f for f in features if any(str(code).endswith(county) for code in f.get("properties", {}).get("geocode", {}).get("SAME", []))]
                    alerts = [{"title": e.get("properties", {}).get("event", "Weather alert"), "description": e.get("properties", {}).get("headline", ""), "details": e.get("properties", {}).get("instruction") or "Read the issuing office's alert for instructions.", "url": "https://www.weather.gov/alerts"} for e in features[:20]]
                    result["items"] = alerts + result["items"]
                    result["note"] = f"{len(features)} active NWS alerts matched for {county or state}; showing up to 20. County filtering uses NWS SAME county codes and may omit zone-only alerts; check weather.gov for complete warnings. Ready.gov guides apply generally."
                except (httpx.HTTPError, ValueError, KeyError, TypeError):
                    result["status"] = "partial"
                    result["note"] = "Live NWS alerts are unavailable. Ready.gov preparedness links remain available; this does not mean there are no active warnings."
            else:
                data = await get("https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries", params={"$filter": (f"fipsStateCode eq '{county[:2]}' and fipsCountyCode eq '{county[2:]}'" if county else f"state eq '{state}'"), "$orderby": "declarationDate desc", "$top": 12})
                result["items"] = [{"title": e.get("declarationTitle", "Disaster declaration"), "description": f"{e.get('designatedArea', state)} | Declared: {str(e.get('declarationDate', ''))[:10]}", "details": f"Individual assistance authorized: {e.get('iaProgramDeclared')}. Public assistance authorized: {e.get('paProgramDeclared')}. Hazard mitigation authorized: {e.get('hmProgramDeclared')}.", "url": f"https://www.fema.gov/disaster/{e['disasterNumber']}"} for e in data.get("DisasterDeclarationsSummaries", [])]
                result["note"] = "Recent declaration records, not an eligibility determination or confirmation that applications are open."
        return result
    except OverpassUnavailable as error:
        search = "hospital" if category == "medical" else "food bank"
        return {**result, "status": "unavailable", "note": str(error), "items": [{"title": "Search OpenStreetMap directly", "description": "Open the map to search mapped locations while the API is unavailable.", "url": (f"https://www.openstreetmap.org/search?query={search.replace(' ', '%20')}%20in%20{state}" if statewide else f"https://www.openstreetmap.org/search?query={search.replace(' ', '%20')}#map=13/{lat}/{lon}")}]}
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return {**result, "status": "unavailable", "items": [], "note": "This provider could not return results. Check provider access, quota, or try again later. No sample locations have been substituted."}
