import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

export type ScannerStatus = "IDLE" | "STARTING" | "SCANNING" | "STOPPING" | "ERROR";

export type CameraErrorType =
  | "INSECURE_ORIGIN"
  | "PERMISSION_DENIED"
  | "CAMERA_NOT_FOUND"
  | "CAMERA_IN_USE"
  | "UNSUPPORTED_BROWSER"
  | "UNKNOWN";

export interface CameraErrorInfo {
  type: CameraErrorType;
  title: string;
  message: string;
  suggestedUrl?: string;
  actionableHint?: string;
}

export interface SecurityContextCheck {
  isSupported: boolean;
  errorInfo?: CameraErrorInfo;
  reason?: string;
}

export type CameraDeviceKind =
  | "IPHONE_CONTINUITY"
  | "FACETIME_MAC"
  | "EXTERNAL"
  | "GENERIC";

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  displayLabel: string;
  kind: CameraDeviceKind;
  isContinuity: boolean;
}

/**
 * Classifies camera device labels into categorized device types (iPhone Continuity, Mac/FaceTime, External).
 */
export function classifyCameraDevice(
  rawLabel: string,
  index = 0
): { displayLabel: string; kind: CameraDeviceKind; isContinuity: boolean } {
  const lower = (rawLabel || "").toLowerCase();

  const isIPhone =
    lower.includes("iphone") ||
    lower.includes("continuity") ||
    lower.includes("desk view");

  if (isIPhone) {
    const cleanLabel = rawLabel.replace(/\s*\([^)]*\)/g, "").trim() || "iPhone Camera";
    return {
      displayLabel: `📱 ${cleanLabel} (Continuity Camera)`,
      kind: "IPHONE_CONTINUITY",
      isContinuity: true,
    };
  }

  const isMacFaceTime =
    lower.includes("facetime") ||
    lower.includes("built-in") ||
    lower.includes("isight") ||
    lower.includes("macbook") ||
    lower.includes("imac") ||
    lower.includes("apple");

  if (isMacFaceTime) {
    const cleanLabel = rawLabel.trim() || "FaceTime HD Camera";
    return {
      displayLabel: `💻 ${cleanLabel} (Mac Camera)`,
      kind: "FACETIME_MAC",
      isContinuity: false,
    };
  }

  const isExternal =
    lower.includes("usb") ||
    lower.includes("logitech") ||
    lower.includes("elgato") ||
    lower.includes("webcam") ||
    lower.includes("camlink") ||
    lower.includes("external");

  if (isExternal) {
    const cleanLabel = rawLabel.trim() || `External Camera ${index + 1}`;
    return {
      displayLabel: `🎥 ${cleanLabel} (External)`,
      kind: "EXTERNAL",
      isContinuity: false,
    };
  }

  const cleanLabel = rawLabel.trim() || `Camera ${index + 1}`;
  return {
    displayLabel: `📷 ${cleanLabel}`,
    kind: "GENERIC",
    isContinuity: false,
  };
}

/**
 * Enumerates all video input devices available in the browser.
 * Prompts for camera permission first if requested, so device labels are populated by the browser.
 */
export async function getCameraDevices(
  requestPermissionFirst = true
): Promise<CameraDeviceInfo[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return [];
  }

  // Request brief permission to unlock device labels if supported
  if (requestPermissionFirst && navigator.mediaDevices.getUserMedia) {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      tempStream.getTracks().forEach((track) => track.stop());
    } catch {
      // If permission prompt was denied or already given, proceed to enumerate
    }
  }

  if (!navigator.mediaDevices.enumerateDevices) {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((d) => d.kind === "videoinput");

  return videoInputs.map((device, idx) => {
    const { displayLabel, kind, isContinuity } = classifyCameraDevice(
      device.label,
      idx
    );
    return {
      deviceId: device.deviceId,
      label: device.label || `Camera ${idx + 1}`,
      displayLabel,
      kind,
      isContinuity,
    };
  });
}

/**
 * Automatically selects the best camera device:
 * 1. Prioritizes iPhone / Continuity Camera whenever one is detected.
 * 2. If no iPhone is detected, preserves user's current selection if valid.
 * 3. Otherwise prioritizes external cameras, then Mac FaceTime/built-in camera.
 */
