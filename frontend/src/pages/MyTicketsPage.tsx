import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Ticket,
} from "lucide-react";
import { eventsApi } from "../api/events.api";
import { EventDetail, Ticket as TicketType } from "../types";

interface TicketItem {
  event: EventDetail;
  ticket: TicketType;
}

export const MyTicketsPage: React.FC = () => {
  const [ticketItems, setTicketItems] = useState<TicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMyTickets = async () => {
      try {
        const events = await eventsApi.listEvents();
        const results: TicketItem[] = [];

        await Promise.all(
          events.map(async (evt) => {
            try {
              const t = await eventsApi.getTicket(evt.id);
              results.push({ event: evt, ticket: t });
            } catch {
              // Not registered for this event
            }
          })
        );

        setTicketItems(results);
      } catch (err: any) {
        setError(err?.message || "Failed to load tickets.");
      } finally {
        setIsLoading(false);
      }
    };

    loadMyTickets();
  }, []);

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span className="badge badge-emerald">
            <Ticket size={12} />
            <span>Attendee Passes</span>
          </span>
        </div>
        <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>My Event Tickets</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          Access your digital admission passes with live QR verification
        </p>
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
          <p>Loading your tickets...</p>
        </div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: "2rem", textAlign: "center", color: "#fda4af" }}>
          <p>{error}</p>
        </div>
      ) : ticketItems.length === 0 ? (
        <div className="glass-panel" style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
          <Ticket size={48} style={{ opacity: 0.3, margin: "0 auto 1rem" }} />
          <h3 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>No Tickets Found</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", maxWidth: "400px", margin: "0 auto 1.5rem" }}>
            You have not registered for any events yet. Explore upcoming events to claim your pass!
          </p>
          <Link to="/events" className="btn btn-primary">
            <span>Explore Events</span>
          </Link>
        </div>
      ) : (
        <div className="grid-cards">
          {ticketItems.map(({ event, ticket }) => {
            const eventDate = new Date(event.date);
            const isCheckedIn = !ticket.ticket;
            const qrInfo = ticket.ticket;

            return (
              <div
                key={event.id}
                className="glass-panel"
                style={{
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  border: isCheckedIn ? "1px solid #10b981" : "1px solid var(--border-glass)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div>
                    <span style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", fontWeight: 600 }}>
                      {event.organizer.name}
                    </span>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: "0.2rem" }}>{event.name}</h3>
                  </div>

                  {isCheckedIn ? (
                    <span className="badge badge-emerald">
                      <span>Checked In</span>
                    </span>
                  ) : (
                    <span className="badge badge-primary">
                      <span>Active Pass</span>
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.5rem" }}>
                  {qrInfo?.qrCodeDataUrl ? (
                    <img
                      src={qrInfo.qrCodeDataUrl}
                      alt="Mini QR"
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "10px",
                        background: "#fff",
                        padding: "4px",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "10px",
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#10b981",
                      }}
                    >
                      <CheckCircle2 size={32} />
                    </div>
                  )}
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Calendar size={14} color="#818cf8" />
                      <span>{eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Clock size={14} color="#06b6d4" />
                      <span>{eventDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "auto" }}>
                  <Link to={`/events/${event.id}/ticket`} className="btn btn-primary" style={{ width: "100%" }}>
                    <Ticket size={16} />
                    <span>Open QR Pass</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
