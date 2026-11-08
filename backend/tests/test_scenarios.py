import json
import unittest
from copy import deepcopy
from unittest.mock import AsyncMock,patch
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app import scenarios as scenario
from backend.app import public_data as public

class ScenarioTests(unittest.TestCase):
    def setUp(self): self.client=TestClient(app)
    def test_exact_counties_and_times_use_real_loaded_boundaries(self):
        definition=scenario.definition();self.assertEqual(len(scenario.county_ids()),18)
        names={str(f['id']):f['properties']['BASENAME'] for f in scenario.snapshot()['state']['sources']['boundaries']['data']['features']}
        expected=[{'Aransas','Refugio','San Patricio','Nueces','Kleberg','Calhoun'},{'Aransas','Refugio','San Patricio','Nueces','Kleberg','Calhoun'},{'Bee','Goliad','Live Oak','Jim Wells','Duval','McMullen','La Salle','Webb','Brooks','Starr','Zapata','Jim Hogg'}]
        for alert,county_names in zip(definition['alerts'],expected):
            self.assertEqual({names[id] for id in alert['countyIds']},county_names)
            self.assertTrue(alert['event'].startswith('SIMULATED:'));self.assertIn('Hurricane Marlow (fictional)',alert['headline'])
            self.assertTrue(alert['simulated']);self.assertEqual(alert['sent'],'2026-11-08T09:00:00-06:00');self.assertEqual(alert['ends'],'2026-11-09T12:00:00-06:00')
    def test_overlay_does_not_mutate_real_data_or_census(self):
        original=deepcopy(scenario.snapshot())
        data=scenario.scenario_state('TX');data['sources']['noaa']['data']['alerts'][0]['event']='changed'
        resources=scenario.scenario_resources();resources['shelter']['items'][0]['title']='changed'
        self.assertEqual(original,scenario.snapshot())
        self.assertEqual(len(scenario.scenario_state('TX')['sources']['noaa']['data']['alerts']),len(original['state']['sources']['noaa']['data']['alerts'])+3)
    def test_four_shelters_are_labeled_with_centroids_and_fictional_capacities(self):
        shelters=scenario.simulated_shelters();self.assertEqual([s['capacity'] for s in shelters],[400,250,180,300])
        features={str(f['id']):f for f in scenario.snapshot()['state']['sources']['boundaries']['data']['features']}
        for shelter in shelters:
            self.assertTrue(shelter['simulated']);self.assertEqual(shelter['coordinates'],scenario.centroid(features[shelter['countyId']]['geometry']))
    def test_scenario_routes_require_explicit_opt_in(self):
        data=self.client.get('/api/public/state/TX?scenario=hurricane-marlow').json()
        self.assertEqual(sum(bool(a.get('simulated')) for a in data['sources']['noaa']['data']['alerts']),3)
        self.assertEqual(self.client.get('/api/public/state/TX?scenario=unknown').status_code,422)
        self.assertEqual(self.client.get('/api/public/scenarios/hurricane-marlow/context/48201').status_code,422)
    def test_scenario_resources_and_census_use_snapshot_without_live_requests(self):
        with patch.object(public,'get_json',AsyncMock(side_effect=AssertionError('No live lookup needed'))):
            census=self.client.get('/api/public/priority/census/TX?scenario=hurricane-marlow').json()
            resources=self.client.get('/api/public/priority/resources/48131?lat=27.7&lon=-98.5&scenario=hurricane-marlow').json()
            food=self.client.get('/api/resources/food?state=TX&scenario=hurricane-marlow').json()
        self.assertEqual(census,scenario.snapshot()['census'])
        self.assertEqual(sum(bool(item.get('simulated')) for item in resources['shelter']['items']),4)
        self.assertEqual(food['status'],scenario.snapshot()['resources']['food']['status'])
    def test_every_scenario_county_has_a_labeled_plan_with_real_inputs(self):
        plans=json.loads((scenario.ROOT/'hurricane-marlow.plans.json').read_text(encoding='utf-8'))
        self.assertEqual(set(plans),set(scenario.county_ids()))
        for id,plan in plans.items():
            self.assertTrue(plan['simulated']);self.assertIn('Hurricane Marlow (fictional)',plan['text'])
            self.assertEqual(plan['evidence']['insights']['census']['data']['pct65plus'],scenario.snapshot()['census']['counties'][id]['pct65plus'])