export function selectPreferredCamera(
  devices: CameraDeviceInfo[],
  currentSelectedId?: string
): string | undefined {
  if (!devices || devices.length === 0) return undefined;

  // 1. Always prefer iPhone / Continuity Camera when available
  const continuity = devices.find(
    (d) => d.isContinuity || d.kind === "IPHONE_CONTINUITY"
  );
  if (continuity) {
    return continuity.deviceId;
  }

  // 2. Preserve user's current manual selection if it still exists in the device list
  if (currentSelectedId && devices.some((d) => d.deviceId === currentSelectedId)) {
    return currentSelectedId;
  }

  // 3. Prefer external camera
  const external = devices.find((d) => d.kind === "EXTERNAL");
  if (external) {
    return external.deviceId;
  }

  // 4. Fallback to Mac FaceTime or first available camera
  const macFaceTime = devices.find((d) => d.kind === "FACETIME_MAC");
  if (macFaceTime) {
    return macFaceTime.deviceId;
  }

  return devices[0].deviceId;
}

/**
 * Validates that the current environment supports camera streaming.
 * Browsers strictly require a Secure Context (HTTPS or localhost/127.0.0.1)
 * to access navigator.mediaDevices.getUserMedia.
 */
export function checkCameraSecurityContext(): SecurityContextCheck {
  if (typeof window === "undefined") {
    return {
      isSupported: false,
      reason: "Window environment is not available.",
      errorInfo: {
        type: "UNSUPPORTED_BROWSER",
        title: "Environment Unavailable",
        message: "Window environment is not available.",
      },
    };
  }

  const hostname = window.location?.hostname || "";
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  const isSecure = Boolean(window.isSecureContext || isLocalhost);

  if (!isSecure) {
    const origin = window.location?.origin || "insecure origin";
    const suggestedUrl = `https://${window.location?.host || hostname}${window.location?.pathname || ""}`;
    const reason = `Camera access requires a Secure Context (HTTPS or localhost). You are connected via an insecure origin (${origin}).`;
    return {
      isSupported: false,
      reason,
      errorInfo: {
        type: "INSECURE_ORIGIN",
        title: "HTTPS Required on Mobile / LAN",
        message: `Camera access is blocked by browser security because this page is loaded over insecure HTTP (${origin}).`,
        suggestedUrl,
        actionableHint:
          "To use the camera on a phone or LAN device, serve the frontend over HTTPS with local SSL certificates (e.g., using mkcert) and open the HTTPS URL. You can also use Manual Token Entry below.",
      },
    };
  }

  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    const reason =
      "Camera API (navigator.mediaDevices.getUserMedia) is not supported in this browser.";
    return {
      isSupported: false,
      reason,
      errorInfo: {
        type: "UNSUPPORTED_BROWSER",
        title: "Camera API Unsupported",
        message: reason,
        actionableHint:
          "Please use a modern browser like Chrome, Safari, or Firefox, or use Manual Token Entry below.",
      },
    };
  }

  return { isSupported: true };
}

/**
 * Categorizes raw camera errors into structured, user-friendly error details.
 */
export function categorizeCameraError(err: unknown): CameraErrorInfo {
  if (!err) {
    return {
      type: "UNKNOWN",
      title: "Camera Unavailable",
      message: "Failed to access camera. Please try again.",
      actionableHint: "Click Retry Camera to request access again.",
    };
  }

  const errorName = (err as any)?.name || "";
  const errorMessage = (err as any)?.message || String(err);

  // Insecure origin check
  if (
    errorMessage.toLowerCase().includes("secure context") ||
    errorMessage.toLowerCase().includes("insecure origin")
  ) {
    const origin = typeof window !== "undefined" ? window.location?.origin : "insecure origin";
    const suggestedUrl =
      typeof window !== "undefined"
        ? `https://${window.location?.host}${window.location?.pathname}`
        : undefined;
    return {
      type: "INSECURE_ORIGIN",
      title: "HTTPS Required on Mobile / LAN",
      message: `Camera access is blocked because this page is served over insecure HTTP (${origin}).`,
      suggestedUrl,
      actionableHint:
        "Please open the HTTPS address with SSL enabled in Vite, or use Manual Token Entry below.",
    };
  }

  // Permission denied
  if (
    errorName === "NotAllowedError" ||
    errorName === "PermissionDeniedError" ||
    errorMessage.toLowerCase().includes("permission") ||
    errorMessage.toLowerCase().includes("not allowed")
  ) {
    return {
      type: "PERMISSION_DENIED",
      title: "Camera Permission Denied",
      message: "Camera permission was rejected by the browser or operating system.",
      actionableHint:
        "Tap the permissions / padlock icon in your browser address bar to allow Camera access, then tap 'Retry Camera'.",
    };
  }

  // No camera device found
  if (
    errorName === "NotFoundError" ||
    errorName === "DevicesNotFoundError" ||
    errorMessage.toLowerCase().includes("notfound") ||
    errorMessage.toLowerCase().includes("no camera")
  ) {
    return {
      type: "CAMERA_NOT_FOUND",
      title: "No Camera Detected",
      message: "No video capture device was found on this system.",
      actionableHint:
        "Verify your camera is connected or use an iPhone via Continuity Camera, or use the Manual Token Entry field below.",
    };
  }

  // Camera in use / hardware failure
  if (
    errorName === "NotReadableError" ||
    errorName === "TrackStartError" ||
    errorMessage.toLowerCase().includes("notreadable") ||
    errorMessage.toLowerCase().includes("could not start video source")
  ) {
    return {
      type: "CAMERA_IN_USE",
      title: "Camera In Use",
      message: "The camera is currently reserved by another application or browser tab.",
      actionableHint:
        "Close any background apps using the camera (Zoom, FaceTime, etc.) and tap 'Retry Camera'.",
    };
  }

  if (
    errorName === "OverconstrainedError" ||
    errorName === "ConstraintNotSatisfiedError"
  ) {
    return {
      type: "UNKNOWN",
      title: "Camera Constraint Error",
      message: "The requested camera resolution or device is not supported.",
      actionableHint: "Tap 'Retry Camera' to retry with standard resolution.",
    };
  }

  return {
    type: "UNKNOWN",
    title: "Camera Access Error",
    message: errorMessage || "Failed to start camera session.",
    actionableHint: "Tap 'Retry Camera' to try again or enter the ticket token manually below.",
  };
}

