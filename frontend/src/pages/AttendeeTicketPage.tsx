import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  QrCode,
  ShieldAlert,
  Ticket as TicketIcon,
} from "lucide-react";
import { eventsApi } from "../api/events.api";
import { Ticket } from "../types";

export const AttendeeTicketPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [ticketData, setTicketData] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    const fetchTicket = async () => {
      try {
        const data = await eventsApi.getTicket(eventId);
        setTicketData(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load ticket.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTicket();
  }, [eventId]);

  const handleCopyToken = () => {
    if (!ticketData?.ticket?.token) return;
    navigator.clipboard.writeText(ticketData.ticket.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!ticketData?.ticket?.qrCodeDataUrl) return;
    const link = document.createElement("a");
    link.href = ticketData.ticket.qrCodeDataUrl;
    link.download = `ticket-${ticketData.event.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
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
        <p>Retrieving your ticket pass...</p>
      </div>
    );
  }

  if (error || !ticketData) {
    return (
      <div className="glass-panel" style={{ padding: "2rem", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
        <AlertCircle size={40} color="#f43f5e" style={{ margin: "0 auto 1rem" }} />
        <h2 style={{ marginBottom: "0.5rem" }}>Ticket Not Found</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          {error || "Could not locate an active registration for this event."}
        </p>
        <Link to={`/events/${eventId}`} className="btn btn-primary">
          <span>Go to Event Registration</span>
        </Link>
      </div>
    );
  }

  const eventDate = new Date(ticketData.event.date);
  const isCheckedIn = !ticketData.ticket; // If ticket object is absent, attendee is already admitted
  const qrInfo = ticketData.ticket;
  const expiresDate = qrInfo ? new Date(qrInfo.expiresAt) : null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: "560px", margin: "0 auto" }}>
      <Link
        to="/my-tickets"
        className="btn btn-outline btn-sm"
        style={{ marginBottom: "1.25rem", display: "inline-flex" }}
      >
        <ArrowLeft size={16} />
        <span>My Tickets</span>
      </Link>

      {/* Ticket Pass Card */}
      <div
        className="glass-panel"
        style={{
          background: "linear-gradient(180deg, rgba(24, 34, 52, 0.95) 0%, rgba(17, 24, 39, 0.98) 100%)",
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
          border: isCheckedIn ? "2px solid #10b981" : "1px solid var(--border-glass)",
          boxShadow: isCheckedIn
            ? "0 0 30px rgba(16, 185, 129, 0.25)"
            : "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Pass Header */}
        <div
          style={{
            padding: "1.5rem 1.75rem",
            background: isCheckedIn
              ? "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%)"
              : "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%)",
            borderBottom: "1px dashed var(--border-glass)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#a5b4fc", fontWeight: 700 }}>
              Official Admission Pass
            </span>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: "0.15rem" }}>
              {ticketData.event.name}
            </h2>
          </div>

          <div>
            {isCheckedIn ? (
              <span className="badge badge-emerald" style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}>
                <CheckCircle2 size={14} />
                <span>Checked In</span>
              </span>
            ) : (
              <span className="badge badge-primary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}>
                <TicketIcon size={14} />
                <span>Ready to Scan</span>
              </span>
            )}
          </div>
        </div>

        {/* QR Code Presentation Box */}
        <div
          style={{
            padding: "2rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              padding: "1rem",
              background: "#ffffff",
              borderRadius: "18px",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.4)",
              position: "relative",
            }}
          >
            {qrInfo?.qrCodeDataUrl ? (
              <img
                src={qrInfo.qrCodeDataUrl}
                alt="Admission QR Code"
                style={{
                  width: "220px",
                  height: "220px",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "220px",
                  height: "220px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10b981",
                }}
              >
                <CheckCircle2 size={64} />
              </div>
            )}

            {isCheckedIn && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(16, 185, 129, 0.9)",
                  borderRadius: "18px",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "1.1rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <CheckCircle2 size={42} style={{ marginBottom: "0.25rem" }} />
                <span>Admitted</span>
              </div>
            )}
          </div>

          <p style={{ marginTop: "1rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            {isCheckedIn
              ? "Attendee is verified and checked in at the gate"
              : "Present this QR code to event staff at the gate turnstile"}
          </p>

          {/* Quick Download / Copy Bar */}
          {!isCheckedIn && qrInfo && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", flexWrap: "wrap", justifyContent: "center" }}>
              <button
                onClick={handleCopyToken}
                className="btn btn-outline btn-sm"
                title="Copy Raw Token"
              >
                <Copy size={14} />
                <span>{copied ? "Copied Token!" : "Copy Token"}</span>
              </button>

              <button
                onClick={handleDownloadQr}
                className="btn btn-secondary btn-sm"
              >
                <Download size={14} />
                <span>Save Image</span>
              </button>
            </div>
          )}
        </div>

        {/* Ticket Metadata Breakdown */}
        <div
          style={{
            padding: "1.5rem 1.75rem",
            background: "var(--bg-secondary)",
            borderTop: "1px dashed var(--border-glass)",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block" }}>Attendee</span>
              <strong style={{ color: "var(--text-primary)" }}>{ticketData.attendee.name}</strong>
            </div>

            <div>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block" }}>Door Time</span>
              <strong style={{ color: "var(--text-primary)" }}>
                {eventDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </strong>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block" }}>Registration ID</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                {ticketData.id.substring(0, 8)}...
              </span>
            </div>

            <div>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block" }}>Status</span>
              <span style={{ color: isCheckedIn ? "#34d399" : "var(--accent-amber)", fontSize: "0.75rem", fontWeight: 600 }}>
                {isCheckedIn ? "ADMITTED" : expiresDate ? `Valid until ${expiresDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : "ACTIVE"}
              </span>
            </div>
          </div>
        </div>

        {/* Security / Screenshot Replay Alert */}
        <div
          style={{
            padding: "0.85rem 1.25rem",
            background: "rgba(99, 102, 241, 0.08)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            fontSize: "0.775rem",
            color: "#c7d2fe",
          }}
        >
          <ShieldAlert size={16} color="#818cf8" style={{ flexShrink: 0 }} />
          <span>
            Single-use token. Once scanned at gate, screenshots or duplicate attempts will be rejected.
          </span>
        </div>
      </div>
    </div>
  );
};
