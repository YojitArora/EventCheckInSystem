import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Cpu,
  LogIn,
  LogOut,
  PlusCircle,
  QrCode,
  Sparkles,
  Ticket,
  User,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isOrganizer = user?.role === "ORGANIZER";
  const isAttendee = user?.role === "ATTENDEE";

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="nav-brand">
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(99, 102, 241, 0.5)",
            }}
          >
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <span style={{ fontWeight: 800 }}>Event</span>
            <span className="text-gradient" style={{ fontWeight: 800 }}>
              Pass
            </span>
          </div>
        </Link>

        <nav className="nav-links">
          <Link
            to="/events"
            className={`nav-link ${location.pathname === "/events" ? "active" : ""}`}
          >
            <Calendar size={16} />
            <span>Explore Events</span>
          </Link>

          {isAttendee && (
            <Link
              to="/my-tickets"
              className={`nav-link ${location.pathname === "/my-tickets" ? "active" : ""}`}
            >
              <Ticket size={16} />
              <span>My Tickets</span>
            </Link>
          )}

          {isOrganizer && (
            <>
              <Link
                to="/organizer/events"
                className={`nav-link ${
                  location.pathname.startsWith("/organizer/events") ? "active" : ""
                }`}
              >
                <Cpu size={16} />
                <span>My Events</span>
              </Link>
            </>
          )}

          {isAuthenticated ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "0.5rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.35rem 0.75rem",
                  background: "var(--bg-tertiary)",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--border-glass)",
                }}
              >
                <User size={14} color="#a5b4fc" />
                <span style={{ fontSize: "0.825rem", fontWeight: 600 }}>{user?.name}</span>
                <span
                  className={`badge ${isOrganizer ? "badge-primary" : "badge-emerald"}`}
                  style={{ fontSize: "0.65rem", padding: "0.15rem 0.45rem" }}
                >
                  {user?.role}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="btn btn-outline btn-sm"
                title="Logout"
                style={{ padding: "0.45rem 0.75rem" }}
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "0.5rem" }}>
              <Link to="/login" className="btn btn-outline btn-sm">
                <LogIn size={14} />
                <span>Login</span>
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                <span>Sign Up</span>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};
