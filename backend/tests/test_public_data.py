import os
import unittest
from unittest.mock import AsyncMock, patch
import httpx
from backend.app.main import app
from backend.app import public_data as public

class PublicDataTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        public.CACHE.clear()
        public.LOCKS.clear()

    async def test_empty_earthquake_feed_is_an_available_empty_result(self):
        from backend.app.observations import earthquakes
        boundaries = {'status':'available','data':{'features':[]}}
        feed = {'type':'FeatureCollection','features':[],'metadata':{'generated':1700000000000}}
        with patch.object(public,'get_json',AsyncMock(return_value=feed)):
            result = await earthquakes('TX',boundaries)
        self.assertEqual(result['status'],'available')
        self.assertEqual(result['data']['events'],[])
        self.assertTrue(result['data']['generated'].startswith('2023-'))

    async def test_nationwide_alert_feed_has_no_state_constraint(self):
        payload = {'type':'FeatureCollection','features':[{'properties':{'id':'national-test','status':'Actual','event':'Flood Warning','severity':'Severe','geocode':{'SAME':['012117'],'UGC':['FLC117']}}}]}
        with patch.object(public,'get_json',AsyncMock(return_value=payload)) as fetch:
            result = await public.nationwide_alerts()
        self.assertEqual(result['status'],'available')
        self.assertEqual(fetch.call_args.args[1],{'status':'actual'})
        self.assertEqual(result['data']['alerts'][0]['stateCodes'],['FL'])

    async def test_noaa_preserves_null_geometry_and_real_county_ids(self):
        payload = {'type':'FeatureCollection','features':[{'geometry':None,'properties':{'id':'nws-1','status':'Actual','event':'Flood Warning','severity':'Severe','geocode':{'SAME':['048201']}}},{'geometry':None,'properties':{'status':'Test'}}]}
        with patch.object(public,'get_json',AsyncMock(return_value=payload)):
            result = await public.alerts('TX')
        self.assertEqual(result['classification'],'live_warnings')
        self.assertEqual(len(result['data']['alerts']),1)
        self.assertEqual(result['data']['alerts'][0]['countyIds'],['48201'])
        self.assertIsNone(result['data']['alerts'][0]['geometry'])

    async def test_source_outage_is_not_an_empty_success(self):
        with patch.object(public,'get_json',AsyncMock(side_effect=httpx.ConnectError('offline'))):
            result = await public.alerts('TX')
        self.assertEqual(result['status'],'unavailable')
        self.assertIsNone(result['data'])

    async def test_missing_census_key_is_explicit(self):
        with patch.dict(os.environ,{'CENSUS_API_KEY':''}):
            result = await public.demographics('48201')
        self.assertEqual(result['status'],'configuration_required')
        self.assertIsNone(result['data'])

    async def test_acs_uses_its_own_universes_and_keeps_moe(self):
        table = [['NAME','B01003_001E','B01003_001M','B11001_001E','B11001_001M','B08201_001E','B08201_002E','B28002_001E','B28002_013E'],['Example County','1000','20','150','-666666666','100','10','200','40']]
        with patch.dict(os.environ,{'CENSUS_API_KEY':'test-key'}), patch.object(public,'get_json',AsyncMock(return_value=table)):
            result = await public.demographics('48201')
        data=result['data']
        self.assertEqual(data['population']['marginOfError'],20)
        self.assertIsNone(data['households']['marginOfError'])
        self.assertEqual(data['noVehiclePercent'],10)
        self.assertEqual(data['noInternetPercent'],20)
        self.assertEqual(result['classification'],'survey_estimates')

    async def test_fema_fips_and_historical_classification(self):
        payload={'DisasterDeclarationsSummaries':[{'id':'d1','disasterNumber':1,'fipsStateCode':'06','fipsCountyCode':'059'}]}
        with patch.object(public,'get_json',AsyncMock(return_value=payload)):
            result=await public.declarations('CA')
        self.assertEqual(result['data']['records'][0]['countyId'],'06059')
        self.assertEqual(result['classification'],'historical_records')

    async def test_geometry_and_identifier_preserved(self):
        payload={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'GEOID':'48201'},'geometry':{'type':'Polygon','coordinates':[[[-96,29],[-95,29],[-95,30],[-96,29]]]}}]}
        with patch.object(public,'get_json',AsyncMock(return_value=payload)):
            result=await public.boundaries('TX')
        self.assertEqual(result['data']['features'][0]['id'],'48201')
        self.assertEqual(result['classification'],'geographic_boundaries')

    async def test_invalid_locations_rejected_before_upstream_calls(self):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
            self.assertEqual((await client.get('/api/public/state/XX')).status_code,422)
            self.assertEqual((await client.get('/api/public/county/48bad')).status_code,422)
            self.assertEqual((await client.get('/api/public/county/48000')).status_code,422)

if __name__ == '__main__': unittest.main()
