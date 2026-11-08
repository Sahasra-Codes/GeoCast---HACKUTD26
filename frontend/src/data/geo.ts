import type {
  DisasterEvent,
  GeographicRegion,
  IntelligenceData,
  RiskPrediction,
} from "../types";
export type DisasterFilter = "all" | DisasterEvent["type"];
export type RequestStatus =
  "Unassigned" | "Assigned" | "In progress" | "Resolved";
export interface AssistanceRequest {
  id: string;
  countyId: string;
  title: string;
  description: string;
  households: number;
  status: RequestStatus;
  assignee: string;
  delayed?: boolean;
  urgency: "High" | "Moderate";
}
export interface CommunityProfile {
  countyId: string;
  population: number;
  needIds: string[];
  indicators: { label: string; value: number }[];
}
export interface MapFilters {
  disaster: DisasterFilter;
  needs: string[];
  match: "any" | "all";
  regionId?: string;
}
export const needCategories = [
  {
    title: "Medical urgency",
    icon: "medical",
    needs: [
      "Medication Access",
      "Healthcare Access",
      "Medical Equipment",
      "Emergency Care",
    ],
  },
  {
    title: "Accessibility & mobility",
    icon: "mobility",
    needs: [
      "Evacuation Assistance",
      "Limited Transportation",
      "Mobility Support",
      "Disability Access",
    ],
  },
  {
    title: "Visibility & communication",
    icon: "visibility",
    needs: [
      "Power Outages",
      "Internet Outages",
      "Communication Barriers",
      "Limited Reporting",
    ],
  },
  {
    title: "Assistance status & delays",
    icon: "assistance",
    needs: [
      "Unassigned Requests",
      "Delayed Assistance",
      "Resource Shortages",
      "Awaiting Response",
    ],
  },
  {
    title: "Basic necessities",
    icon: "basic",
    needs: [
      "Food Insecurity",
      "Shelter Shortages",
      "Clean Water",
      "Essential Supplies",
    ],
  },
];
export const disasterOptions: { value: DisasterFilter; label: string }[] = [
  { value: "all", label: "All disasters" },
  { value: "Hurricane", label: "Hurricanes" },
  { value: "Flood", label: "Floods" },
  { value: "Wildfire", label: "Wildfires" },
  { value: "Tornado", label: "Tornadoes" },
  { value: "Winter storm", label: "Winter storms" },
  { value: "Earthquake", label: "Earthquakes" },
  { value: "Extreme heat", label: "Extreme heat" },
];
// Profiles and requests are synthetic fixtures, separate from public geographic boundaries.
export function createProfiles(
  predictions: RiskPrediction[],
): CommunityProfile[] {
  return predictions.map((p, i) => ({
    countyId: p.countyId,
    population: Math.round((p.exposedPopulation * 6.2) / 100) * 100,
    needIds: [
      "Food Insecurity",
      "Shelter Shortages",
      "Clean Water",
      "Essential Supplies",
      ...(i % 2 === 0
        ? [
            "Medication Access",
            "Healthcare Access",
            "Limited Transportation",
            "Power Outages",
            "Unassigned Requests",
            "Delayed Assistance",
          ]
        : [
            "Medical Equipment",
            "Emergency Care",
            "Evacuation Assistance",
            "Communication Barriers",
            "Resource Shortages",
            "Awaiting Response",
          ]),
      ...(p.riskScore > 80
        ? ["Mobility Support", "Disability Access", "Internet Outages"]
        : ["Limited Reporting"]),
    ],
    indicators: [
      { label: "Food insecurity", value: 55 + (i % 5) * 7 },
      { label: "Medical vulnerability", value: 42 + (i % 4) * 11 },
      {
        label: "Transportation barriers",
        value: p.vulnerability[1]?.value || 48,
      },
      {
        label: "Socioeconomic vulnerability",
        value: p.vulnerability[2]?.value || 72,
      },
    ],
  }));
}
export function createRequests(
  profiles: CommunityProfile[],
): AssistanceRequest[] {
  return profiles.flatMap((p, i) => [
    {
      id: `GEO-${p.countyId}-01`,
      countyId: p.countyId,
      title: "Medication delivery",
      delayed: i % 3 === 0,
      description:
        "Synthetic request to coordinate access to essential medication. No real person or request is represented.",
      households: 3 + (i % 4),
      status: "Unassigned" as const,
      assignee: "",
      urgency: "High" as const,
    },
    {
      id: `GEO-${p.countyId}-02`,
      countyId: p.countyId,
      title: "Temporary shelter",
      delayed: i % 4 === 0,
      description:
        "Synthetic request for temporary accommodation and accessible transport to a shelter.",
      households: 8 + (i % 5),
      status: "In progress" as const,
      assignee: "Community response team",
      urgency: "High" as const,
    },
    {
      id: `GEO-${p.countyId}-03`,
      countyId: p.countyId,
      title: "Food & water supplies",
      description:
        "Synthetic request to coordinate household essentials. Resource availability is unverified.",
      households: 12 + (i % 9),
      status: "Assigned" as const,
      assignee: "Regional logistics team",
      urgency: "Moderate" as const,
    },
  ]);
}
export function matchingCountyIds(
  filters: MapFilters,
  profiles: CommunityProfile[],
  data: IntelligenceData,
): string[] {
  const applicableEvents = data.events.filter(
    (e) => filters.disaster === "all" || e.type === filters.disaster,
  );
  const eventCountyIds = new Set(
    applicableEvents.flatMap((e) => e.affectedCountyIds || [e.countyId]),
  );
  return profiles
    .filter((p) => {
      if (!eventCountyIds.has(p.countyId)) return false;
      if (
        filters.regionId &&
        !(filters.regionId.length === 2
          ? p.countyId.startsWith(filters.regionId)
          : p.countyId === filters.regionId)
      )
        return false;
      return (
        !filters.needs.length ||
        (filters.match === "all"
          ? filters.needs.every((n) => p.needIds.includes(n))
          : filters.needs.some((n) => p.needIds.includes(n)))
      );
    })
    .map((p) => p.countyId);
}
export function regionTitle(region: GeographicRegion): string {
  return region.kind === "state"
    ? region.name
    : `${region.name}${region.state === "Louisiana" ? " Parish" : " County"}`;
}
export const demoPlaces = [
  { name: "Houston", zip: "77002", countyId: "48201", state: "Texas" },
  { name: "New Orleans", zip: "70112", countyId: "22071", state: "Louisiana" },
  { name: "Miami", zip: "33101", countyId: "12086", state: "Florida" },
  {
    name: "Wilmington",
    zip: "28401",
    countyId: "37129",
    state: "North Carolina",
  },
  { name: "Chico", zip: "95928", countyId: "06007", state: "California" },
  { name: "Pensacola", zip: "32501", countyId: "12033", state: "Florida" },
  { name: "Mobile", zip: "36602", countyId: "01097", state: "Alabama" },
  { name: "Biloxi", zip: "39530", countyId: "28047", state: "Mississippi" },
];
