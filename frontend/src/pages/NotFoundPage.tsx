import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: "460px",
          width: "100%",
          padding: "3rem 2rem",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <Compass size={56} color="#818cf8" style={{ margin: "0 auto 1rem", opacity: 0.8 }} />
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>404</h1>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Page Not Found</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/events" className="btn btn-primary" style={{ width: "100%" }}>
          <ArrowLeft size={16} />
          <span>Back to Events</span>
        </Link>
      </div>
    </div>
  );
};
