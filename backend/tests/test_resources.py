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
        self.assertTrue(all(i['url'].startswith('https://www.ready.gov/') for i in response.json()['items']))
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
            self.assertIn('pharmacy',call.call_args.kwargs['data']['data'])
            self.assertNotIn('X-Goog-Api-Key', call.call_args.kwargs['headers'])
    def test_red_cross_is_a_directory_not_live_status(self):
        data=self.client.get('/api/resources/shelter').json()
        self.assertEqual(data['source'],'American Red Cross')
        self.assertIn('redcross.org',data['items'][0]['url'])
        self.assertNotIn('status',data['items'][0])
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
            self.assertIn('timeout',data['note'])
            self.assertIn('openstreetmap.org/search',data['items'][0]['url'])

    def test_county_must_belong_to_state(self):
        self.assertEqual(self.client.get('/api/resources/safety?state=TX&county=06037').status_code,422)
    def test_fema_is_filtered_by_county(self):
        response=httpx.Response(200,json={'DisasterDeclarationsSummaries':[]},request=httpx.Request('GET','https://www.fema.gov'))
        with patch('backend.app.resources.httpx.AsyncClient.get',new_callable=AsyncMock,return_value=response) as call:
            self.client.get('/api/resources/financial?state=TX&county=48113')
            self.assertIn("fipsCountyCode eq '113'",call.call_args.kwargs['params']['$filter'])
