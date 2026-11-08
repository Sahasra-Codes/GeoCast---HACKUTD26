export type GuidanceCategory='shelter'|'food'|'medical'|'financial'|'safety'|'demographics'|'planning'
export const generalLinks:Record<GuidanceCategory,{title:string;url:string}[]>={
 shelter:[{title:'Red Cross shelter directory',url:'https://www.redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter.html'}],
 food:[{title:'Feeding America food bank locator',url:'https://www.feedingamerica.org/find-your-local-foodbank'}],
 medical:[{title:'Medicare hospital directory',url:'https://www.medicare.gov/care-compare/?providerType=Hospital'},{title:'HRSA health center locator',url:'https://findahealthcenter.hrsa.gov/'}],
 financial:[{title:'Official disaster assistance information',url:'https://www.disasterassistance.gov/'}],
 safety:[{title:'Official NWS alerts',url:'https://www.weather.gov/alerts'},{title:'NWS hurricane safety',url:'https://www.weather.gov/safety/hurricane'},{title:'NWS flood safety',url:'https://www.weather.gov/safety/flood'}],
 demographics:[{title:'Census community estimates',url:'https://www.census.gov/programs-surveys/acs/'}],
 planning:[{title:'Ready.gov planning guidance',url:'https://www.ready.gov/plan'},{title:'Official NWS alerts',url:'https://www.weather.gov/alerts'}]
}
export function generalPlan(city:string,state:string,countyId='',simulated=false){
 const text=[simulated?'SIMULATED: Hurricane Marlow (fictional)':'General relief planning guidance',
  'Local information or plan generation could not load. This guide does not confirm current local conditions, open facilities, or evacuation orders.',
  '### Situation',`Requested area: ${city}, ${state}. Check official NWS alerts and instructions from local authorities.`,
  '### First 6 hours','- Verify local conditions and official instructions.','- Identify transport, accessibility, and communication needs through local assessment.',
  '### Next 24-72 hours','- Verify shelter operations and resource access before directing anyone there.','- Record proposed tasks, responsible roles, and the next check-in time.',
  '### Community needs','- Use real Census estimates when available. Do not replace missing county figures with national averages.','- Keep household percentages separate from resident counts.',
  '### Resource coordination','- Confirm food distribution hours, medical services, and shelter availability directly. Directories do not establish current availability.',
  ...(['shelter','food','medical'] as const).flatMap(kind=>generalLinks[kind].map(link=>`- [${link.title}](${link.url})`)),
  '### Sources and gaps',...generalLinks.planning.map(link=>`- [${link.title}](${link.url})`),'- Local counts, impacts, resource capacity, and facility availability remain unverified.'
 ].join('\n\n')
 return {id:'general-'+Date.now(),title:simulated?'SIMULATED: Hurricane Marlow (fictional) - general relief guidance':`Relief guidance for ${city}, ${state}`,text,generatedAt:new Date().toISOString(),draft:true,model:'none',source:'general_guidance',fallback:true,simulated,alerts:[],location:{city,state,countyId,countyName:'Selected area'}}
}
