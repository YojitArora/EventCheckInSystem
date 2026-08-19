import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Mail,
  ShieldCheck,
  Sparkles,
  Ticket,
  User,
  Users,
} from "lucide-react";
import confetti from "canvas-confetti";
import { eventsApi } from "../api/events.api";
import { useAuth } from "../hooks/useAuth";
import { EventDetail } from "../types";

export const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    const loadEventAndStatus = async () => {
      try {
        const data = await eventsApi.getEventById(eventId);
        setEvent(data);

        if (isAuthenticated && user?.role === "ATTENDEE") {
          try {
            await eventsApi.getTicket(eventId);
            setIsAlreadyRegistered(true);
          } catch {
            setIsAlreadyRegistered(false);
          }
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load event details.");
      } finally {
        setIsLoading(false);
      }
    };

    loadEventAndStatus();
  }, [eventId, isAuthenticated, user]);

  const handleRegister = async () => {
    if (!eventId) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: `/events/${eventId}` } } });
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      await eventsApi.registerForEvent(eventId);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      navigate(`/events/${eventId}/ticket`);
    } catch (err: any) {
      if (err?.code === "ALREADY_REGISTERED") {
        navigate(`/events/${eventId}/ticket`);
      } else {
        setError(err?.message || "Registration failed. Please try again.");
      }
    } finally {
      setIsRegistering(false);
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
        <p>Loading event information...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="glass-panel" style={{ padding: "2rem", textAlign: "center" }}>
        <AlertCircle size={40} color="#f43f5e" style={{ margin: "0 auto 1rem" }} />
        <h2 style={{ marginBottom: "0.5rem" }}>Event Not Available</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          {error || "Could not retrieve the requested event."}
        </p>
        <Link to="/events" className="btn btn-outline">
          <ArrowLeft size={16} />
          <span>Back to All Events</span>
        </Link>
      </div>
    );
  }

  const isFull = event.registeredCount >= event.capacity;
  const percentFilled = Math.min(100, Math.round((event.registeredCount / event.capacity) * 100));
  const eventDate = new Date(event.date);

  return (
    <div className="animate-fade-in" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <Link
        to="/events"
        className="btn btn-outline btn-sm"
        style={{ marginBottom: "1.5rem", display: "inline-flex" }}
      >
        <ArrowLeft size={16} />
        <span>All Events</span>
      </Link>

      <div
        className="glass-panel"
        style={{
          padding: "2.5rem",
          backgroundColor: "var(--bg-glass-card)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Header Badges */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <span className="badge badge-primary">
            <Sparkles size={12} />
            <span>Official Event</span>
          </span>
          {isFull ? (
            <span className="badge badge-rose">
              <Flame size={12} />
              <span>Capacity Reached (Sold Out)</span>
            </span>
          ) : (
            <span className="badge badge-emerald">
              <span>{event.capacity - event.registeredCount} Seats Remaining</span>
            </span>
          )}
        </div>

        <h1 style={{ fontSize: "2.25rem", fontWeight: 800, marginBottom: "0.75rem", lineHeight: 1.2 }}>
          {event.name}
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--accent-cyan)", fontSize: "0.95rem", fontWeight: 600, marginBottom: "1.75rem" }}>
          <User size={16} />
          <span>Organized by {event.organizer.name}</span>
          <span style={{ color: "var(--text-muted)" }}>({event.organizer.email})</span>
        </div>

        {/* Metadata Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            padding: "1.25rem",
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            marginBottom: "2rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Calendar size={20} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Date</div>
              <div style={{ fontWeight: 600, fontSize: "0.925rem" }}>
                {eventDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "var(--accent-cyan-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock size={20} color="#06b6d4" />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Time</div>
              <div style={{ fontWeight: 600, fontSize: "0.925rem" }}>
                {eventDate.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZoneName: "short",
                })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "var(--accent-emerald-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={20} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Capacity</div>
              <div style={{ fontWeight: 600, fontSize: "0.925rem" }}>
                {event.registeredCount} / {event.capacity} Slots
              </div>
            </div>
          </div>
        </div>

        {/* Capacity Bar */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Live Capacity Status</span>
            <span style={{ fontWeight: 700, color: isFull ? "#fda4af" : "#a5b4fc" }}>
              {percentFilled}% Capped
            </span>
          </div>
          <div className="progress-bar-track" style={{ height: "10px" }}>
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

        {/* Security & Anti-Duplication Assurance */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            padding: "1rem",
            background: "rgba(16, 185, 129, 0.06)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: "var(--radius-md)",
            marginBottom: "2rem",
            fontSize: "0.875rem",
            color: "#a7f3d0",
          }}
        >
          <ShieldCheck size={20} color="#10b981" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
          <div>
            <strong style={{ display: "block", color: "#6ee7b7", marginBottom: "0.15rem" }}>
              Cryptographic One-Time QR Guarantee
            </strong>
            Your admission ticket is secured with a 256-bit entropy token and hardware-level atomic PostgreSQL validation.
          </div>
        </div>

        {/* Registration CTA */}
        {isAlreadyRegistered ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "#6ee7b7",
                fontWeight: 600,
                marginBottom: "1rem",
              }}
            >
              <CheckCircle2 size={18} />
              <span>You are already registered for this event</span>
            </div>
            <div>
              <Link to={`/events/${eventId}/ticket`} className="btn btn-emerald btn-lg">
                <Ticket size={20} />
                <span>View My QR Ticket Pass</span>
              </Link>
            </div>
          </div>
        ) : user?.role === "ORGANIZER" && user.id === event.organizerId ? (
          <div style={{ display: "flex", gap: "1rem" }}>
            <Link to={`/organizer/events/${eventId}/dashboard`} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
              <span>Open Organizer Dashboard</span>
            </Link>
            <Link to={`/organizer/events/${eventId}/scanner`} className="btn btn-secondary btn-lg">
              <span>QR Scanner</span>
            </Link>
          </div>
        ) : (
          <div>
            <button
              onClick={handleRegister}
              disabled={isFull || isRegistering}
              className={`btn ${isFull ? "btn-secondary" : "btn-primary"} btn-lg`}
              style={{ width: "100%" }}
            >
              <Ticket size={20} />
              <span>
                {isRegistering
                  ? "Securing Ticket..."
                  : isFull
                  ? "Event Sold Out"
                  : isAuthenticated
                  ? "Register & Get QR Ticket"
                  : "Sign In to Register"}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