/**
 * Formats any raw camera error into a human-actionable message string.
 */
export function formatCameraError(err: unknown): string {
  const info = categorizeCameraError(err);
  return `${info.message} ${info.actionableHint || ""}`.trim();
}

export interface ScannerLifecycleManagerOptions {
  elementId: string;
  deviceId?: string;
  fps?: number;
  qrbox?: number | { width: number; height: number } | ((viewfinderWidth: number, viewfinderHeight: number) => { width: number; height: number });
  aspectRatio?: number;
  facingMode?: "environment" | "user";
  // Custom Html5Qrcode factory for easy testing/mocking
  createScanner?: (elementId: string) => Html5Qrcode;
}

/**
 * Manages the lifecycle of an Html5Qrcode instance.
 * Supports explicit camera device selection (including Apple Continuity Camera),
 * optimizes decoder for hardware acceleration (BarcodeDetector API),
 * serializes concurrent start/stop/destroy calls,
 * and handles React StrictMode safely without leaked media streams.
 */
export class ScannerLifecycleManager {
  private elementId: string;
  private options: ScannerLifecycleManagerOptions;
  private scanner: Html5Qrcode | null = null;
  private status: ScannerStatus = "IDLE";
  private startPromise: Promise<void> | null = null;
  private stopPromise: Promise<void> | null = null;
  private isDestroyed = false;

  constructor(options: ScannerLifecycleManagerOptions) {
    this.elementId = options.elementId;
    this.options = options;
  }

  public getStatus(): ScannerStatus {
    return this.status;
  }

  public isScanning(): boolean {
    return this.status === "SCANNING";
  }

  public getScannerInstance(): Html5Qrcode | null {
    return this.scanner;
  }

  public setDeviceId(deviceId?: string): void {
    this.options.deviceId = deviceId;
  }

  public getDeviceId(): string | undefined {
    return this.options.deviceId;
  }

