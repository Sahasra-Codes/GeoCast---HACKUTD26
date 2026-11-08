import {
  ArrowRight,
  Cross,
  HeartHandshake,
  House,
  MapPin,
  TriangleAlert,
  Users,
  Wind,
  X,
} from "lucide-react";
import { useState } from "react";
import type {
  AssistanceResource,
  GeographicRegion,
  IntelligenceData,
  RiskPrediction,
} from "../types";
import type { AssistanceRequest } from "../data/geo";
import { regionTitle } from "../data/geo";
export type GeoCastTab = "Map" | "Insights" | "Resources" | "Relief";
interface Props {
  data?: IntelligenceData;
  selectedRegion?: GeographicRegion;
  countyIds: string[];
  predictions: RiskPrediction[];
  tab: GeoCastTab;
  onTab: (tab: GeoCastTab) => void;
  onCounty: (id: string) => void;
  regions: GeographicRegion[];
  requests: AssistanceRequest[];
  onResource: (resource: AssistanceResource) => void;
}
export default function AreaOverview(props: Props) {
  const [mascotTip, setMascotTip] = useState(false);
  const predictions = props.selectedRegion
    ? props.predictions.filter((p) => p.countyId === props.selectedRegion!.id)
    : props.predictions.filter((p) => props.countyIds.includes(p.countyId));
  const exposed = predictions.reduce(
    (total, p) => total + p.exposedPopulation,
    0,
  );
  const resources = (props.data?.resources || []).filter((r) =>
    props.selectedRegion
      ? r.countyId === props.selectedRegion.id
      : props.countyIds.includes(r.countyId),
  );
  return (
    <aside className="area-overview" aria-label="Area overview">
      <div className="area-overview-heading">
        <span>
          <Wind size={24} />
        </span>
        <div>
          <h2>Area overview</h2>
          <p>
            {props.selectedRegion
              ? regionTitle(props.selectedRegion)
              : "Scenario footprint"}
          </p>
        </div>
      </div>
      <div className="overview-stats">
        <div>
          <Users size={23} />
          <span>
            <strong>{exposed.toLocaleString()}</strong>
            <small>Potentially exposed</small>
          </span>
        </div>
        <div>
          <TriangleAlert size={23} />
          <span>
            <strong>
              {predictions.filter((p) => p.riskScore >= 80).length}
            </strong>
            <small>High-need demo areas</small>
          </span>
        </div>
        <div>
          <House size={23} />
          <span>
            <strong>
              {resources.filter((r) => r.type === "Temporary shelter").length}
            </strong>
            <small>Example shelters · Unverified</small>
          </span>
        </div>
      </div>
      <span className="overview-demo">
        <span />
        Illustrative estimates, not live impact
      </span>
      <button
        className="relief-button"
        onClick={() => props.onTab("Resources")}
      >
        View relief resources
        <ArrowRight size={16} />
      </button>
      {props.tab === "Insights" && (
        <section className="overview-content">
          <div className="overview-section-label">Community risk estimates</div>
          {[...predictions]
            .sort((a, b) => b.riskScore - a.riskScore)
            .slice(0, 5)
            .map((p) => (
              <button
                className="overview-result"
                onClick={() => props.onCounty(p.countyId)}
                key={p.countyId}
              >
                <MapPin size={14} />
                <span>
                  {props.regions.find((r) => r.id === p.countyId)?.name ||
                    p.countyId}
                  <small>Synthetic risk score</small>
                </span>
                <strong>{p.riskScore}</strong>
              </button>
            ))}
          {!predictions.length && (
            <p>No estimates match the current filters.</p>
          )}
        </section>
      )}
      {props.tab === "Resources" && (
        <section className="overview-content">
          <div className="overview-section-label">
            Example assistance network
          </div>
          {resources.map((r) => (
            <button
              className="overview-result"
              onClick={() => props.onResource(r)}
              key={r.id}
            >
              <HeartHandshake size={17} />
              <span>
                {r.name}
                <small>{r.type} · Demo</small>
              </span>
              <ArrowRight size={13} />
            </button>
          ))}
          {!resources.length && <p>No example resources for this selection.</p>}
        </section>
      )}
      {props.tab === "Relief" && (
        <section className="overview-content">
          <div className="overview-section-label">
            Demo request coordination
          </div>
          <p>
            Choose a community to review and update synthetic assistance
            requests.
          </p>
          {Array.from(
            new Set(
              props.requests
                .filter((r) => props.countyIds.includes(r.countyId))
                .map((r) => r.countyId),
            ),
          )
            .slice(0, 4)
            .map((id) => (
              <button
                className="overview-result"
                key={id}
                onClick={() => props.onCounty(id)}
              >
                <Cross size={16} />
                <span>
                  {props.regions.find((r) => r.id === id)?.name || id}
                  <small>
                    {
                      props.requests.filter(
                        (r) => r.countyId === id && r.status === "Unassigned",
                      ).length
                    }{" "}
                    unassigned · Synthetic
                  </small>
                </span>
                <ArrowRight size={13} />
              </button>
            ))}
        </section>
      )}
      <div className="mascot-area">
        {mascotTip && (
          <div className="mascot-tip" role="status">
            <button
              aria-label="Close GEO tip"
              onClick={() => setMascotTip(false)}
            >
              <X size={13} />
            </button>
            <strong>Hi, I'm GEO!</strong>
            <p>
              Choose a disaster, explore the radar, and select a community to
              see where help may be needed. Everything here is a demo.
            </p>
          </div>
        )}
        <div className="mascot-orbit" />
        <button
          className="mascot-button"
          aria-label="Meet GEO, our mascot"
          onClick={() => setMascotTip(!mascotTip)}
        >
          <img
            src="/geo.png"
            alt="GEO, our globe mascot wearing a red State Farm cap"
          />
        </button>
        <span className="mascot-caption">
          A world of care. A neighbor's reach.
        </span>
      </div>
    </aside>
  );
}
