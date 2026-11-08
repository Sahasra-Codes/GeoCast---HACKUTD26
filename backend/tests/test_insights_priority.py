import unittest
from unittest.mock import AsyncMock,patch
from backend.app import public_data as public
from backend.app import insights_priority as priority
class PriorityAdapterTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        public.CACHE.clear();public.LOCKS.clear()
    async def test_batch_is_one_call_per_table_and_cached(self):
        async def get(url,params):
            columns=params['get'].split(',')
            values={code:'10' for code in columns}
            values.update(NAME='Test County',B01001_001E='1000',B08201_001E='100',B08201_002E='20',B17001_001E='200',B17001_002E='40',B28002_001E='100',B28002_013E='30')
            return [columns+['state','county'],[values[code] for code in columns]+['48','001']]
        with patch.dict(priority.os.environ,{'CENSUS_API_KEY':'test'}),patch.object(public,'get_json',AsyncMock(side_effect=get)) as fetch:
            first=await priority.census_batch('TX');await priority.census_batch('TX')
        self.assertEqual(fetch.await_count,4)
        self.assertEqual(first['counties']['48001']['pct65plus'],12)
        self.assertEqual(first['counties']['48001']['pctNoVehicle'],20)
        self.assertEqual(first['counties']['48001']['pctBelowPoverty'],20)
        self.assertTrue(all(call.args[1]['for']=='county:*' for call in fetch.call_args_list))
    async def test_failed_table_retains_other_inputs(self):
        async def get(url,params):
            if 'B17001' in params['get']:raise public.SourceError('Unavailable')
            columns=params['get'].split(',');return [columns+['state','county'],['County']+['100']*(len(columns)-1)+['48','001']]
        with patch.dict(priority.os.environ,{'CENSUS_API_KEY':'test'}),patch.object(public,'get_json',AsyncMock(side_effect=get)):
            result=await priority.census_batch('TX')
        self.assertIn('48001',result['counties'])
        self.assertIsNone(result['counties']['48001']['pctBelowPoverty'])
        self.assertEqual(result['sources']['B17001']['status'],'unavailable')
    async def test_resource_adapter_awaits_shared_food_medical_and_shelter_loaders(self):
        existing={'source':'Mapped resource','retrievedAt':public.now(),'status':'available','items':[],'note':'No mapped records'}
        with patch.object(priority,'resources',AsyncMock(return_value=existing)) as loader,patch.object(priority,'open_shelters',AsyncMock(return_value=existing)) as shelter:
            result=await priority.county_resources('48001',30,-95)
        self.assertEqual(loader.await_count,2)
        self.assertEqual([call.args[0] for call in loader.call_args_list],['food','medical'])
        shelter.assert_awaited_once()
        self.assertEqual(set(result),{'shelter','food','medical'})

    async def test_open_shelters_empty_success_is_not_a_failure(self):
        from backend.app.resources import open_shelters
        with patch.object(public,'get_json',AsyncMock(return_value={'features':[]})) as fetch:
            result=await open_shelters();await open_shelters()
        self.assertEqual(fetch.await_count,1)
        self.assertEqual(result['status'],'available')
        self.assertEqual(result['note'],'No open shelters reported')

    async def test_open_shelters_pagination_coordinates_and_failures(self):
        from backend.app.resources import open_shelters
        pages=[{'features':[{'attributes':{'shelter_name':'Shelter A','state':'TX'},'geometry':{'x':-95,'y':30}}],'exceededTransferLimit':True},{'features':[]}]
        with patch.object(public,'get_json',AsyncMock(side_effect=pages)) as fetch:
            result=await open_shelters()
        self.assertEqual(fetch.await_count,2)
        self.assertEqual(fetch.call_args.args[1]['resultOffset'],1)
        self.assertEqual(result['items'][0]['coordinates'],{'latitude':30,'longitude':-95})
        public.CACHE.clear()
        with patch.object(public,'get_json',AsyncMock(side_effect=public.SourceError('Offline'))):
            result=await open_shelters()
        self.assertEqual(result['status'],'unavailable')
        self.assertNotIn('No open shelters reported',result['note'])
