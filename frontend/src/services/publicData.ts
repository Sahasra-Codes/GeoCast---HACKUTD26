import {scenarioUrl} from './scenario'
﻿import type { FeatureCollection, Geometry } from 'geojson'
import type { PublicStateData, PublicCountyData, PublicInsightsData, SourceResult } from '../publicDataTypes'
const base = import.meta.env.VITE_PUBLIC_DATA_API_BASE_URL?.replace(/\/$/, '') || '/api/public'
async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(scenarioUrl(base + path), { signal })
  if (!response.ok) throw new Error('The public-data backend is unavailable. Start FastAPI on port 8000, then retry.')
  const value = await response.json()
  if (!value || typeof value !== 'object') throw new Error('The public-data service returned an invalid response.')
  return value as T
}
export const getPublicState = (state: string, signal?: AbortSignal) => request<PublicStateData>('/state/' + encodeURIComponent(state), signal)
export const getPublicCounty = (county: string, signal?: AbortSignal) => request<PublicCountyData>('/county/' + encodeURIComponent(county), signal)
export const getPublicTracts = (county: string, signal?: AbortSignal) => request<SourceResult<FeatureCollection<Geometry>>>('/boundaries/tracts/' + encodeURIComponent(county), signal)

export const getNationwideInsights = (signal?:AbortSignal) => request<PublicInsightsData>('/insights/all',signal)

export const getAggregateDemographics = (state:string,signal?:AbortSignal) => request<SourceResult<import('../publicDataTypes').AcsData>>('/demographics/'+encodeURIComponent(state),signal)
