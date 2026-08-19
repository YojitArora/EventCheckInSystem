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
            <span>Gemini 1.5 Flash Grounded</span>
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
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a custom question (e.g. How can we improve attendance next time?)..."
            className="form-input"
            style={{
              paddingRight: "6.5rem",
              paddingLeft: "1.25rem",
              paddingTop: "0.85rem",
              paddingBottom: "0.85rem",
              fontSize: "0.95rem",
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="btn btn-primary"
            style={{
              position: "absolute",
              right: "0.5rem",
              top: "50%",
              transform: "translateY(-50%)",
              padding: "0.45rem 1rem",
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
            Querying Gemini 1.5 Flash...
          </h3>
          <p style={{ fontSize: "0.85rem" }}>Injecting authoritative PostgreSQL statistics into prompt context</p>
        </div>
      ) : insightData ? (
        <div className="glass-panel animate-scale-up" style={{ padding: "2rem", border: "1px solid rgba(99, 102, 241, 0.35)", boxShadow: "var(--shadow-lg)" }}>
          {/* Source Indicator */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Bot size={20} color="#818cf8" />
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700 }}>AI Executive Summary</h3>
            </div>

            {insightData.source === "gemini" ? (
              <span className="badge badge-primary" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Sparkles size={12} />
                <span>Source: Gemini 1.5 Flash</span>
              </span>
            ) : (
              <span className="badge badge-amber" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Database size={12} />
                <span>Source: Database Fallback</span>
              </span>
            )}
          </div>

          {/* AI Narrative Body */}
          <div
            style={{
              fontSize: "1rem",
              lineHeight: 1.7,
              color: "var(--text-primary)",
              whiteSpace: "pre-line",
              marginBottom: "1.75rem",
              background: "rgba(0, 0, 0, 0.2)",
              padding: "1.25rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {insightData.insight}
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
