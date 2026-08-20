import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  ExternalLink,
  Info,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { API_BASE_URL } from "../api/axios";
import { checkinApi } from "../api/checkin.api";
import { eventsApi } from "../api/events.api";
import { useOfflineScanner } from "../hooks/useOfflineScanner";
import { CheckInSuccessPayload, EventDetail } from "../types";
import {
  CameraDeviceInfo,
  CameraErrorInfo,
  categorizeCameraError,
  checkCameraSecurityContext,
  getCameraDevices,
  ScannerLifecycleManager,
  selectPreferredCamera,
} from "../utils/qrScanner";

export const OrganizerScannerPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<CameraErrorInfo | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Camera devices & selection (supports Apple Continuity Camera)
  const [devices, setDevices] = useState<CameraDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isRefreshingDevices, setIsRefreshingDevices] = useState<boolean>(false);
  const [showContinuityTip, setShowContinuityTip] = useState<boolean>(false);

  // Result Banner / Card
  const [scanResult, setScanResult] = useState<{
    type: "SUCCESS" | "ERROR";
    title: string;
    message: string;
    payload?: CheckInSuccessPayload;
    code?: string;
  } | null>(null);

  const scannerManagerRef = useRef<ScannerLifecycleManager | null>(null);
  const isProcessingRef = useRef(false);
  const lastProcessedTokenRef = useRef<string | null>(null);
  const lastProcessedTimeRef = useRef<number>(0);
  const selectedDeviceIdRef = useRef<string>("");

  const { isOnline, pendingCount, enqueueScan, syncQueue, isSyncing } = useOfflineScanner();

  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  useEffect(() => {
    if (eventId) {
      eventsApi.getEventById(eventId).then(setEvent).catch(console.error);
    }
  }, [eventId]);

  // Audio chimes via Web Audio API
  const playSound = (success: boolean) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (success) {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else {
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

  const processToken = useCallback(
    async (rawToken: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setIsProcessing(true);

      try {
        if (!isOnline) {
          enqueueScan(rawToken, event?.name);
          playSound(true);
          setScanResult({
            type: "SUCCESS",
            title: "Offline Scan Saved",
            message:
              "Scan saved to local device queue. It will automatically synchronize when network is restored.",
          });
        } else {
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
        const isNetworkError =
          !err?.status && (err?.message?.includes("Network") || err?.message?.includes("connect"));

        setScanResult({
          type: "ERROR",
          title: isNetworkError
            ? "Backend Server Unavailable"
            : err?.code === "ALREADY_CHECKED_IN"
            ? "Already Checked In"
            : "Scan Rejected",
          message: isNetworkError
            ? `Unable to reach backend at ${API_BASE_URL}. Ensure backend is running and accessible on LAN.`
            : err?.message || "Check-in failed. Please verify the ticket token.",
          code: err?.code || (isNetworkError ? "NETWORK_ERROR" : undefined),
        });
      } finally {
        setIsProcessing(false);
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1500); // 1.5s debounce before next scan
      }
    },
    [isOnline, enqueueScan, event?.name]
  );

  const handleDecodedToken = useCallback(
    (rawToken: string) => {
      const trimmed = rawToken.trim();
      if (!trimmed) return;

      if (isProcessingRef.current) return;

      const now = Date.now();
      if (
        lastProcessedTokenRef.current === trimmed &&
        now - lastProcessedTimeRef.current < 2000
      ) {
        return;
      }

      lastProcessedTokenRef.current = trimmed;
      lastProcessedTimeRef.current = now;
      processToken(trimmed);
    },
    [processToken]
  );

  const stopScanner = useCallback(async () => {
    if (scannerManagerRef.current) {
      await scannerManagerRef.current.stop();
    }
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(
    async (deviceIdToUse?: string) => {
      setCameraError(null);
      const activeDeviceId = deviceIdToUse || selectedDeviceIdRef.current;

      let manager = scannerManagerRef.current;
      if (!manager) {
        manager = new ScannerLifecycleManager({
          elementId: "qr-reader-viewport",
          deviceId: activeDeviceId || undefined,
          facingMode: "environment",
          fps: 15,
        });
        scannerManagerRef.current = manager;
      } else if (activeDeviceId) {
        manager.setDeviceId(activeDeviceId);
      }

      try {
        await manager.start(
          (decodedText) => {
            handleDecodedToken(decodedText);
          },
          (err) => {
            setCameraError(categorizeCameraError(err));
            setIsScanning(false);
          },
          activeDeviceId || undefined
        );
        setIsScanning(true);
      } catch (err: any) {
        setCameraError(categorizeCameraError(err));
        setIsScanning(false);
      }
    },
    [handleDecodedToken]
  );

  const loadDevices = useCallback(
    async (requestPermission = false): Promise<CameraDeviceInfo[]> => {
      setIsRefreshingDevices(true);
      try {
        const list = await getCameraDevices(requestPermission);
        setDevices(list);

        const preferred = selectPreferredCamera(list, selectedDeviceIdRef.current);
        if (preferred && preferred !== selectedDeviceIdRef.current) {
          setSelectedDeviceId(preferred);
          selectedDeviceIdRef.current = preferred;
          if (scannerManagerRef.current) {
            scannerManagerRef.current.setDeviceId(preferred);
            if (isScanning) {
              await stopScanner();
              await startScanner(preferred);
            }
          }
        }
        return list;
      } catch (err) {
        console.warn("Failed to enumerate camera devices:", err);
        return [];
      } finally {
        setIsRefreshingDevices(false);
      }
    },
    [isScanning, startScanner, stopScanner]
  );

  const handleDeviceChange = async (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    selectedDeviceIdRef.current = newDeviceId;

    if (scannerManagerRef.current) {
      scannerManagerRef.current.setDeviceId(newDeviceId);
      if (isScanning) {
        await stopScanner();
        await startScanner(newDeviceId);
      }
    }
  };

  // Initialize scanner on mount with lifecycle cleanup
  useEffect(() => {
    let isMounted = true;

    // Check origin security context before auto-starting
    const security = checkCameraSecurityContext();
    if (!security.isSupported && security.errorInfo) {
      setCameraError(security.errorInfo);
      setIsScanning(false);
      return;
    }

    const init = async () => {
      try {
        // Enumerate devices (unlocks labels if permissions already granted)
        const detected = await loadDevices(false);
        const preferredId = selectPreferredCamera(detected);

        if (!isMounted) return;

        const manager = new ScannerLifecycleManager({
          elementId: "qr-reader-viewport",
          deviceId: preferredId,
          facingMode: "environment",
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        });
        scannerManagerRef.current = manager;

        setCameraError(null);
        await manager.start(
          (decodedText) => {
            if (isMounted) {
              handleDecodedToken(decodedText);
            }
          },
          (err) => {
            if (isMounted) {
              setCameraError(categorizeCameraError(err));
              setIsScanning(false);
            }
          },
          preferredId
        );

        if (isMounted) {
          setIsScanning(true);
          // Re-enumerate to capture populated labels now that camera permission is active
          loadDevices(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setCameraError(categorizeCameraError(err));
          setIsScanning(false);
        }
      }
    };

    init();

    // Listen to physical device changes (e.g. iPhone connected wirelessly via Continuity)
    const onDeviceChange = () => {
      loadDevices(false);
    };

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    }

    return () => {
      isMounted = false;
      if (navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
      }
      if (scannerManagerRef.current) {
        scannerManagerRef.current.destroy().catch((err) => {
          console.warn("Scanner cleanup error:", err);
        });
        scannerManagerRef.current = null;
      }
    };
  }, [handleDecodedToken, loadDevices]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim() || isProcessing) return;
    processToken(manualToken.trim());
    setManualToken("");
  };

  const selectedDevice = devices.find((d) => d.deviceId === selectedDeviceId);
  const isContinuityActive = selectedDevice?.isContinuity;
  const hasContinuityDevice = devices.some((d) => d.isContinuity);

  const renderCameraErrorContent = () => {
    if (!cameraError) return null;

    const isHttpsIssue = cameraError.type === "INSECURE_ORIGIN";

    return (
      <div
        className="scanner-viewport"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1.5rem",
          textAlign: "center",
          background: isHttpsIssue ? "rgba(30, 41, 59, 0.95)" : "var(--bg-secondary)",
          color: "var(--text-secondary)",
          minHeight: "300px",
          border: isHttpsIssue ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
        }}
      >
        {isHttpsIssue ? (
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(245, 158, 11, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <Lock size={28} color="#f59e0b" />
          </div>
        ) : cameraError.type === "PERMISSION_DENIED" ? (
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(244, 63, 94, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <CameraOff size={28} color="#f43f5e" />
          </div>
        ) : (
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(244, 63, 94, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <AlertCircle size={28} color="#f43f5e" />
          </div>
        )}

        <h4
          style={{
            color: isHttpsIssue ? "#fbbf24" : "#fda4af",
            marginBottom: "0.5rem",
            fontSize: "1.1rem",
            fontWeight: 700,
          }}
        >
          {cameraError.title}
        </h4>

        <p style={{ fontSize: "0.875rem", marginBottom: "0.75rem", maxWidth: "480px", lineHeight: "1.4" }}>
          {cameraError.message}
        </p>

        {cameraError.actionableHint && (
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              marginBottom: "1.25rem",
              maxWidth: "480px",
              lineHeight: "1.4",
            }}
          >
            {cameraError.actionableHint}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          {cameraError.suggestedUrl && (
            <a
              href={cameraError.suggestedUrl}
              className="btn btn-primary btn-sm"
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <ExternalLink size={14} />
              <span>Open via HTTPS</span>
            </a>
          )}

          <button
            onClick={() => startScanner()}
            className="btn btn-outline btn-sm"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <RefreshCw size={14} />
            <span>{isHttpsIssue ? "Try Camera Anyway" : "Retry Camera"}</span>
          </button>
        </div>
      </div>
    );
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

        {/* Camera Device Selector & Apple Continuity Bar */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: "240px" }}>
              <Camera size={16} color="var(--accent-cyan)" />
              <label
                htmlFor="camera-select"
                style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}
              >
                Video Source:
              </label>
              <select
                id="camera-select"
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="form-input"
                style={{
                  padding: "0.3rem 0.6rem",
                  fontSize: "0.8rem",
                  height: "auto",
                  flex: 1,
                  background: "var(--bg-secondary)",
                }}
              >
                {devices.length === 0 && (
                  <option value="">Default Camera (Auto)</option>
                )}
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.displayLabel}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <button
                type="button"
                onClick={() => loadDevices(true)}
                disabled={isRefreshingDevices}
                className="btn btn-outline btn-sm"
                title="Refresh camera list"
                style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
              >
                <RefreshCw size={12} className={isRefreshingDevices ? "animate-spin" : ""} />
                <span>Refresh Cameras</span>
              </button>

              <button
                type="button"
                onClick={() => setShowContinuityTip((prev) => !prev)}
                className="btn btn-outline btn-sm"
                title="Apple Continuity Camera Info"
                style={{ padding: "0.3rem 0.5rem" }}
              >
                <Info size={14} color={isContinuityActive ? "#10b981" : "var(--text-muted)"} />
              </button>
            </div>
          </div>

          {/* Continuity Camera Status / Helper Guidance */}
          {isContinuityActive ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.75rem",
                color: "#6ee7b7",
                background: "rgba(16, 185, 129, 0.1)",
                padding: "0.25rem 0.5rem",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <Sparkles size={13} color="#10b981" />
              <span>
                <strong>Apple Continuity Camera Active:</strong> Using wireless high-resolution iPhone camera.
              </span>
            </div>
          ) : (
            (showContinuityTip || !hasContinuityDevice) && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  background: "rgba(255, 255, 255, 0.03)",
                  padding: "0.35rem 0.6rem",
                  borderRadius: "var(--radius-sm)",
                  lineHeight: "1.4",
                }}
              >
                <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                  💡 Apple Continuity Camera:
                </span>{" "}
                To use your iPhone as a wireless camera on Mac, ensure both devices share the same <strong>Apple ID</strong>, with <strong>Wi-Fi and Bluetooth</strong> enabled. Then click <em>Refresh Cameras</em>.
              </div>
            )
          )}
        </div>

        {/* Viewfinder Element */}
        <div style={{ position: "relative", marginBottom: "1.5rem", minHeight: "280px" }}>
          <div
            id="qr-reader-viewport"
            className="scanner-viewport"
            style={{
              visibility: cameraError ? "hidden" : "visible",
              position: cameraError ? "absolute" : "relative",
              top: 0,
              left: 0,
              width: "100%",
            }}
          />
          {isScanning && !cameraError && <div className="scanner-laser" />}

          {cameraError && renderCameraErrorContent()}
        </div>

        {/* Camera Toggle Bar */}
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {isScanning ? (
            <button onClick={stopScanner} className="btn btn-outline btn-sm">
              <span>Pause Camera</span>
            </button>
          ) : (
            <button onClick={() => startScanner()} className="btn btn-primary btn-sm">
              <Camera size={14} />
              <span>Activate Camera</span>
            </button>
          )}
        </div>

        {/* Manual Token Entry Fallback */}
        <form onSubmit={handleManualSubmit} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <label className="form-label" htmlFor="manual-token" style={{ fontSize: "0.8rem", marginBottom: 0 }}>
              Manual Token Entry (Direct Fallback)
            </label>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Always active
            </span>
          </div>
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
