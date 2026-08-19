import React from "react";
import { Cpu, ShieldCheck, Zap } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border-subtle)",
        background: "rgba(11, 15, 25, 0.95)",
        padding: "1.5rem 1.5rem",
        marginTop: "auto",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          fontSize: "0.85rem",
          color: "var(--text-muted)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <span>&copy; {new Date().getFullYear()} EventPass System. All rights reserved.</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>PostgreSQL Serialized Locks</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            <Zap size={14} color="#6366f1" />
            <span>Socket.IO Real-Time</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            <Cpu size={14} color="#06b6d4" />
            <span>Gemini 1.5 AI</span>
          </span>
        </div>
      </div>
    </footer>
  );
};
