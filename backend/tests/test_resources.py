import os
import unittest
from unittest.mock import patch, AsyncMock
import httpx
from fastapi.testclient import TestClient
from backend.app.main import app

class ResourceTests(unittest.TestCase):
    def setUp(self):
        from backend.app.resources import OVERPASS_CACHE
        OVERPASS_CACHE.clear()
        self.client = TestClient(app)
    def test_guides_are_official_links(self):
        with patch('backend.app.resources.httpx.AsyncClient.get', new_callable=AsyncMock, side_effect=httpx.ConnectError('offline')):
            response = self.client.get('/api/resources/safety')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(i['url'].startswith(('https://www.ready.gov/','https://www.weather.gov/safety/')) for i in response.json()['items']))
    def test_missing_provider_keys_are_explicit(self):
        with patch.dict(os.environ, {'GOOGLE_PLACES_API_KEY': '', 'DRIVETEXAS_API_KEY': ''}):
            for category in ['transportation']:
                data=self.client.get(f'/api/resources/{category}?location=32.78,-96.80').json()
                self.assertEqual(data['status'], 'configuration_required')
                if category == 'medical': self.assertEqual(data['items'], [])
                else: self.assertEqual(data['items'][0]['url'], 'https://drivetexas.org/')
    def test_bad_state_rejected(self):
        self.assertEqual(self.client.get('/api/resources/shelter?state=invalid').status_code,422)
    def test_medical_uses_overpass_without_a_key(self):
        response=httpx.Response(200,json={'elements':[{'type':'node','id':2,'lat':32.78,'lon':-96.8,'tags':{'name':'Mapped clinic','amenity':'clinic','phone':'123'}}]},request=httpx.Request('POST','https://overpass-api.de/api/interpreter'))
        with patch.dict(os.environ,{'GOOGLE_PLACES_API_KEY':''}),patch('backend.app.resources.httpx.AsyncClient.post',new_callable=AsyncMock,return_value=response) as call:
            data=self.client.get('/api/resources/medical?location=32.78,-96.80').json()
            self.assertEqual(data['status'],'available')
            self.assertEqual(data['items'][0]['title'],'Mapped clinic')
            self.assertEqual(data['items'][0]['coordinates']['latitude'],32.78)
            self.assertIn('overpass-api.de',call.call_args.args[0])
            self.assertIn('hospital',call.call_args.kwargs['data']['data'])
            self.assertNotIn('pharmacy',call.call_args.kwargs['data']['data'])
            self.assertNotIn('X-Goog-Api-Key', call.call_args.kwargs['headers'])
    def test_real_shelter_search_excludes_fictional_and_distant_sites_in_simulation(self):
        result={'source':'FEMA Open Shelters','status':'available','retrievedAt':'2026-11-08','note':'Live feed','items':[
            {'title':'Real nearby shelter','state':'TX','coordinates':{'latitude':28.1,'longitude':-97.5}},
            {'title':'Real distant shelter','state':'TX','coordinates':{'latitude':32.8,'longitude':-96.8}},
            {'title':'Simulated Shelter A','state':'TX','simulated':True,'coordinates':{'latitude':28.0,'longitude':-97.5}}]}
        with patch('backend.app.resources.open_shelters',AsyncMock(return_value=result)):
            data=self.client.get('/api/resources/shelter?state=TX&county=48409&location=28.0,-97.5&scenario=hurricane-marlow').json()
        self.assertEqual([item['title'] for item in data['items']],['Real nearby shelter'])
        self.assertAlmostEqual(data['items'][0]['distanceMiles'],6.9,1)
        self.assertEqual(data['source'],'FEMA Open Shelters')
        self.assertIn('50 miles',data['note'])
        self.assertNotIn('fictional',data['note'])

    def test_no_open_shelters_are_not_replaced_with_fictional_sites(self):
        result={'source':'FEMA Open Shelters','status':'available','retrievedAt':'2026-11-08','items':[],'note':''}
        with patch('backend.app.resources.open_shelters',AsyncMock(return_value=result)):
            data=self.client.get('/api/resources/shelter?state=TX').json()
        self.assertEqual(data['items'],[])
        self.assertIn('No open shelters',data['emptyMessage'])
        self.assertIn('redcross.org',data['directoryUrl'])

    def test_state_shelter_search_filters_real_feed_by_state(self):
        result={'source':'FEMA Open Shelters','status':'available','retrievedAt':'2026-11-08','items':[{'title':'Texas shelter','state':'TX'},{'title':'Other shelter','state':'CA'}],'note':''}
        with patch('backend.app.resources.open_shelters',AsyncMock(return_value=result)):
            data=self.client.get('/api/resources/shelter?state=TX').json()
        self.assertEqual([item['title'] for item in data['items']],['Texas shelter'])
    def test_food_uses_overpass_without_a_google_key(self):
        response=httpx.Response(200,json={'elements':[{'type':'node','id':1,'tags':{'name':'Food bank'}}]},request=httpx.Request('POST','https://overpass-api.de/api/interpreter'))
        with patch.dict(os.environ,{'GOOGLE_PLACES_API_KEY':''}),patch('backend.app.resources.httpx.AsyncClient.post',new_callable=AsyncMock,return_value=response) as call:
            data=self.client.get('/api/resources/food?location=32.78,-96.80').json()
            self.assertEqual(data['items'][0]['title'],'Food bank')
            self.assertIn('overpass-api.de',call.call_args.args[0])
            self.assertIn('OpenStreetMap',data['note'])
    def test_coordinates_are_validated(self):
        self.assertEqual(self.client.get('/api/resources/food?location=nan,0').status_code,422)
    def test_transportation_is_texas_only(self):
        self.assertEqual(self.client.get('/api/resources/transportation?state=CA').json()['status'],'unsupported_region')

    def test_overpass_tries_fallback_after_primary_rejection(self):
        failed=httpx.Response(406,request=httpx.Request('POST','https://overpass-api.de/api/interpreter'))
        success=httpx.Response(200,json={'elements':[]},request=httpx.Request('POST','https://overpass.private.coffee/api/interpreter'))
        with patch('backend.app.resources.httpx.AsyncClient.post',new_callable=AsyncMock,side_effect=[failed,success]) as call:
            data=self.client.get('/api/resources/medical?location=32.98613,-96.75072').json()
            self.assertEqual(data['status'],'available')
            self.assertEqual(call.await_count,2)
    def test_overpass_outage_has_specific_error_and_map_link(self):
        with patch('backend.app.resources.httpx.AsyncClient.post',new_callable=AsyncMock,side_effect=httpx.ReadTimeout('timeout')):
            data=self.client.get('/api/resources/medical?location=32.98613,-96.75072').json()
            self.assertEqual(data['status'],'unavailable')
            self.assertEqual(data['note'],'Data temporarily unavailable. Please try again in 5 minutes.')
            self.assertIn('openstreetmap.org/search',data['items'][0]['url'])

    def test_county_must_belong_to_state(self):
        self.assertEqual(self.client.get('/api/resources/safety?state=TX&county=06037').status_code,422)
    def test_fema_is_filtered_by_county(self):
        response=httpx.Response(200,json={'DisasterDeclarationsSummaries':[]},request=httpx.Request('GET','https://www.fema.gov'))
        with patch('backend.app.resources.httpx.AsyncClient.get',new_callable=AsyncMock,return_value=response) as call:
            self.client.get('/api/resources/financial?state=TX&county=48113')
            self.assertIn("fipsCountyCode eq '113'",call.call_args.kwargs['params']['$filter'])

    def test_safety_includes_official_instructions_for_only_the_selected_county(self):
        response=httpx.Response(200,json={'features':[{'properties':{'event':'Flood Watch','headline':'County watch','instruction':'Monitor official warnings.','geocode':{'SAME':['048113']}}},{'properties':{'event':'Other county warning','instruction':'Elsewhere','geocode':{'SAME':['006037']}}}]},request=httpx.Request('GET','https://api.weather.gov/alerts/active'))
        with patch('backend.app.resources.httpx.AsyncClient.get',new_callable=AsyncMock,return_value=response):
            data=self.client.get('/api/resources/safety?state=TX&county=48113').json()
        self.assertEqual(data['items'][0]['title'],'Flood Watch')
        self.assertEqual(data['items'][0]['details'],'Monitor official warnings.')
        self.assertFalse(any(item['title']=='Other county warning' for item in data['items']))

    def test_overpass_supports_statewide_food_and_hospitals_without_county(self):
        response=httpx.Response(200,json={'elements':[]},request=httpx.Request('POST','https://overpass-api.de/api/interpreter'))
        with patch('backend.app.resources.httpx.AsyncClient.post',new_callable=AsyncMock,return_value=response) as call:
            for category,tag in [('food','food_bank'),('medical','hospital')]:
                data=self.client.get(f'/api/resources/{category}?state=TX').json()
                self.assertEqual(data['status'],'available')
                query=call.call_args.kwargs['data']['data']
                self.assertIn('US-TX',query)
                self.assertIn('area.searchArea',query)
                self.assertIn(tag,query)
                self.assertNotIn('supermarket',query)
                self.assertIn('statewide',data['note'])
    def test_statewide_overpass_failure_has_a_working_map_fallback(self):
        with patch('backend.app.resources.httpx.AsyncClient.post',new_callable=AsyncMock,side_effect=httpx.ReadTimeout('offline')):
            data=self.client.get('/api/resources/food?state=TX').json()
        self.assertEqual(data['status'],'unavailable')
        self.assertIn('in%20TX',data['items'][0]['url'])

    def test_facilities_use_real_names_and_actionable_contact_details(self):
        elements = [
            {'type':'node','id':1,'tags':{'amenity':'social_facility','social_facility':'food_bank'}},
            {'type':'way','id':2,'center':{'lat':32.7,'lon':-96.8},'tags':{
                'operator':'Community Pantry','addr:housenumber':'123','addr:street':'Main St',
                'addr:city':'Dallas','contact:phone':'+1 214 555 0100',
                'contact:website':'www.example.org','opening_hours':'Mo-Fr 09:00-17:00'}},
            {'type':'node','id':3,'tags':{'name':'Named pantry','website':'javascript:alert(1)'}}]
        response=httpx.Response(200,json={'elements':elements},request=httpx.Request('POST','https://overpass-api.de/api/interpreter'))
        with patch('backend.app.resources.httpx.AsyncClient.post',new_callable=AsyncMock,return_value=response):
            data=self.client.get('/api/resources/food?state=TX').json()
        self.assertEqual(len(data['items']),2)
        item=data['items'][0]
        self.assertEqual(item['title'],'Community Pantry')
        self.assertEqual(item['description'],'123 Main St, Dallas')
        self.assertEqual(item['phone'],'+1 214 555 0100')
        self.assertEqual(item['website'],'https://www.example.org')
        self.assertEqual(item['coordinates']['latitude'],32.7)
        self.assertIn('Mo-Fr',item['details'])
        self.assertIsNone(data['items'][1]['details'])
        self.assertIsNone(data['items'][1]['website'])
        self.assertIn('1 unnamed map records omitted',data['note'])

    def test_safety_guides_do_not_contain_fictional_alerts_with_simulation_enabled(self):
        response=httpx.Response(200,json={'features':[{'properties':{'event':'Flood Watch','instruction':'Monitor later forecasts.','geocode':{'SAME':['048047']}}}]},request=httpx.Request('GET','https://api.weather.gov/alerts/active'))
        with patch('backend.app.resources.httpx.AsyncClient.get',new_callable=AsyncMock,return_value=response):
            data=self.client.get('/api/resources/safety?state=TX&county=48047&scenario=hurricane-marlow').json()
        self.assertEqual(data['source'],'National Weather Service + Ready.gov')
        self.assertTrue(all(not item.get('simulated') for item in data['items']))
        self.assertFalse(any('Marlow' in item['title'] for item in data['items']))
        self.assertTrue(any(item['url']=='https://www.weather.gov/safety/hurricane' for item in data['items']))
