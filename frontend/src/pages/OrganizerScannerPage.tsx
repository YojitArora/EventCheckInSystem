import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  FlipHorizontal,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { checkinApi } from "../api/checkin.api";
import { eventsApi } from "../api/events.api";
import { useOfflineScanner } from "../hooks/useOfflineScanner";
import { CheckInSuccessPayload, EventDetail } from "../types";

export const OrganizerScannerPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Result Banner / Card
  const [scanResult, setScanResult] = useState<{
    type: "SUCCESS" | "ERROR";
    title: string;
    message: string;
    payload?: CheckInSuccessPayload;
    code?: string;
  } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  const { isOnline, pendingCount, enqueueScan, syncQueue, isSyncing } = useOfflineScanner();

  useEffect(() => {
    if (eventId) {
      eventsApi.getEventById(eventId).then(setEvent).catch(console.error);
    }
  }, [eventId]);

  // Audio chimes via Web Audio API (zero external mp3 file dependencies!)
  const playSound = (success: boolean) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (success) {
        // High upbeat dual tone
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else {
        // Low buzz tone
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
        osc.frequency.setValueAtTime(146.83, audioCtx.currentTime + 0.15); // D3
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch {
      // AudioContext unavailable
    }
  };

  const processToken = async (rawToken: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      if (!isOnline) {
        // Offline handling: enqueue locally
        enqueueScan(rawToken, event?.name);
        playSound(true);
        setScanResult({
          type: "SUCCESS",
          title: "Offline Scan Saved",
          message: "Scan saved to local device queue. It will automatically synchronize when network is restored.",
        });
      } else {
        // Online direct check-in
        const result = await checkinApi.checkIn(rawToken);
        playSound(true);
        setScanResult({
          type: "SUCCESS",
          title: "Check-In Approved",
          message: `Welcome, ${result.attendee.name}!`,
          payload: result,
        });
      }
    } catch (err: any) {
      playSound(false);
      setScanResult({
        type: "ERROR",
        title: err?.code === "ALREADY_CHECKED_IN" ? "Already Checked In" : "Scan Rejected",
        message: err?.message || "Check-in failed. Please verify the ticket token.",
        code: err?.code,
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1500); // 1.5s debounce before next scan
    }
  };

  const startScanner = async () => {
    setCameraError(null);
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader-viewport");
      }

      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          processToken(decodedText);
        },
        () => {}
      );

      setIsScanning(true);
    } catch (err: any) {
      setCameraError(err?.message || "Camera access denied or unavailable.");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
    setIsScanning(false);
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    processToken(manualToken.trim());
    setManualToken("");
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: "720px", margin: "0 auto" }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <Link
          to={eventId ? `/organizer/events/${eventId}/dashboard` : "/organizer/events"}
          className="btn btn-outline btn-sm"
        >
          <ArrowLeft size={16} />
          <span>Dashboard</span>
        </Link>

        {/* Network & Offline Queue Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {isOnline ? (
            <span className="badge badge-emerald" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Wifi size={12} />
              <span>Online Mode</span>
            </span>
          ) : (
            <span className="badge badge-amber" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <WifiOff size={12} />
              <span>Offline Scanner Active</span>
            </span>
          )}

          {pendingCount > 0 && (
            <button
              onClick={() => syncQueue()}
              disabled={!isOnline || isSyncing}
              className="btn btn-emerald btn-sm"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              <span>Sync {pendingCount} Offline Scan{pendingCount > 1 ? "s" : ""}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Scanner Container */}
      <div
        className="glass-panel"
        style={{
          padding: "2rem",
          backgroundColor: "var(--bg-glass-card)",
          boxShadow: "var(--shadow-lg)",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--accent-cyan)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Turnstile Gate Scanner
          </span>
          <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "0.15rem" }}>
            {event?.name || "Event Gate Scanner"}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Point camera at attendee QR pass or enter security token below
          </p>
        </div>

        {/* Viewfinder Element */}
        <div style={{ position: "relative", marginBottom: "1.5rem" }}>
          <div
            id="qr-reader-viewport"
            className="scanner-viewport"
            style={{
              display: cameraError ? "none" : "block",
            }}
          />
          {isScanning && <div className="scanner-laser" />}

          {cameraError && (
            <div
              className="scanner-viewport"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem",
                textAlign: "center",
                background: "var(--bg-secondary)",
                color: "var(--text-secondary)",
              }}
            >
              <Camera size={44} color="#f43f5e" style={{ marginBottom: "1rem" }} />
              <h4 style={{ color: "#fda4af", marginBottom: "0.5rem" }}>Camera Access Error</h4>
              <p style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>{cameraError}</p>
              <button onClick={startScanner} className="btn btn-outline btn-sm">
                <RefreshCw size={14} />
                <span>Retry Camera</span>
              </button>
            </div>
          )}
        </div>

        {/* Camera Toggle Bar */}
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {isScanning ? (
            <button onClick={stopScanner} className="btn btn-outline btn-sm">
              <span>Pause Camera</span>
            </button>
          ) : (
            <button onClick={startScanner} className="btn btn-primary btn-sm">
              <Camera size={14} />
              <span>Activate Camera</span>
            </button>
          )}
        </div>

        {/* Manual Token Entry Fallback */}
        <form onSubmit={handleManualSubmit} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1.5rem" }}>
          <label className="form-label" htmlFor="manual-token" style={{ fontSize: "0.8rem" }}>
            Manual Token Entry (Fallback)
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                id="manual-token"
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste raw QR token string..."
                className="form-input"
                style={{ paddingLeft: "2.5rem", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}
              />
              <KeyRound
                size={16}
                color="var(--text-muted)"
                style={{ position: "absolute", left: "0.9rem", top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
            <button
              type="submit"
              disabled={isProcessing || !manualToken.trim()}
              className="btn btn-secondary"
            >
              {isProcessing ? "Verifying..." : "Validate"}
            </button>
          </div>
        </form>
      </div>

      {/* Instant Scan Result Modal / Card */}
      {scanResult && (
        <div
          className="glass-panel animate-scale-up"
          style={{
            padding: "1.5rem",
            backgroundColor:
              scanResult.type === "SUCCESS"
                ? "rgba(16, 185, 129, 0.12)"
                : "rgba(244, 63, 94, 0.12)",
            border:
              scanResult.type === "SUCCESS"
                ? "2px solid #10b981"
                : "2px solid #f43f5e",
            boxShadow:
              scanResult.type === "SUCCESS"
                ? "var(--shadow-glow-emerald)"
                : "var(--shadow-glow-rose)",
            marginBottom: "2rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: scanResult.type === "SUCCESS" ? "#10b981" : "#f43f5e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {scanResult.type === "SUCCESS" ? (
                <CheckCircle2 size={26} color="#fff" />
              ) : (
                <ShieldAlert size={26} color="#fff" />
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: scanResult.type === "SUCCESS" ? "#6ee7b7" : "#fda4af",
                  }}
                >
                  {scanResult.title}
                </h3>
                {scanResult.code && (
                  <span className="badge badge-rose" style={{ fontSize: "0.7rem" }}>
                    {scanResult.code}
                  </span>
                )}
              </div>

              <p style={{ color: "var(--text-primary)", fontSize: "0.95rem", marginTop: "0.25rem" }}>
                {scanResult.message}
              </p>

              {scanResult.payload && (
                <div
                  style={{
                    marginTop: "0.85rem",
                    padding: "0.75rem",
                    background: "rgba(0, 0, 0, 0.25)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8rem",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block" }}>Attendee</span>
                    <strong>{scanResult.payload.attendee.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block" }}>Email</span>
                    <strong>{scanResult.payload.attendee.email}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
