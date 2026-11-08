"""Insights-only batch Census and resource adapters; existing pages retain their loaders."""
import asyncio
import os
import httpx
from fastapi import APIRouter, Query
from . import public_data as public
from .resources import resources, open_shelters
router=APIRouter(prefix='/api/public/priority',tags=['Insights priority'])
OLDER=[f'B01001_{i:03d}E' for i in [20,21,22,23,24,25,44,45,46,47,48,49]]
TABLES={'B01001':['B01001_001E']+OLDER,'B08201':['B08201_001E','B08201_002E'],'B17001':['B17001_001E','B17001_002E'],'B28002':['B28002_001E','B28002_013E']}
@router.get('/census/{state}')
async def census_batch(state:str, scenario:str=""):
    from .scenarios import enabled, snapshot
    if enabled(scenario) and state.upper() == "TX":
        from copy import deepcopy
        return deepcopy(snapshot()["census"])
    state='ALL' if state.upper()=='ALL' else public.state_code(state)
    async def table(name,columns):
        async def load():
            key=os.getenv('CENSUS_API_KEY','').strip()
            if not key: raise public.SourceError('Census API key is not configured.','configuration_required')
            result=await public.get_json(public.ACS,{'get':'NAME,'+','.join(columns),'for':'county:*','in':'state:'+('*' if state=='ALL' else public.STATES[state]),'key':key})
            if not isinstance(result,list) or len(result)<2: raise public.SourceError('No county estimates returned.')
            return {row['state']+row['county']:row for values in result[1:] for row in [dict(zip(result[0],values))]}
        return await public.source('priority:'+state+':'+name,'Census ACS 2024 '+name,'survey_estimates',public.ACS+'/groups/'+name+'.html','2020-2024 five-year estimates; sampling uncertainty applies',86400,load)
    sources=dict(zip(TABLES,await asyncio.gather(*(table(name,columns) for name,columns in TABLES.items()))))
    ids=sorted({id for source in sources.values() for id in (source['data'] or {})})
    def pct(row,numerators,denominator):
        values=[public.number(row.get(code)) for code in numerators];d=public.number(row.get(denominator))
        return sum(values)/d*100 if all(value is not None for value in values) and d and sum(values)<=d else None
    counties={}
    for id in ids:
        rows={name:(source['data'] or {}).get(id,{}) for name,source in sources.items()}
        counties[id]={'name':next((row['NAME'] for row in rows.values() if row.get('NAME')),id),'pct65plus':pct(rows['B01001'],OLDER,'B01001_001E'),'pctNoVehicle':pct(rows['B08201'],['B08201_002E'],'B08201_001E'),'pctBelowPoverty':pct(rows['B17001'],['B17001_002E'],'B17001_001E'),'pctNoInternet':pct(rows['B28002'],['B28002_013E'],'B28002_001E')}
    return {'counties':counties,'sources':{name:{key:value for key,value in source.items() if key!='data'} for name,source in sources.items()}}

@router.get('/resources/{county}')
async def county_resources(county:str,lat:float=Query(ge=-90,le=90),lon:float=Query(ge=-180,le=180),scenario:str=""):
    from .scenarios import enabled, scenario_resources
    if enabled(scenario) and county.startswith("48"):
        return scenario_resources()
    county=public.county_code(county)
    state=next(state for state,fips in public.STATES.items() if fips==county[:2])
    async def load():
        values=await asyncio.gather(open_shelters(),*(resources(kind,location=f'{lat},{lon}',state=state,county=county) for kind in ['food','medical']),return_exceptions=True)
        return {name:({'source':'Resource loader','retrievedAt':public.now(),'status':'unavailable','items':[],'note':'Resource request failed.'} if isinstance(value,BaseException) else value) for name,value in zip(['shelter','food','medical'],values)}
    result=await public.source(f'priority-resources:{county}:{lat:.5f}:{lon:.5f}','Resource lookups','mapped_resources','https://www.openstreetmap.org/','Shared FEMA Open Shelters and Overpass loaders; cached 5 minutes',300,load)
    return result['data'] or {}
