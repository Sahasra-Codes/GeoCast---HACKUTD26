export const hazardOptions = [
 {id:'all',label:'All disasters',path:'/map',description:'All returned NWS alert types and observed earthquakes.'},
 {id:'hurricanes',label:'Hurricanes & tropical storms',path:'/disasters/hurricanes',description:'NWS hurricane, tropical storm, and typhoon products; historical FEMA hurricane declarations.'},
 {id:'floods',label:'Floods',path:'/disasters/floods',description:'NWS flood, coastal flood, flash flood, and storm-surge products.'},
 {id:'wildfires',label:'Wildfires & fire weather',path:'/disasters/wildfires',description:'NWS fire-weather, red-flag, smoke, and fire products. Fire-weather warnings are not fire-perimeter observations.'},
 {id:'tornadoes',label:'Tornadoes',path:'/disasters/tornadoes',description:'NWS tornado watches and warnings, plus separately labeled historical declarations.'},
 {id:'winter-storms',label:'Winter storms & cold',path:'/disasters/winter-storms',description:'NWS snow, ice, blizzard, freezing, cold, and winter-weather products.'},
 {id:'earthquakes',label:'Earthquakes',path:'/disasters/earthquakes',description:'USGS observed earthquakes in the past 24 hours. Magnitude is not a weather-warning severity.'},
 {id:'extreme-heat',label:'Extreme heat',path:'/disasters/extreme-heat',description:'NWS heat and excessive-heat products.'},
 {id:'severe-weather',label:'Severe weather & wind',path:'/disasters/severe-weather',description:'NWS thunderstorms, strong wind, lightning, hail, and marine weather products.'},
 {id:'other',label:'Other hazards',path:'/disasters/other',description:'Every returned event not covered by the named categories, including other NWS hazard products.'},
] as const
export type Hazard = typeof hazardOptions[number]['id']
export function classifyHazard(value:string): Hazard {
 const text=value.toLowerCase()
 if(/earthquake/.test(text))return 'earthquakes'
 if(/hurricane|tropical|typhoon/.test(text))return 'hurricanes'
 if(/flood|surge|dam break/.test(text))return 'floods'
 if(/fire|red flag|smoke/.test(text))return 'wildfires'
 if(/tornado/.test(text))return 'tornadoes'
 if(/winter|snow|ice|blizzard|freeze|frost|cold|avalanche|freezing/.test(text))return 'winter-storms'
 if(/heat/.test(text))return 'extreme-heat'
 if(/thunder|wind|lightning|hail|gale|marine|small craft|storm/.test(text))return 'severe-weather'
 return 'other'
}
export interface OfficialResource { id:string;title:string;agency:string;url:string;category:'assistance'|'shelter'|'preparedness'|'warnings';description:string;details:string;hazards:Hazard[] }
export const officialResources: OfficialResource[] = [
 {id:'fema-assistance',title:'Apply for disaster assistance',agency:'FEMA / DisasterAssistance.gov',url:'https://www.disasterassistance.gov/',category:'assistance',description:'Access the federal disaster-assistance application portal.',details:'Check the official portal for current eligibility, application steps, and declared-disaster assistance. GeoCast does not determine eligibility or submit an application.',hazards:['all']},
 {id:'find-a-shelter',title:'Find an open shelter',agency:'American Red Cross',url:'https://www.redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter.html',category:'shelter',description:'Use the Red Cross shelter directory for its latest published shelter information.',details:'Shelter listings and availability are maintained by the Red Cross. GeoCast links to the directory; it does not assert local beds, capacity, services, or current operating status.',hazards:['all']},
 {id:'official-weather-warnings',title:'Read official weather alerts',agency:'NOAA / National Weather Service',url:'https://www.weather.gov/alerts',category:'warnings',description:'Read the issuing weather service’s current alert information.',details:'Use the issuing office’s warning text, affected area, timing, and instructions. The radar layer measures reflectivity and is not a damage or shelter-availability report.',hazards:['all']},
 {id:'disaster-preparedness',title:'Prepare for emergencies',agency:'Ready.gov / FEMA',url:'https://www.ready.gov/',category:'preparedness',description:'Official disaster-preparedness information and planning resources.',details:'Choose the appropriate hazard on Ready.gov for its official guidance. GeoCast provides source links instead of generating unsourced safety instructions.',hazards:['all']},
 {id:'earthquake-information',title:'Explore observed earthquakes',agency:'US Geological Survey',url:'https://earthquake.usgs.gov/earthquakes/map/',category:'warnings',description:'View the USGS earthquake map and published event information.',details:'These are observed events, with magnitudes and review status. They are not an NWS warning product or a forecast of the next earthquake.',hazards:['earthquakes']},
 {id:'disaster-recovery',title:'Find recovery support',agency:'FEMA',url:'https://www.fema.gov/assistance/individual',category:'assistance',description:'Official information about individual and household recovery assistance.',details:'Review FEMA’s current program information and requirements. Historical declarations in GeoCast do not establish an individual’s eligibility or active application deadline.',hazards:['all']},
]
