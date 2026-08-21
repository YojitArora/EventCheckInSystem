import React from "react";
import { Sparkles, UserCheck, Users } from "lucide-react";

interface DemoSwitcherProps {
  onSelectAccount: (email: string, pass: string) => void;
}

export const DemoSwitcher: React.FC<DemoSwitcherProps> = ({ onSelectAccount }) => {
  return (
    <div
      style={{
        marginTop: "1.5rem",
        padding: "1.25rem",
        background: "rgba(99, 102, 241, 0.06)",
        border: "1px solid rgba(99, 102, 241, 0.2)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
          color: "#a5b4fc",
          fontSize: "0.85rem",
          fontWeight: 700,
        }}
      >
        <Sparkles size={16} />
        <span>1-Click Demo Accounts (Fast Testing)</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <button
          type="button"
          onClick={() => onSelectAccount("organizer@mic.dev", "Organizer@123")}
          className="btn btn-outline btn-sm"
          style={{
            justifyContent: "flex-start",
            textAlign: "left",
            borderColor: "rgba(99, 102, 241, 0.4)",
            background: "rgba(99, 102, 241, 0.1)",
            padding: "0.45rem 0.75rem",
            width: "100%",
          }}
        >
          <UserCheck size={14} color="#818cf8" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            <strong style={{ color: "#c7d2fe" }}>MIC Organizer</strong>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
              organizer@mic.dev
            </span>
          </div>
          <span className="badge badge-primary" style={{ fontSize: "0.65rem", flexShrink: 0 }}>
            ORGANIZER
          </span>
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
          <button
            type="button"
            onClick={() => onSelectAccount("attendee1@mic.dev", "Attendee@123")}
            className="btn btn-outline btn-sm"
            style={{
              justifyContent: "center",
              borderColor: "rgba(16, 185, 129, 0.3)",
              background: "rgba(16, 185, 129, 0.08)",
              padding: "0.55rem 0.75rem",
              gap: "0.5rem",
            }}
          >
            <Users size={14} color="#34d399" />
            <strong style={{ color: "#a7f3d0", fontSize: "0.85rem" }}>Attendee 1</strong>
          </button>

          <button
            type="button"
            onClick={() => onSelectAccount("attendee2@mic.dev", "Attendee@123")}
            className="btn btn-outline btn-sm"
            style={{
              justifyContent: "center",
              borderColor: "rgba(16, 185, 129, 0.3)",
              background: "rgba(16, 185, 129, 0.08)",
              padding: "0.55rem 0.75rem",
              gap: "0.5rem",
            }}
          >
            <Users size={14} color="#34d399" />
            <strong style={{ color: "#a7f3d0", fontSize: "0.85rem" }}>Attendee 2</strong>
          </button>
        </div>
      </div>
    </div>
  );
};
