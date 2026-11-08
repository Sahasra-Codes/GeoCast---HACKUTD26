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

async def query_overpass(client, query):
    cached = OVERPASS_CACHE.get(query)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    endpoints = [os.getenv("OVERPASS_API_URL", "https://overpass-api.de/api/interpreter"),
                 os.getenv("OVERPASS_FALLBACK_URL", "https://overpass.private.coffee/api/interpreter")]
    failures = []
    for endpoint in dict.fromkeys(endpoints):
        try:
            response = await client.post(endpoint, data={"data": query},
                headers={"User-Agent": "GeoCast/1.0 (community resource explorer)", "Accept": "application/json"},
                timeout=httpx.Timeout(12, connect=4))
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
async def resources(category: Category, location: str = Query("", max_length=120), state: str = Query("TX", pattern="^[A-Z]{2}$"), county: str = Query("", pattern="^([0-9]{5})?$")):
    if county and (state not in STATES or not county.startswith(STATES[state]) or county.endswith("000")):
        raise HTTPException(422, "Choose a county within the selected state.")
    source = {"shelter": "American Red Cross", "food": "OpenStreetMap / Overpass", "medical": "OpenStreetMap / Overpass", "transportation": "DriveTexas / TxDOT", "financial": "OpenFEMA", "safety": "National Weather Service + Ready.gov"}[category]
    result = {"source": source, "retrievedAt": datetime.now(timezone.utc).isoformat(), "items": [], "status": "available", "note": ""}
    if category == "shelter":
        return {**result, "items": [{"title": "Find an open Red Cross shelter", "description": "Search official shelter listings and services in the Red Cross directory.", "url": RED_CROSS}], "note": "Official directory link. Live API access is not guaranteed; no live shelter status or bed availability is claimed."}
    if category == "transportation":
        if state != "TX":
            return {**result, "status": "unsupported_region", "note": "DriveTexas covers Texas road conditions only. Select TX."}
        if not os.getenv("DRIVETEXAS_API_KEY", "").strip():
            return {**result, "status": "configuration_required", "items": [{"title": "View Texas road conditions", "description": "Official TxDOT road conditions and closures.", "url": "https://drivetexas.org/"}], "note": "Add an approved DRIVETEXAS_API_KEY to backend/.env to load road conditions here."}
    if category in ("food", "medical"):
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
                around = f"(around:10000,{lat},{lon})"
                tags = [("amenity", "hospital"), ("amenity", "clinic"), ("amenity", "pharmacy"), ("healthcare", "hospital"), ("healthcare", "clinic"), ("healthcare", "pharmacy")] if category == "medical" else [("amenity", "food_bank"), ("social_facility", "food_bank"), ("social_facility", "soup_kitchen"), ("amenity", "community_centre"), ("shop", "supermarket"), ("amenity", "drinking_water")]
                query = '[out:json][timeout:8];(' + ''.join(f'nwr["{key}"="{value}"]{around};' for key, value in tags) + ');out center tags 30;'
                data = await query_overpass(client, query)
                result["items"] = [{"title": e.get("tags", {}).get("name") or e.get("tags", {}).get("amenity") or e.get("tags", {}).get("shop") or e.get("tags", {}).get("healthcare") or "Mapped resource", "description": ", ".join(e.get("tags", {}).get(k, "") for k in ("addr:housenumber", "addr:street", "addr:city") if e.get("tags", {}).get(k)), "phone": e.get("tags", {}).get("phone") or e.get("tags", {}).get("contact:phone"), "coordinates": {"latitude": e.get("lat", e.get("center", {}).get("lat")), "longitude": e.get("lon", e.get("center", {}).get("lon"))}, "details": "Hours: " + e.get("tags", {}).get("opening_hours", "not reported"), "url": f"https://www.openstreetmap.org/{e['type']}/{e['id']}"} for e in data.get("elements", [])]
                result["note"] = "OpenStreetMap contributors (ODbL). Up to 30 mapped locations within 10 km of the selected county center (not the entire county). " + ("Hospitals, clinics, and pharmacies are community-mapped; confirm hours and medical services directly." if category == "medical" else "Community centers and supermarkets are not necessarily aid distribution sites. Supplies and potable water are not verified.")
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
        return {**result, "status": "unavailable", "note": str(error), "items": [{"title": "Search OpenStreetMap directly", "description": "Open the map to search mapped locations while the API is unavailable.", "url": f"https://www.openstreetmap.org/search?query={search.replace(' ', '%20')}#map=13/{lat}/{lon}"}]}
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return {**result, "status": "unavailable", "items": [], "note": "This provider could not return results. Check provider access, quota, or try again later. No sample locations have been substituted."}
