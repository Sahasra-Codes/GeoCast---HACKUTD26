import { useState } from "react";
import { ChevronRight, CircleCheck, UserRound } from "lucide-react";
import type { AssistanceRequest, RequestStatus } from "../data/geo";
export default function AssistanceTracker({
  requests,
  onUpdate,
}: {
  requests: AssistanceRequest[];
  onUpdate: (request: AssistanceRequest) => void;
}) {
  const [expanded, setExpanded] = useState<string>();
  return (
    <section className="assistance-tracker">
      <div className="detail-section-title">
        <h3>Assistance coordination</h3>
        <span className="demo-label">Synthetic</span>
      </div>
      <div className="coordination-summary">
        <span>
          <strong>
            {requests.filter((r) => r.status === "Unassigned").length}
          </strong>
          Unassigned
        </span>
        <span>
          <strong>
            {requests.filter((r) => r.status === "In progress").length}
          </strong>
          In progress
        </span>
        <span>
          <strong>
            {requests.filter((r) => r.status === "Resolved").length}
          </strong>
          Resolved
        </span>
        <span>
          <strong>
            {
              requests.filter((r) => r.delayed && r.status !== "Resolved")
                .length
            }
          </strong>
          Delayed
        </span>
      </div>
      <p className="detail-note">
        Practice coordinating example requests. Changes are local to this demo
        session.
      </p>
      <div className="request-list">
        {requests.map((request) => (
          <article
            className={`request-item ${expanded === request.id ? "expanded" : ""}`}
            key={request.id}
          >
            <button
              className="request-summary"
              onClick={() =>
                setExpanded(expanded === request.id ? undefined : request.id)
              }
              aria-expanded={expanded === request.id}
            >
              <span
                className={`request-dot ${request.urgency.toLowerCase()}`}
              />
              <span>
                <strong>{request.title}</strong>
                <small>{request.households} households · Demo request</small>
              </span>
              <span
                className={`request-status ${request.status.toLowerCase().replace(" ", "-")}`}
              >
                {request.status}
              </span>
              <ChevronRight size={12} />
            </button>
            {expanded === request.id && (
              <div className="request-editor">
                <p>{request.description}</p>
                <label>
                  Status
                  <select
                    aria-label={`Status for ${request.title}`}
                    value={request.status}
                    onChange={(e) =>
                      onUpdate({
                        ...request,
                        status: e.target.value as RequestStatus,
                        delayed:
                          e.target.value === "Resolved"
                            ? false
                            : request.delayed,
                        assignee:
                          e.target.value === "Unassigned"
                            ? ""
                            : request.assignee || "Community response team",
                      })
                    }
                  >
                    {["Unassigned", "Assigned", "In progress", "Resolved"].map(
                      (s) => (
                        <option key={s}>{s}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  <UserRound size={12} />
                  Assigned team
                  <select
                    aria-label={`Assignee for ${request.title}`}
                    value={request.assignee}
                    onChange={(e) =>
                      onUpdate({
                        ...request,
                        assignee: e.target.value,
                        status: !e.target.value
                          ? "Unassigned"
                          : request.status === "Unassigned"
                            ? "Assigned"
                            : request.status,
                      })
                    }
                  >
                    <option value="">Unassigned</option>
                    <option>Community response team</option>
                    <option>Regional logistics team</option>
                    <option>Medical support team</option>
                  </select>
                </label>
                <label className="delay-label">
                  <input
                    type="checkbox"
                    aria-label={`Delayed response for ${request.title}`}
                    checked={request.delayed || false}
                    onChange={(e) =>
                      onUpdate({ ...request, delayed: e.target.checked })
                    }
                  />
                  Mark response as delayed
                </label>
                <span className="local-save">
                  <CircleCheck size={12} />
                  Changes update this demo only
                </span>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
