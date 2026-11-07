import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CircleHelp,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Users,
  Wind,
  X,
} from "lucide-react";
import type {
  AssistanceResource,
  DisasterEvent,
  GeographicRegion,
  RiskPrediction,
} from "../types";
import type { AssistanceRequest, CommunityProfile } from "../data/geo";
import { regionTitle } from "../data/geo";
import AssistanceTracker from "./AssistanceTracker";
interface Props {
  region?: GeographicRegion;
  event?: DisasterEvent;
  prediction?: RiskPrediction;
  profile?: CommunityProfile;
  requests: AssistanceRequest[];
  resources: AssistanceResource[];
  onUpdate: (request: AssistanceRequest) => void;
  onClose: () => void;
  onExplore: (event: DisasterEvent) => void;
}
export default function CommunityDetailsPanel(props: Props) {
  const { region, event, prediction, profile } = props;
  return (
    <motion.aside
      className="community-panel"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      aria-label="Community details"
    >
      <div className="community-panel-top">
        <span className="overline">
          {region ? "A CLOSER LOOK" : "DISASTER EXPLORATION"}
        </span>
        <button aria-label="Close details panel" onClick={props.onClose}>
          <X size={17} />
        </button>
      </div>
      <div className="community-scroll">
        <div className="community-heading">
          <span className="community-symbol">
            {region ? (
              <MapPin size={24} strokeWidth={1} />
            ) : (
              <Wind size={25} strokeWidth={1} />
            )}
          </span>
          <span className="demo-label">Illustrative scenario</span>
          <h2>{region ? regionTitle(region) : event?.name}</h2>
          <p>
            <MapPin size={12} />
            {region?.state || event?.area}
            <span>United States</span>
          </p>
        </div>
        {!region && event ? (
          <section className="event-detail-body">
            <span className={`severity ${event.severity}`}>
              {event.severity} severity
            </span>
            <p>{event.description}</p>
            <dl>
              <div>
                <dt>Disaster type</dt>
                <dd>{event.type}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{event.status}</dd>
              </div>
              <div>
                <dt>Example affected counties</dt>
                <dd>{event.affectedCountyIds?.length || 1}</dd>
              </div>
            </dl>
            <div className="paper-note">
              <ShieldCheck size={15} />
              <p>
                This event is a synthetic scenario, not a live or historical
                disaster report.
              </p>
            </div>
            <button
              className="find-button"
              onClick={() => props.onExplore(event)}
            >
              Explore communities
              <ArrowUpRight size={17} />
            </button>
          </section>
        ) : (
          <>
            {profile && prediction ? (
              <>
                <div className="community-stats">
                  <div>
                    <Users size={15} />
                    <strong>{profile.population.toLocaleString()}</strong>
                    <span>Illustrative population</span>
                  </div>
                  <div>
                    <Wind size={15} />
                    <strong>
                      {prediction.exposedPopulation.toLocaleString()}
                    </strong>
                    <span>Potentially exposed</span>
                  </div>
                </div>
                <div className="exposure-note">
                  <span className="small-dot" />
                  Synthetic estimates, not verified impact
                </div>
                <section className="vulnerability-section">
                  <div className="detail-section-title">
                    <h3>Community vulnerability</h3>
                    <CircleHelp size={13} />
                  </div>
                  {profile.indicators.map((v) => (
                    <div className="vulnerability-row" key={v.label}>
                      <div>
                        <span>{v.label}</span>
                        <strong>
                          {v.value}
                          <small>/100</small>
                        </strong>
                      </div>
                      <div className="indicator-track">
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: `${v.value}%` }}
                          style={{
                            background: v.value > 70 ? "#c18a64" : "#719885",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="risk-note">
                    <span>Illustrative risk score</span>
                    <strong>
                      {prediction.riskScore}
                      <small> / 100</small>
                    </strong>
                  </div>
                </section>
                <section className="potential-needs">
                  <div className="detail-section-title">
                    <h3>Potential assistance needs</h3>
                    <span className="demo-label">Estimated</span>
                  </div>
                  {prediction.needs.map((n, i) => (
                    <div key={n.label}>
                      <span className="need-number">0{i + 1}</span>
                      <span>{n.label}</span>
                      <strong>
                        {n.households.toLocaleString()}
                        <small> households</small>
                      </strong>
                    </div>
                  ))}
                  <p className="detail-note">
                    Modeled potential needs are not confirmed requests.
                    Categories may overlap.
                  </p>
                </section>
                <details className="prediction-explanation">
                  <summary>
                    Behind the estimate
                    <ArrowUpRight size={13} />
                  </summary>
                  <ul>
                    {prediction.factors.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <p>
                    Illustrative confidence: {prediction.confidence}%. This is
                    not a calibrated or validated model.
                  </p>
                </details>
                <AssistanceTracker
                  requests={props.requests}
                  onUpdate={props.onUpdate}
                />
              </>
            ) : (
              <div className="no-community-data">
                <GlobeIllustration />
                <h3>No demo estimate for this community.</h3>
                <p>
                  Public geography is available, but this prototype contains
                  synthetic profiles for only 15 counties. Missing data does not
                  mean no need.
                </p>
              </div>
            )}
            <section className="community-resources">
              <div className="detail-section-title">
                <h3>Example resources</h3>
                <HeartHandshake size={14} />
              </div>
              {props.resources.length ? (
                props.resources.map((r) => (
                  <div key={r.id}>
                    <HeartHandshake size={16} />
                    <span>
                      {r.name}
                      <small>{r.type} · Availability unverified</small>
                    </span>
                  </div>
                ))
              ) : (
                <p className="detail-note">
                  No resource listing in the demo dataset for this county.
                </p>
              )}
            </section>
          </>
        )}
        <div className="provenance-note">
          <ShieldCheck size={16} />
          <p>
            <strong>Know what you're looking at.</strong>Geographic boundaries
            are public US Census data. All population figures, vulnerability
            scores, needs, and requests shown here are synthetic. No confirmed
            emergency requests are connected.
          </p>
        </div>
      </div>
    </motion.aside>
  );
}
function GlobeIllustration() {
  return (
    <div className="empty-globe">
      <MapPin size={30} strokeWidth={1} />
    </div>
  );
}
