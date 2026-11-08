import type { FeatureCollection, Geometry } from 'geojson'
export interface SourceResult<T> {
  name: string; classification: string; sourceUrl: string; vintage: string
  retrievedAt: string; status: 'available' | 'unavailable' | 'configuration_required'; data: T | null; error: string | null
}
export interface PublicAlert {
  kind?: string; source?: string; category?: string; magnitude?: number | null; id: string; event: string; severity: string; urgency: string; certainty: string; area: string
  headline: string | null; description: string | null; instruction: string | null
  sent: string | null; effective: string | null; expires: string | null; ends: string | null
  stateCodes?: string[]; countyIds: string[]; geometry: Geometry | null; sourceUrl: string
}
export interface DeclarationRecord {
  id: string; disasterNumber: number; declaration: string; title: string; type: string; declarationType: string
  declaredAt: string; beganAt: string | null; endedAt: string | null; area: string; countyId: string; updatedAt: string | null
}
export interface DeclarationData { records: DeclarationRecord[]; limit: number; truncated: boolean }
export interface NriCounty {
  countyId: string; name: string; riskScore: number | null; riskRating: string | null
  expectedAnnualLoss: number | null; socialVulnerabilityScore: number | null; socialVulnerabilityRating: string | null
  resilienceScore: number | null; resilienceRating: string | null; hurricaneRating: string | null
  inlandFloodRating: string | null; coastalFloodRating: string | null
}
export interface AcsMetric { estimate: number | null; marginOfError: number | null; variable: string }
export interface AcsData {
  countyId: string; name: string; period: string; population: AcsMetric; households: AcsMetric
  noVehicleHouseholds: AcsMetric; vehicleUniverse: AcsMetric; noInternetHouseholds: AcsMetric; internetUniverse: AcsMetric
  noVehiclePercent: number | null; noInternetPercent: number | null
}
export interface PublicStateData {
  state: string; generatedAt: string; sources: {
    acs?: SourceResult<{ counties: {countyId:string;name:string;population:number|null;households:number|null;noVehiclePercent:number|null;noInternetPercent:number|null}[];period:string }>;
    earthquakes?: SourceResult<{events:PublicAlert[];window:string;generated:string|null}>;
    noaa: SourceResult<{ alerts: PublicAlert[]; updated: string | null; truncated: boolean }>
    fema: SourceResult<DeclarationData>; boundaries: SourceResult<FeatureCollection<Geometry>>
    nri: SourceResult<{ counties: NriCounty[] }>
  }
}
export interface PublicCountyData {
  countyId: string; generatedAt: string; sources: {
    acs: SourceResult<AcsData>; fema: SourceResult<DeclarationData>; nri: SourceResult<{ counties: NriCounty[] }>
  }
}
export interface PublicMapData {
  counties: FeatureCollection<Geometry>; tracts?: FeatureCollection<Geometry>; alerts: PublicAlert[]
  risk: NriCounty[]; declarationCountyIds: string[]; showAlerts: boolean; showRisk: boolean; showDeclarations: boolean
}
export const stateOptions = 'AL:01:Alabama|AK:02:Alaska|AZ:04:Arizona|AR:05:Arkansas|CA:06:California|CO:08:Colorado|CT:09:Connecticut|DE:10:Delaware|DC:11:District of Columbia|FL:12:Florida|GA:13:Georgia|HI:15:Hawaii|ID:16:Idaho|IL:17:Illinois|IN:18:Indiana|IA:19:Iowa|KS:20:Kansas|KY:21:Kentucky|LA:22:Louisiana|ME:23:Maine|MD:24:Maryland|MA:25:Massachusetts|MI:26:Michigan|MN:27:Minnesota|MS:28:Mississippi|MO:29:Missouri|MT:30:Montana|NE:31:Nebraska|NV:32:Nevada|NH:33:New Hampshire|NJ:34:New Jersey|NM:35:New Mexico|NY:36:New York|NC:37:North Carolina|ND:38:North Dakota|OH:39:Ohio|OK:40:Oklahoma|OR:41:Oregon|PA:42:Pennsylvania|RI:44:Rhode Island|SC:45:South Carolina|SD:46:South Dakota|TN:47:Tennessee|TX:48:Texas|UT:49:Utah|VT:50:Vermont|VA:51:Virginia|WA:53:Washington|WV:54:West Virginia|WI:55:Wisconsin|WY:56:Wyoming|PR:72:Puerto Rico'.split('|').map(row => { const [code, fips, name] = row.split(':'); return { code, fips, name } })
