import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  Flame,
  Search,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { eventsApi } from "../api/events.api";
import { EventDetail } from "../types";
import { useAuth } from "../hooks/useAuth";

export const EventsListPage: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventDetail[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await eventsApi.listEvents();
        setEvents(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load events.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const filteredEvents = events.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.organizer.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {/* Hero Banner */}
      <div
        className="glass-panel"
        style={{
          padding: "2.5rem 2rem",
          marginBottom: "2rem",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%)",
          borderColor: "rgba(99, 102, 241, 0.25)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: "720px", position: "relative", zIndex: 2 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <span className="badge badge-primary">
              <Sparkles size={12} />
              <span>Verified Gate System</span>
            </span>
            <span className="live-indicator">
              <span className="live-dot" />
              <span>Real-Time Check-In</span>
            </span>
          </div>

          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, lineHeight: 1.15, marginBottom: "0.75rem" }}>
            Discover Upcoming <span className="text-gradient">Tech & Community</span> Events
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
            Reserve verified tickets with instant cryptographic QR tokens, live capacity tracking, and frictionless gate admissions.
          </p>

          <div style={{ position: "relative", maxWidth: "480px" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by event title or organizer..."
              className="form-input"
              style={{
                paddingLeft: "2.75rem",
                background: "var(--bg-secondary)",
                boxShadow: "var(--shadow-md)",
              }}
            />
            <Search
              size={18}
              color="var(--text-muted)"
              style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)" }}
            />
          </div>
        </div>
      </div>

      {/* Events Grid Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700 }}>Upcoming Events</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Showing {filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"}
          </p>
        </div>

        {user?.role === "ORGANIZER" && (
          <Link to="/organizer/events" className="btn btn-primary btn-sm">
            <span>Organizer Dashboard</span>
          </Link>
        )}
      </div>

      {/* Content State */}
      {isLoading ? (
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
          <p>Loading events...</p>
        </div>
      ) : error ? (
        <div
          className="glass-panel"
          style={{
            padding: "2rem",
            textAlign: "center",
            borderColor: "rgba(244, 63, 94, 0.3)",
            color: "#fda4af",
          }}
        >
          <p>{error}</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div
          className="glass-panel"
          style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--text-muted)" }}
        >
          <Calendar size={48} style={{ opacity: 0.3, margin: "0 auto 1rem" }} />
          <h3 style={{ color: "var(--text-secondary)", marginBottom: "0.5rem" }}>No events found</h3>
          <p style={{ fontSize: "0.9rem" }}>Try adjusting your search criteria.</p>
        </div>
      ) : (
        <div className="grid-cards">
          {filteredEvents.map((evt) => {
            const isFull = evt.registeredCount >= evt.capacity;
            const percentFilled = Math.min(100, Math.round((evt.registeredCount / evt.capacity) * 100));
            const eventDate = new Date(evt.date);

            return (
              <div key={evt.id} className="glass-panel-interactive" style={{ padding: "1.5rem", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "1rem" }}>
                  <div>
                    <span style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", fontWeight: 600 }}>
                      By {evt.organizer.name}
                    </span>
                    <h3 style={{ fontSize: "1.2rem", marginTop: "0.2rem", fontWeight: 700 }}>{evt.name}</h3>
                  </div>
                  {isFull ? (
                    <span className="badge badge-rose">
                      <Flame size={12} />
                      <span>Sold Out</span>
                    </span>
                  ) : (
                    <span className="badge badge-emerald">
                      <span>Available</span>
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Calendar size={15} color="#818cf8" />
                    <span>
                      {eventDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Clock size={15} color="#06b6d4" />
                    <span>
                      {eventDate.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZoneName: "short",
                      })}
                    </span>
                  </div>
                </div>

                {/* Capacity Progress Bar */}
                <div style={{ marginTop: "auto", marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.775rem", marginBottom: "0.35rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>Registration Capacity</span>
                    <span style={{ fontWeight: 600, color: isFull ? "#fda4af" : "#a5b4fc" }}>
                      {evt.registeredCount} / {evt.capacity} ({percentFilled}%)
                    </span>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${percentFilled}%`,
                        background: isFull
                          ? "linear-gradient(90deg, #f43f5e, #e11d48)"
                          : "linear-gradient(90deg, #6366f1, #06b6d4)",
                      }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <Link
                    to={`/events/${evt.id}`}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                  >
                    <span>View Details</span>
                  </Link>

                  {user?.role === "ORGANIZER" && user.id === evt.organizerId ? (
                    <Link
                      to={`/organizer/events/${evt.id}/dashboard`}
                      className="btn btn-primary btn-sm"
                    >
                      <span>Dashboard</span>
                    </Link>
                  ) : (
                    <Link
                      to={`/events/${evt.id}`}
                      className={`btn ${isFull ? "btn-outline" : "btn-primary"} btn-sm`}
                    >
                      <Ticket size={14} />
                      <span>{isFull ? "Details" : "Get Pass"}</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
