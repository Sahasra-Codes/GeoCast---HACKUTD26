import unittest
from unittest.mock import patch, AsyncMock
from fastapi import HTTPException
from backend.app import public_data as public
from backend.app import relief_context as relief

def source(data):
    return {'name':'Test source','status':'available','retrievedAt':public.now(),'data':data,'error':None}

class ReliefContextTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        public.CACHE.clear();public.LOCKS.clear();relief.LAST_GEOCODE=0
        self.feature={'id':'48113','properties':{'NAME':'Dallas County'},'geometry':{'type':'Polygon','coordinates':[[[-97,32],[-96,32],[-96,34],[-97,34],[-97,32]]]}}

    async def test_city_resolves_optional_county_and_reuses_insights_resources(self):
        warnings=[{'id':'local','countyIds':['48113'],'expires':'2099-01-01T00:00:00Z'},{'id':'elsewhere','countyIds':['48201'],'expires':'2099-01-01T00:00:00Z'},{'id':'ended','countyIds':['48113'],'ends':'2000-01-01T00:00:00Z','expires':'2099-01-01T00:00:00Z'}]
        unavailable={'source':'OSM','status':'unavailable','retrievedAt':public.now(),'items':[],'note':'Timeout'}
        shelters={'source':'FEMA Open Shelters','status':'available','retrievedAt':public.now(),'items':[],'note':'No open shelters reported'}
        with patch.object(public,'get_json',AsyncMock(return_value=[{'lat':'32.78','lon':'-96.8','display_name':'Dallas, Texas'}])),patch.object(public,'boundaries',AsyncMock(return_value=source({'features':[self.feature]}))),patch.object(public,'alerts',AsyncMock(return_value=source({'alerts':warnings}))),patch.object(public,'demographics',AsyncMock(return_value=source({'population':{'estimate':1000}}))) as census,patch.object(relief,'resources',AsyncMock(return_value=unavailable)) as resources,patch.object(relief,'open_shelters',AsyncMock(return_value=shelters)):
            result=await relief.relief_context('Dallas','TX','')
        self.assertEqual(result['location']['countyId'],'48113')
        self.assertEqual([a['id'] for a in result['rankedLiveAlerts']],['local'])
        census.assert_awaited_once_with('48113')
        self.assertEqual([call.args[0] for call in resources.call_args_list],['food','medical','financial'])
        self.assertEqual(resources.call_args_list[0].kwargs['location'],'32.78,-96.8')
        self.assertEqual(result['resources']['food']['status'],'unavailable')
        self.assertIn('No open shelters reported',result['resources']['shelter']['note'])
        self.assertIn('retrievedAt',result['insights']['census'])

    async def test_county_state_mismatch_is_rejected_before_lookups(self):
        with self.assertRaises(HTTPException) as error:
            await relief.relief_context('Dallas','TX','06037')
        self.assertEqual(error.exception.status_code,422)

    async def test_unknown_city_is_not_replaced_by_an_arbitrary_county(self):
        with patch.object(public,'get_json',AsyncMock(return_value=[])),patch.object(public,'boundaries',AsyncMock(return_value=source({'features':[self.feature]}))):
            with self.assertRaises(HTTPException) as error:
                await relief.relief_context('Unknown city','TX','')
        self.assertEqual(error.exception.status_code,503)
        self.assertIn('City not found',str(error.exception.detail))
