import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  ChevronRight,
  CircleHelp,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { GeographicRegion, RiskPrediction } from "../types";

export default function AIInsightsPanel({
  region,
  prediction,
  onExplore,
}: {
  region?: GeographicRegion;
  prediction?: RiskPrediction;
  onExplore: () => void;
}) {
  return (
    <motion.section
      className="insights-section"
      key={region?.id || "overview"}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="section-heading">
        <span>
          <BrainCircuit size={15} />
          COMMUNITY INTELLIGENCE
        </span>
        <span className="ai-badge">AI ESTIMATE</span>
      </div>
      <h2>
        {region
          ? `${region.name}${region.kind === "county" && region.state !== "Louisiana" ? " County" : region.kind === "county" ? " Parish" : ""}`
          : "See beyond the storm."}
      </h2>
      <p className="muted location-line">
        <MapPin size={12} />
        {region
          ? `${region.state} · ${region.kind === "county" ? `FIPS ${region.id}` : "State overview"}`
          : "Explore community-level impact"}
      </p>
      {!prediction ? (
        <div className="empty-insights">
          <span className="insight-orbit">
            <BrainCircuit size={28} />
          </span>
          <h3>
            {region
              ? "No prediction for this area"
              : "People behind the predictions."}
          </h3>
          <p>
            {region
              ? "This demo includes model examples for 15 counties. Missing data does not mean low risk."
              : "Discover where exposure and vulnerability may leave communities with the greatest unmet needs."}
          </p>
          <button className="text-button" onClick={onExplore}>
            Explore a sample county
            <ArrowUpRight size={15} />
          </button>
        </div>
      ) : (
        <>
          <div className="risk-score">
            <div>
              <span className="eyebrow">ESTIMATED RISK SCORE</span>
              <div className="score-value">
                {prediction.riskScore}
                <small>/ 100</small>
              </div>
            </div>
            <div
              className="score-gauge"
              style={
                { "--score": `${prediction.riskScore}%` } as React.CSSProperties
              }
            >
              <span>
                {prediction.riskScore >= 80 ? "High" : "Elevated"}
                <small>relative risk</small>
              </span>
            </div>
          </div>
          <div className="population">
            <Users size={17} />
            <span>
              Potentially exposed
              <strong>
                {prediction.exposedPopulation.toLocaleString()}
                <small> people</small>
              </strong>
            </span>
            <span className="synthetic-label">SIMULATED</span>
          </div>
          <div className="small-heading">
            Vulnerability indicators
            <CircleHelp size={12} />
          </div>
          <div className="vulnerabilities">
            {prediction.vulnerability.map((v) => (
              <div key={v.label}>
                <div>
                  <span>{v.label}</span>
                  <strong>{v.value}%</strong>
                </div>
                <div className="meter">
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: `${v.value}%` }}
                    transition={{ duration: 0.7 }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="small-heading">
            Potential unmet needs
            <ArrowDownRight size={13} />
          </div>
          <div className="needs-list">
            {prediction.needs.map((n) => (
              <div key={n.label}>
                <span>{n.label}</span>
                <strong>
                  {n.households.toLocaleString()}
                  <small> households</small>
                </strong>
              </div>
            ))}
          </div>
          <details className="factors">
            <summary>
              What drives this estimate?
              <ChevronRight size={14} />
            </summary>
            <ul>
              {prediction.factors.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="confidence">
              <ShieldCheck size={14} />
              Illustrative confidence: {prediction.confidence}%
            </div>
          </details>
        </>
      )}
      <div className="estimate-disclaimer">
        <ShieldCheck size={14} />
        <p>
          Predictions, not verified impact.
          {prediction
            ? " All values are synthetic examples; confidence is not a validated calibration."
            : " Demo estimates are illustrative and not intended for operational decisions."}
        </p>
      </div>
    </motion.section>
  );
}
