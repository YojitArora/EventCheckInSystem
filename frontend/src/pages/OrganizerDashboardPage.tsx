import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  LayoutDashboard,
  Percent,
  QrCode,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  UserX,
  Zap,
} from "lucide-react";
import { dashboardApi } from "../api/dashboard.api";
import { eventsApi } from "../api/events.api";
import { useSocket } from "../context/SocketContext";
import { CheckInSuccessPayload, EventDashboard, EventDetail } from "../types";

export const OrganizerDashboardPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { isConnected, subscribeToEvent } = useSocket();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [dashboard, setDashboard] = useState<EventDashboard | null>(null);
  const [liveFeed, setLiveFeed] = useState<Array<{ id: string; name: string; time: string; source: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchDashboardData = async () => {
    if (!eventId) return;
    try {
      const [eventData, dashData] = await Promise.all([
        eventsApi.getEventById(eventId),
        dashboardApi.getDashboard(eventId),
      ]);
      setEvent(eventData);
      setDashboard(dashData);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [eventId]);

  // Real-time Socket.IO subscription
  useEffect(() => {
    if (!eventId) return;

    const unsubscribe = subscribeToEvent(eventId, (payload: CheckInSuccessPayload) => {
      // 1. Update activity feed
      const newEntry = {
        id: payload.checkIn.id,
        name: payload.attendee.name,
        time: new Date(payload.checkIn.checkedInAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        source: payload.checkIn.source,
      };
      setLiveFeed((prev) => [newEntry, ...prev.slice(0, 19)]);

      // 2. Fetch fresh database stats to ensure PostgreSQL remains source of truth
      dashboardApi.getDashboard(eventId).then(setDashboard).catch(console.error);
    });

    return () => {
      unsubscribe();
    };
  }, [eventId, subscribeToEvent]);

  const handleExportCsv = async () => {
    if (!eventId || !event) return;
    setIsExporting(true);
    try {
      await dashboardApi.downloadCsv(eventId, event.name);
    } catch (err: any) {
      alert(err?.message || "Failed to export CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--text-muted)" }}>
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
        <p>Loading real-time event analytics...</p>
      </div>
    );
  }

  if (error || !event || !dashboard) {
    return (
      <div className="glass-panel" style={{ padding: "2rem", textAlign: "center" }}>
        <AlertCircle size={40} color="#f43f5e" style={{ margin: "0 auto 1rem" }} />
        <h2 style={{ marginBottom: "0.5rem" }}>Dashboard Unavailable</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          {error || "Could not retrieve statistics for this event."}
        </p>
        <Link to="/organizer/events" className="btn btn-outline">
          <ArrowLeft size={16} />
          <span>Back to My Events</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Top Breadcrumb & Live Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.75rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/organizer/events" className="btn btn-outline btn-sm">
            <ArrowLeft size={16} />
            <span>My Events</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="live-indicator">
              <span className="live-dot" />
              <span>{isConnected ? "Live Socket.IO Sync" : "Connecting..."}</span>
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="btn btn-outline btn-sm"
          >
            <Download size={15} />
            <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
          </button>

          <Link
            to={`/organizer/events/${eventId}/scanner`}
            className="btn btn-emerald btn-sm"
          >
            <QrCode size={15} />
            <span>Open Gate Scanner</span>
          </Link>

          <Link
            to={`/organizer/events/${eventId}/insights`}
            className="btn btn-primary btn-sm"
          >
            <Sparkles size={15} />
            <span>AI Event Insights</span>
          </Link>
        </div>
      </div>

      {/* Event Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: "1.75rem 2rem",
          marginBottom: "2rem",
          background: "linear-gradient(135deg, rgba(24, 34, 52, 0.85) 0%, rgba(17, 24, 39, 0.95) 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <span style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Real-Time Operations Center
          </span>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 800, marginTop: "0.2rem" }}>{event.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.4rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Calendar size={14} color="#818cf8" />
              <span>{new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Clock size={14} color="#06b6d4" />
              <span>{new Date(event.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", display: "block" }}>Attendance Rate</span>
          <span className="text-gradient-emerald" style={{ fontSize: "2.25rem", fontWeight: 800, lineHeight: 1 }}>
            {dashboard.attendancePercentage}%
          </span>
        </div>
      </div>

      {/* The 7 PostgreSQL Authoritative Metrics */}
      <div className="grid-stats" style={{ marginBottom: "2rem" }}>
        {/* 1. Total Capacity */}
        <div className="glass-panel" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Capacity</span>
            <Users size={18} color="#818cf8" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>{dashboard.totalCapacity}</div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Venue limit</span>
        </div>

        {/* 2. Registered Attendees */}
        <div className="glass-panel" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Registered</span>
            <Calendar size={18} color="#06b6d4" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#67e8f9" }}>
            {dashboard.totalRegisteredAttendees}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Active tickets issued</span>
        </div>

        {/* 3. Checked-In Count */}
        <div className="glass-panel" style={{ padding: "1.25rem", borderColor: "rgba(16, 185, 129, 0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Checked In</span>
            <UserCheck size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#6ee7b7" }}>
            {dashboard.checkedInCount}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#34d399", fontWeight: 600 }}>Gate verified admissions</span>
        </div>

        {/* 4. Remaining Capacity */}
        <div className="glass-panel" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Available Slots</span>
            <Users size={18} color="#a5b4fc" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>{dashboard.remainingCapacity}</div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Open seats left</span>
        </div>

        {/* 5. No-Shows */}
        <div className="glass-panel" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>No-Shows</span>
            <UserX size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fde68a" }}>
            {dashboard.noShows}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Registered but not arrived</span>
        </div>

        {/* 6. Peak Check-In Time */}
        <div className="glass-panel" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Peak Check-In</span>
            <TrendingUp size={18} color="#f43f5e" />
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: dashboard.peakCheckInTime ? "#fda4af" : "var(--text-muted)" }}>
            {dashboard.peakCheckInTime ? dashboard.peakCheckInTime.hour : "N/A"}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {dashboard.peakCheckInTime ? `${dashboard.peakCheckInTime.count} check-ins in surge window` : "No scan surge recorded"}
          </span>
        </div>
      </div>

      {/* Lower Section: Live Stream & Capacity Ring Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1.5rem" }}>
        {/* Left: Real-time Check-In Stream */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Activity size={18} color="#10b981" />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Live Gate Stream</h3>
            </div>
            <span className="live-indicator">
              <span className="live-dot" />
              <span>Real-Time</span>
            </span>
          </div>

          {liveFeed.length === 0 ? (
            <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "0.9rem" }}>Awaiting gate scan events...</p>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Scans through the QR scanner or offline sync will appear here instantly.
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "320px", overflowY: "auto" }}>
              {liveFeed.map((item) => (
                <div
                  key={item.id}
                  className="animate-fade-in"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.65rem 0.85rem",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.85rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <strong>{item.name}</strong>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="badge badge-primary" style={{ fontSize: "0.65rem" }}>
                      {item.source}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Operational Summary & AI Fast-Prompt Card */}
        <div className="glass-panel" style={{ padding: "1.5rem", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <Sparkles size={18} color="#6366f1" />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>AI Analytics Assistant</h3>
          </div>

          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "1.25rem" }}>
            Gemini interprets your live PostgreSQL statistics to diagnose attendance patterns, gate congestion windows, and operational recommendations.
          </p>

          <div
            style={{
              padding: "1rem",
              background: "rgba(99, 102, 241, 0.08)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              borderRadius: "var(--radius-md)",
              marginBottom: "1.5rem",
              fontSize: "0.85rem",
              color: "#c7d2fe",
            }}
          >
            <strong>PostgreSQL Grounding Guarantee:</strong> Gemini is strictly constrained to interpreting calculated metrics and will never hallucinate or invent numbers.
          </div>

          <div style={{ marginTop: "auto" }}>
            <Link
              to={`/organizer/events/${eventId}/insights`}
              className="btn btn-primary"
              style={{ width: "100%" }}
            >
              <Sparkles size={16} />
              <span>Launch AI Event Insights</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