  public start(
    onScan: (decodedText: string) => void,
    onError?: (error: Error) => void,
    overrideDeviceId?: string
  ): Promise<void> {
    // If destroyed, do not start
    if (this.isDestroyed) {
      return Promise.resolve();
    }

    if (overrideDeviceId) {
      this.options.deviceId = overrideDeviceId;
    }

    // Already scanning
    if (this.status === "SCANNING") {
      return Promise.resolve();
    }

    // If start is already in-flight, return existing start promise (prevent duplicate start)
    if (this.status === "STARTING" && this.startPromise) {
      return this.startPromise;
    }

    // If stop is currently running, wait for it to complete first
    if (this.status === "STOPPING" && this.stopPromise) {
      const pendingStop = this.stopPromise;
      this.startPromise = (async () => {
        await pendingStop;
        if (this.isDestroyed) return;
        return this.start(onScan, onError, overrideDeviceId);
      })();
      return this.startPromise;
    }

    this.status = "STARTING";

    this.startPromise = (async () => {
      try {
        // 1. Check secure context & mediaDevices
        const security = checkCameraSecurityContext();
        if (!security.isSupported) {
          throw new Error(security.reason);
        }

        // 2. Ensure target viewport element exists in DOM
        if (typeof document !== "undefined") {
          const element = document.getElementById(this.elementId);
          if (!element) {
            throw new Error(`Scanner viewport #${this.elementId} not found in DOM.`);
          }
        }

        // 3. Initialize single scanner instance with hardware acceleration and QR format filter
        if (!this.scanner) {
          if (this.options.createScanner) {
            this.scanner = this.options.createScanner(this.elementId);
          } else {
            this.scanner = new Html5Qrcode(this.elementId, {
              formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
              verbose: false,
              useBarCodeDetectorIfSupported: true,
              experimentalFeatures: {
                useBarCodeDetectorIfSupported: true,
              },
            });
          }
        }

        // Stop any stale session on this scanner instance
        if (this.scanner.isScanning) {
          try {
            await this.scanner.stop();
          } catch {
            // Ignore error when stopping stale session
          }
        }

        // 4. Configure camera selector: Use exact deviceId if selected, otherwise facingMode
        const cameraConfig = this.options.deviceId
          ? { deviceId: { exact: this.options.deviceId } }
          : { facingMode: this.options.facingMode || "environment" };

        // Dynamic responsive qrbox calculation for maximum scan sensitivity
        const defaultQrbox = (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edge = Math.max(220, Math.floor(minEdge * 0.85));
          return { width: edge, height: edge };
        };

        // 5. Start camera stream with fast FPS and wide recognition region
        await this.scanner.start(
          cameraConfig as any,
          {
            fps: this.options.fps || 15,
            qrbox: this.options.qrbox || defaultQrbox,
            disableFlip: false,
          },
          (decodedText: string) => {
            if (this.isDestroyed || this.status !== "SCANNING") return;
            onScan(decodedText);
          },
          () => {
            // QR frame scan failure (expected between frames)
          }
        );

        // 6. Handle cleanup if destroy/stop was requested while start() was pending
        if (this.isDestroyed || this.status === "STOPPING") {
          if (this.scanner && this.scanner.isScanning) {
            try {
              await this.scanner.stop();
            } catch {
              // Ignore stop errors on unmount
            }
            try {
              this.scanner.clear();
            } catch {
              // Ignore clear errors on unmount
            }
          }
          this.status = "IDLE";
          return;
        }

        this.status = "SCANNING";
      } catch (err: any) {
        this.status = "ERROR";
        if (onError) {
          onError(err instanceof Error ? err : new Error(String(err)));
        }
        throw err;
      } finally {
        this.startPromise = null;
      }
    })();

    return this.startPromise;
  }

  public stop(): Promise<void> {
    if (this.status === "IDLE" || this.status === "ERROR") {
      return Promise.resolve();
    }

    if (this.status === "STOPPING" && this.stopPromise) {
      return this.stopPromise;
    }

    // If start is in progress, mark status as STOPPING so start() aborts once resolved
    if (this.status === "STARTING" && this.startPromise) {
      this.status = "STOPPING";
      this.stopPromise = (async () => {
        try {
          await this.startPromise;
        } catch {
          // Start failed, stop fulfilled
        } finally {
          this.status = "IDLE";
          this.stopPromise = null;
        }
      })();
      return this.stopPromise;
    }

    this.status = "STOPPING";

    this.stopPromise = (async () => {
      try {
        if (this.scanner && this.scanner.isScanning) {
          await this.scanner.stop();
        }
        if (this.scanner) {
          try {
            this.scanner.clear();
          } catch {
            // Ignore clear errors
          }
        }
      } catch (err) {
        console.warn("Error while stopping scanner:", err);
      } finally {
        this.status = "IDLE";
        this.stopPromise = null;
      }
    })();

    return this.stopPromise;
  }

  public async destroy(): Promise<void> {
    this.isDestroyed = true;

    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // Ignore startup errors during destroy
      }
    }

    if (this.stopPromise) {
      try {
        await this.stopPromise;
      } catch {
        // Ignore stop errors during destroy
      }
    }

    if (this.scanner) {
      if (this.scanner.isScanning) {
        try {
          await this.scanner.stop();
        } catch {
          // Ignore errors
        }
      }
      try {
        this.scanner.clear();
      } catch {
        // Ignore errors
      }
      this.scanner = null;
    }

    this.status = "IDLE";
  }
}
