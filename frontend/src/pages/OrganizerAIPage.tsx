import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  HelpCircle,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { aiApi } from "../api/ai.api";
import { eventsApi } from "../api/events.api";
import { AIInsightResponse, EventDetail } from "../types";

export const OrganizerAIPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);

  const [question, setQuestion] = useState("");
  const [insightData, setInsightData] = useState<AIInsightResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventId) {
      eventsApi.getEventById(eventId).then(setEvent).catch(console.error);
      // Auto-trigger default query on mount
      handleQuery("Provide a comprehensive attendance and gate traffic summary for this event.");
    }
  }, [eventId]);

  const handleQuery = async (queryText: string) => {
    if (!eventId || !queryText.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await aiApi.getInsights({
        eventId,
        question: queryText.trim(),
      });
      setInsightData(result);
      setQuestion("");
    } catch (err: any) {
      setError(err?.message || "Failed to generate AI insights.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    handleQuery(question);
  };

  const presetQuestions = [
    "Why are attendance numbers at this level?",
    "When was our peak check-in surge window?",
    "What operational advice do you have for gate staffing?",
    "Analyze the ratio of no-shows to checked-in attendees.",
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: "880px", margin: "0 auto" }}>
      {/* Top Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
        <Link
          to={eventId ? `/organizer/events/${eventId}/dashboard` : "/organizer/events"}
          className="btn btn-outline btn-sm"
        >
          <ArrowLeft size={16} />
          <span>Live Dashboard</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="badge badge-primary" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <Cpu size={12} />
            <span>Gemini Grounded AI</span>
          </span>
        </div>
      </div>

      {/* Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: "2rem",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%)",
          borderColor: "rgba(99, 102, 241, 0.3)",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Sparkles size={18} color="#818cf8" />
          <span style={{ fontSize: "0.8rem", color: "#a5b4fc", fontWeight: 700, textTransform: "uppercase" }}>
            AI Event Analytics
          </span>
        </div>

        <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>
          {event?.name || "Event Analytics"} Insights
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginTop: "0.25rem", maxWidth: "680px" }}>
          Ask questions in natural language. Gemini qualitative models analyze your real PostgreSQL statistics without hallucinating or inventing numbers.
        </p>
      </div>

      {/* Preset Question Chips */}
      <div style={{ marginBottom: "1.5rem" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
          Suggested Inquiries:
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {presetQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuery(q)}
              disabled={isLoading}
              className="btn btn-outline btn-sm"
              style={{
                fontSize: "0.8rem",
                borderRadius: "var(--radius-full)",
                background: "var(--bg-glass-subtle)",
                borderColor: "var(--border-glass)",
              }}
            >
              <MessageSquare size={12} color="#a5b4fc" />
              <span>{q}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Question Form */}
      <form onSubmit={handleFormSubmit} style={{ marginBottom: "2rem" }}>
        <div className="search-bar-container">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a custom question (e.g. How can we improve attendance next time?)..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "0.95rem",
              padding: "0.5rem 0",
              minWidth: 0,
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="btn btn-primary"
            style={{
              padding: "0.55rem 1.25rem",
              borderRadius: "var(--radius-md)",
              flexShrink: 0,
            }}
          >
            <span>{isLoading ? "Analyzing..." : "Ask AI"}</span>
            <Send size={14} />
          </button>
        </div>
      </form>

      {/* Error state */}
      {error && (
        <div
          className="glass-panel"
          style={{
            padding: "1.25rem",
            background: "var(--accent-rose-light)",
            borderColor: "rgba(244, 63, 94, 0.3)",
            color: "#fda4af",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* AI Insight Result Card */}
      {isLoading ? (
        <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              margin: "0 auto 1rem",
              border: "3px solid var(--border-glass)",
              borderTopColor: "var(--primary)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <h3 style={{ fontSize: "1.1rem", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
            Querying Gemini Flash...
          </h3>
          <p style={{ fontSize: "0.85rem" }}>Injecting authoritative PostgreSQL statistics into prompt context</p>
        </div>
      ) : insightData ? (
        <div className="glass-panel animate-scale-up" style={{ padding: "2rem", border: "1px solid rgba(99, 102, 241, 0.35)", boxShadow: "var(--shadow-lg)" }}>
          {/* Source Indicator & Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                }}
              >
                <Bot size={20} color="#818cf8" />
              </div>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>AI Executive Summary</h3>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Synthesized directly from live PostgreSQL check-in telemetry
                </span>
              </div>
            </div>

            {insightData.source === "gemini" ? (
              <span className="badge badge-primary" style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.35rem 0.75rem" }}>
                <Sparkles size={13} />
                <span>Source: Gemini Flash</span>
              </span>
            ) : (
              <span className="badge badge-amber" style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.35rem 0.75rem" }}>
                <Database size={13} />
                <span>Source: Database Fallback</span>
              </span>
            )}
          </div>

          {/* Main Executive Summary Paragraph */}
          <div
            style={{
              fontSize: "1.05rem",
              lineHeight: 1.65,
              color: "var(--text-primary)",
              marginBottom: "1.5rem",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(17, 24, 39, 0.6) 100%)",
              padding: "1.25rem 1.5rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(99, 102, 241, 0.25)",
              borderLeft: "4px solid var(--primary)",
            }}
          >
            {insightData.summary || insightData.insight || "AI summary currently unavailable."}
          </div>

          {/* Observations & Recommendations Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "1.25rem",
              marginBottom: "1.75rem",
            }}
          >
            {/* Key Observations */}
            <div
              style={{
                background: "rgba(17, 24, 39, 0.5)",
                border: "1px solid var(--border-glass)",
                borderRadius: "var(--radius-md)",
                padding: "1.25rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
                <TrendingUp size={16} color="#67e8f9" />
                <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#67e8f9", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Key Observations
                </h4>
              </div>

              {insightData.observations && insightData.observations.length > 0 ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {insightData.observations.map((obs, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.6rem",
                        fontSize: "0.875rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ color: "#06b6d4", fontSize: "1rem", lineHeight: 1, marginTop: "1px" }}>•</span>
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No specific observations recorded.</p>
              )}
            </div>

            {/* Strategic Recommendations */}
            <div
              style={{
                background: "rgba(17, 24, 39, 0.5)",
                border: "1px solid var(--border-glass)",
                borderRadius: "var(--radius-md)",
                padding: "1.25rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
                <Zap size={16} color="#34d399" />
                <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Actionable Recommendations
                </h4>
              </div>

              {insightData.recommendations && insightData.recommendations.length > 0 ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {insightData.recommendations.map((rec, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.6rem",
                        fontSize: "0.875rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ color: "#10b981", fontSize: "1rem", lineHeight: 1, marginTop: "1px" }}>•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No action items required.</p>
              )}
            </div>
          </div>

          {/* Grounding Statistics Grid */}
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, display: "block", marginBottom: "0.75rem" }}>
              Authoritative Grounding Metrics (PostgreSQL)
            </span>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "0.75rem",
                fontSize: "0.8rem",
              }}
            >
              <div style={{ padding: "0.6rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-muted)", display: "block" }}>Attendance</span>
                <strong style={{ color: "#34d399", fontSize: "0.95rem" }}>
                  {insightData.statistics.attendancePercentage}%
                </strong>
              </div>

              <div style={{ padding: "0.6rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-muted)", display: "block" }}>Checked In</span>
                <strong style={{ color: "var(--text-primary)", fontSize: "0.95rem" }}>
                  {insightData.statistics.checkedInCount} / {insightData.statistics.totalRegisteredAttendees}
                </strong>
              </div>

              <div style={{ padding: "0.6rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-muted)", display: "block" }}>No-Shows</span>
                <strong style={{ color: "#fde68a", fontSize: "0.95rem" }}>
                  {insightData.statistics.noShows}
                </strong>
              </div>

              <div style={{ padding: "0.6rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-muted)", display: "block" }}>Peak Hour</span>
                <strong style={{ color: "#fda4af", fontSize: "0.95rem" }}>
                  {insightData.statistics.peakCheckInTime ? insightData.statistics.peakCheckInTime.hour : "None"}
                </strong>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
