import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { Navbar } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { EventsListPage } from "./pages/EventsListPage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { AttendeeTicketPage } from "./pages/AttendeeTicketPage";
import { MyTicketsPage } from "./pages/MyTicketsPage";
import { OrganizerEventsPage } from "./pages/OrganizerEventsPage";
import { OrganizerDashboardPage } from "./pages/OrganizerDashboardPage";
import { OrganizerScannerPage } from "./pages/OrganizerScannerPage";
import { OrganizerAIPage } from "./pages/OrganizerAIPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <div className="app-container">
            <Navbar />
            <main className="main-content">
              <Routes>
                {/* Public & Event Browsing Routes */}
                <Route path="/" element={<Navigate to="/events" replace />} />
                <Route path="/events" element={<EventsListPage />} />
                <Route path="/events/:eventId" element={<EventDetailPage />} />

                {/* Auth Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Attendee Protected Routes */}
                <Route
                  path="/events/:eventId/ticket"
                  element={
                    <ProtectedRoute allowedRoles={["ATTENDEE"]}>
                      <AttendeeTicketPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-tickets"
                  element={
                    <ProtectedRoute allowedRoles={["ATTENDEE"]}>
                      <MyTicketsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Organizer Protected Routes */}
                <Route
                  path="/organizer/events"
                  element={
                    <ProtectedRoute allowedRoles={["ORGANIZER"]}>
                      <OrganizerEventsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/organizer/events/:eventId/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["ORGANIZER"]}>
                      <OrganizerDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/organizer/events/:eventId/scanner"
                  element={
                    <ProtectedRoute allowedRoles={["ORGANIZER"]}>
                      <OrganizerScannerPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/organizer/events/:eventId/insights"
                  element={
                    <ProtectedRoute allowedRoles={["ORGANIZER"]}>
                      <OrganizerAIPage />
                    </ProtectedRoute>
                  }
                />

                {/* 404 Fallback */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
