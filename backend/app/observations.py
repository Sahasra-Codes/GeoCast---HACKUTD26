"""Observed radar metadata and earthquakes; no generated weather imagery."""
import asyncio
import math
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from fastapi import Response
from . import public_data as public

RADAR_WMS = 'https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows'
USGS = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'

async def radar_metadata():
    async def load():
        async with public.httpx.AsyncClient(timeout=20,follow_redirects=True) as client:
            response=await client.get(RADAR_WMS,params={'service':'WMS','version':'1.3.0','request':'GetCapabilities'})
        response.raise_for_status()
        try:
            root=ET.fromstring(response.content)
        except ET.ParseError:
            raise public.SourceError('NOAA returned invalid radar metadata.') from None
        ns={'w':'http://www.opengis.net/wms'}
        dimension=next((e for e in root.findall('.//w:Dimension',ns) if e.get('name')=='time'),None)
        if dimension is None: raise public.SourceError('No observed radar frame times are available.')
        frames=[t.strip() for t in (dimension.text or '').split(',') if t.strip()]
        if not frames: raise public.SourceError('No radar observations are currently published.')
        return {'frames':frames[-6:],'latest':frames[-1],'wmsUrl':RADAR_WMS,'layer':'conus_bref_qcd','coverage':'Contiguous United States','product':'NOAA MRMS quality-controlled base reflectivity','units':'dBZ'}
    return await public.source('radar:conus','NOAA MRMS radar','observed_radar',RADAR_WMS,'Provider observation timestamps; CONUS coverage; refreshed every two minutes',120,load)


def point_in_ring(point,ring):
    x,y=point
    inside=False
    previous=ring[-1]
    for current in ring:
        ax=x+((current[0]-x+180)%360)-180
        bx=x+((previous[0]-x+180)%360)-180
        ay,by=current[1],previous[1]
        if (ay>y)!=(by>y) and x<(bx-ax)*(y-ay)/(by-ay)+ax: inside=not inside
        previous=current
    return inside


def point_in_geometry(point,geometry):
    if not geometry: return False
    polygons=geometry.get('coordinates',[]) if geometry.get('type')=='MultiPolygon' else [geometry.get('coordinates',[])] if geometry.get('type')=='Polygon' else []
    for polygon in polygons:
        if polygon and point_in_ring(point,polygon[0]) and not any(point_in_ring(point,hole) for hole in polygon[1:]): return True
    return False


async def earthquakes(state,county_boundaries):
    async def global_feed():
        value=await public.get_json(USGS)
        if value.get('type')!='FeatureCollection': raise public.SourceError('USGS returned an invalid earthquake feed.')
        return value
    async def load():
        if county_boundaries['status']!='available': raise public.SourceError('County geometry is unavailable; earthquake locations cannot be associated with the selected state.')
        result=await public.source('usgs:global','USGS earthquake feed','observed_events',USGS,'Past 24 hours; retrieved at most every minute',60,global_feed)
        if result['status']!='available': raise public.SourceError(result['error'])
        counties=county_boundaries['data']['features']
        lookup=[]
        def vertices(value):
            if not isinstance(value,list): return
            if value and isinstance(value[0],(float,int)): yield value
            else:
                for item in value: yield from vertices(item)
        for county in counties:
            points=list(vertices(county['geometry'].get('coordinates',[])))
            if not points: continue
            lookup.append((county,(min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points),max(p[1] for p in points))))
        timestamp=lambda value: datetime.fromtimestamp(value/1000,timezone.utc).isoformat() if isinstance(value,(float,int)) else None
        events=[]
        for item in result['data']['features']:
            geometry=item.get('geometry') or {}
            if geometry.get('type')!='Point': continue
            coordinates=geometry['coordinates']; lng,lat=coordinates[:2]
            matched=[]
            for county,(west,south,east,north) in lookup:
                if south<=lat<=north and (west<=lng<=east or east-west>180) and point_in_geometry((lng,lat),county['geometry']): matched.append(str(county['id']))
            if not matched: continue
            p=item.get('properties') or {}
            if p.get('type')!='earthquake': continue
            magnitude=p.get('mag')
            events.append({'id':'usgs:'+str(item['id']),'event':'Earthquake'+(f' M{magnitude:g}' if isinstance(magnitude,(int,float)) else ''),'category':'earthquakes','source':'USGS','kind':'observed_earthquake','magnitude':magnitude,'severity':'Not applicable','urgency':'Not applicable','certainty':p.get('status','Not supplied'),'area':p.get('place') or ', '.join(matched),'headline':p.get('title'),'description':'Observed earthquake epicenter. Magnitude is not a weather warning severity or an impact estimate.','instruction':None,'sent':timestamp(p.get('time')),'effective':timestamp(p.get('updated')),'expires':None,'ends':None,'countyIds':matched,'geometry':{'type':'Point','coordinates':coordinates[:2]},'sourceUrl':p.get('url') or 'https://earthquake.usgs.gov/'})
        return {'events':events,'window':'Past 24 hours','generated':timestamp(result['data'].get('metadata',{}).get('generated'))}
    return await public.source('usgs:'+state,'USGS observed earthquakes','observed_events',USGS,'Past 24 hours; epicenters joined to TIGER counties; not a warning feed',60,load)


@public.router.get('/radar')
async def get_radar(): return await radar_metadata()
