import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  Clock,
  Cpu,
  Edit2,
  LayoutDashboard,
  Plus,
  PlusCircle,
  QrCode,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { eventsApi } from "../api/events.api";
import { useAuth } from "../hooks/useAuth";
import { EventDetail } from "../types";
import { Modal } from "../components/common/Modal";

export const OrganizerEventsPage: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [capacity, setCapacity] = useState<number>(50);
  const [isCreating, setIsCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Modal state
  const [editEvent, setEditEvent] = useState<EventDetail | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCapacity, setEditCapacity] = useState<number>(50);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchOrganizerEvents = async () => {
    try {
      const data = await eventsApi.listEvents();
      // Filter events owned by this organizer
      const owned = data.filter((e) => e.organizerId === user?.id);
      setEvents(owned);
    } catch (err: any) {
      setError(err?.message || "Failed to load organizer events.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizerEvents();
  }, [user]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsCreating(true);

    try {
      const newDateIso = new Date(date).toISOString();
      await eventsApi.createEvent({
        name,
        date: newDateIso,
        capacity: Number(capacity),
      });

      setIsCreateOpen(false);
      setName("");
      setDate("");
      setCapacity(50);
      await fetchOrganizerEvents();
    } catch (err: any) {
      setModalError(err?.message || "Failed to create event.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEdit = (evt: EventDetail) => {
    setEditEvent(evt);
    setEditName(evt.name);
    // Format date for datetime-local input
    const d = new Date(evt.date);
    const formattedDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEditDate(formattedDate);
    setEditCapacity(evt.capacity);
    setModalError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEvent) return;
    setModalError(null);
    setIsUpdating(true);

    try {
      const newDateIso = new Date(editDate).toISOString();
      await eventsApi.updateEvent(editEvent.id, {
        name: editName,
        date: newDateIso,
        capacity: Number(editCapacity),
      });

      setEditEvent(null);
      await fetchOrganizerEvents();
    } catch (err: any) {
      setModalError(err?.message || "Failed to update event.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (eventId: string, eventName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${eventName}"? All registrations, tickets, and check-ins will be permanently removed.`)) {
      return;
    }

    try {
      await eventsApi.deleteEvent(eventId);
      await fetchOrganizerEvents();
    } catch (err: any) {
      alert(err?.message || "Failed to delete event.");
    }
  };

  return (
    <div className="animate-fade-in">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span className="badge badge-primary">
              <Cpu size={12} />
              <span>Organizer Console</span>
            </span>
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>Managed Events</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Create events, view real-time statistics, scan tickets, and trigger AI analytics
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreateOpen(true);
            setModalError(null);
          }}
          className="btn btn-primary"
        >
          <Plus size={18} />
          <span>Create New Event</span>
        </button>
      </div>

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
          <p>Loading your events...</p>
        </div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: "2rem", textAlign: "center", color: "#fda4af" }}>
          <p>{error}</p>
        </div>
      ) : events.length === 0 ? (
        <div className="glass-panel" style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
          <Calendar size={48} style={{ opacity: 0.3, margin: "0 auto 1rem" }} />
          <h3 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>No Events Created Yet</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", maxWidth: "420px", margin: "0 auto 1.5rem" }}>
            Create your first event to start accepting registrations and scanning QR codes at the gate.
          </p>
          <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Create Your First Event</span>
          </button>
        </div>
      ) : (
        <div className="grid-cards">
          {events.map((evt) => {
            const eventDate = new Date(evt.date);
            const isFull = evt.registeredCount >= evt.capacity;
            const percentFilled = Math.min(100, Math.round((evt.registeredCount / evt.capacity) * 100));

            return (
              <div
                key={evt.id}
                className="glass-panel"
                style={{
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700 }}>{evt.name}</h3>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    <button
                      onClick={() => handleOpenEdit(evt)}
                      className="btn btn-outline btn-sm"
                      title="Edit Event"
                      style={{ padding: "0.35rem" }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(evt.id, evt.name)}
                      className="btn btn-outline btn-sm"
                      title="Delete Event"
                      style={{ padding: "0.35rem", color: "#fda4af", borderColor: "rgba(244, 63, 94, 0.3)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.25rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Calendar size={14} color="#818cf8" />
                    <span>{eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Clock size={14} color="#06b6d4" />
                    <span>{eventDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>

                {/* Capacity Progress Bar */}
                <div style={{ marginTop: "auto", marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.775rem", marginBottom: "0.35rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>Registered / Capacity</span>
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

                {/* Quick Action Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                  <Link
                    to={`/organizer/events/${evt.id}/dashboard`}
                    className="btn btn-primary btn-sm"
                  >
                    <LayoutDashboard size={14} />
                    <span>Live Dashboard</span>
                  </Link>

                  <Link
                    to={`/organizer/events/${evt.id}/scanner`}
                    className="btn btn-secondary btn-sm"
                  >
                    <QrCode size={14} />
                    <span>Gate Scanner</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Event Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Event">
        {modalError && (
          <div
            style={{
              padding: "0.75rem",
              background: "var(--accent-rose-light)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              borderRadius: "var(--radius-md)",
              color: "#fda4af",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="create-name">Event Name</label>
            <input
              id="create-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI & Cloud Summit 2026"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="create-date">Event Date & Time</label>
            <input
              id="create-date"
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="create-capacity">Max Capacity</label>
            <input
              id="create-capacity"
              type="number"
              min={1}
              required
              value={capacity}
              onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
              className="form-input"
            />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {isCreating ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Event Modal */}
      <Modal isOpen={!!editEvent} onClose={() => setEditEvent(null)} title="Edit Event Details">
        {modalError && (
          <div
            style={{
              padding: "0.75rem",
              background: "var(--accent-rose-light)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              borderRadius: "var(--radius-md)",
              color: "#fda4af",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            {modalError}
          </div>
        )}

        <form onSubmit={handleEditSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="edit-name">Event Name</label>
            <input
              id="edit-name"
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-date">Event Date & Time</label>
            <input
              id="edit-date"
              type="datetime-local"
              required
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-capacity">Max Capacity</label>
            <input
              id="edit-capacity"
              type="number"
              min={editEvent?.registeredCount || 1}
              required
              value={editCapacity}
              onChange={(e) => setEditCapacity(parseInt(e.target.value) || 1)}
              className="form-input"
            />
            {editEvent && (
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                Cannot be lower than current registered count ({editEvent.registeredCount})
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={() => setEditEvent(null)}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
