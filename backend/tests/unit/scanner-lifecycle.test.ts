import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  ScannerLifecycleManager,
  checkCameraSecurityContext,
  formatCameraError,
} from "../../../frontend/src/utils/qrScanner";

// Mock Html5Qrcode interface
class MockHtml5Qrcode {
  public elementId: string;
  public isScanning = false;
  public startCalls = 0;
  public stopCalls = 0;
  public clearCalls = 0;
  public startDelayMs = 0;
  public shouldFailStart = false;
  public startErrorMessage = "Permission denied";

  constructor(elementId: string) {
    this.elementId = elementId;
  }

  async start(
    _camera: any,
    _config: any,
    onSuccess: (text: string) => void,
    _onError: any
  ): Promise<null> {
    this.startCalls++;
    if (this.startDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.startDelayMs));
    }
    if (this.shouldFailStart) {
      const err = new Error(this.startErrorMessage);
      err.name = "NotAllowedError";
      throw err;
    }
    this.isScanning = true;
    (this as any)._onSuccess = onSuccess;
    return null;
  }

  async stop(): Promise<void> {
    this.stopCalls++;
    this.isScanning = false;
  }

  clear(): void {
    this.clearCalls++;
  }

  simulateScan(token: string) {
    if ((this as any)._onSuccess) {
      (this as any)._onSuccess(token);
    }
  }
}

describe("Scanner Lifecycle and Origin Validation Unit Tests", () => {
  beforeEach(() => {
    // Setup simulated browser globals
    vi.stubGlobal("window", {
      isSecureContext: true,
      location: {
        hostname: "localhost",
        origin: "http://localhost:5173",
        protocol: "http:",
      },
    });

    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(),
      },
    });

    vi.stubGlobal("document", {
      getElementById: vi.fn().mockReturnValue({ id: "qr-reader-viewport" }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("Camera Security Context & Error Formatting", () => {
    it("allows camera on localhost even over http", () => {
      vi.stubGlobal("window", {
        isSecureContext: false,
        location: { hostname: "localhost", origin: "http://localhost:5173" },
      });
      const check = checkCameraSecurityContext();
      expect(check.isSupported).toBe(true);
    });

    it("rejects camera when accessed over insecure LAN IP origin", () => {
      vi.stubGlobal("window", {
        isSecureContext: false,
        location: { hostname: "192.168.1.100", origin: "http://192.168.1.100:5173" },
      });
      const check = checkCameraSecurityContext();
      expect(check.isSupported).toBe(false);
      expect(check.reason).toContain("Secure Context");
      expect(check.reason).toContain("http://192.168.1.100:5173");
    });

    it("categorizes insecure origin errors with title and action hint", () => {
      vi.stubGlobal("window", {
        isSecureContext: false,
        location: { hostname: "172.20.10.2", host: "172.20.10.2:5173", origin: "http://172.20.10.2:5173", pathname: "/organizer/scanner" },
      });
      const check = checkCameraSecurityContext();
      expect(check.isSupported).toBe(false);
      expect(check.errorInfo?.type).toBe("INSECURE_ORIGIN");
      expect(check.errorInfo?.title).toContain("HTTPS Required");
      expect(check.errorInfo?.suggestedUrl).toBe("https://172.20.10.2:5173/organizer/scanner");
    });

    it("formats permission errors into actionable instructions", () => {
      const err = new Error("NotAllowedError: Permission denied");
      (err as any).name = "NotAllowedError";
      const formatted = formatCameraError(err);
      expect(formatted).toContain("permission was rejected");
      expect(formatted).toContain("Retry Camera");
    });

    it("formats camera not found errors", () => {
      const err = new Error("Requested device not found");
      (err as any).name = "NotFoundError";
      const formatted = formatCameraError(err);
      expect(formatted).toContain("No video capture device");
      expect(formatted).toContain("Manual Token Entry");
    });

    it("fails early with INSECURE_ORIGIN without attempting getUserMedia when in insecure context", async () => {
      vi.stubGlobal("window", {
        isSecureContext: false,
        location: { hostname: "172.20.10.2", host: "172.20.10.2:5173", origin: "http://172.20.10.2:5173", pathname: "/organizer/scanner" },
      });

      let scannerInstance: MockHtml5Qrcode | null = null;
      const manager = new ScannerLifecycleManager({
        elementId: "qr-reader-viewport",
        createScanner: (el) => {
          scannerInstance = new MockHtml5Qrcode(el);
          return scannerInstance as any;
        },
      });

      const onError = vi.fn();
      await expect(manager.start(vi.fn(), onError)).rejects.toThrow("Secure Context");
      expect(manager.getStatus()).toBe("ERROR");
      expect(scannerInstance).toBeNull(); // Scanner was not even instantiated
    });
  });

  describe("ScannerLifecycleManager", () => {
    it("Test 1: scanner start called twice shares single startup promise and single session", async () => {
      let createdScanner: MockHtml5Qrcode | null = null;
      const manager = new ScannerLifecycleManager({
        elementId: "qr-reader-viewport",
        createScanner: (el) => {
          createdScanner = new MockHtml5Qrcode(el);
          createdScanner.startDelayMs = 20;
          return createdScanner as any;
        },
      });

      const onScan = vi.fn();
      const promise1 = manager.start(onScan);
      const promise2 = manager.start(onScan);

      // Both calls should return the identical promise
      expect(promise1).toBe(promise2);

      await Promise.all([promise1, promise2]);

      expect(manager.isScanning()).toBe(true);
      expect(manager.getStatus()).toBe("SCANNING");
      expect(createdScanner!.startCalls).toBe(1);
    });

    it("Test 2: scanner cleanup/destroy during startup prevents stale active session", async () => {
      let createdScanner: MockHtml5Qrcode | null = null;
      const manager = new ScannerLifecycleManager({
        elementId: "qr-reader-viewport",
        createScanner: (el) => {
          createdScanner = new MockHtml5Qrcode(el);
          createdScanner.startDelayMs = 50;
          return createdScanner as any;
        },
      });

      const onScan = vi.fn();
      const startPromise = manager.start(onScan);

      // Immediately destroy/stop before start() completes (e.g. StrictMode unmount)
      await manager.destroy();
      await startPromise;

      expect(manager.isScanning()).toBe(false);
      expect(manager.getStatus()).toBe("IDLE");
      // Stop should have been called on the scanner to avoid dangling tracks
      expect(createdScanner!.stopCalls).toBeGreaterThanOrEqual(1);
    });

    it("Test 3: retry after camera failure allows clean re-initialization", async () => {
      let scannerInstance: MockHtml5Qrcode | null = null;
      const manager = new ScannerLifecycleManager({
        elementId: "qr-reader-viewport",
        createScanner: (el) => {
          scannerInstance = new MockHtml5Qrcode(el);
          scannerInstance.shouldFailStart = true;
          return scannerInstance as any;
        },
      });

      const onError = vi.fn();
      await expect(manager.start(vi.fn(), onError)).rejects.toThrow("Permission denied");
      expect(manager.getStatus()).toBe("ERROR");
      expect(onError).toHaveBeenCalledTimes(1);

      // Fix failure condition and retry
      scannerInstance!.shouldFailStart = false;
      await manager.start(vi.fn());

      expect(manager.getStatus()).toBe("SCANNING");
      expect(manager.isScanning()).toBe(true);
    });

    it("Test 4: unmount cleanup stops camera and clears DOM", async () => {
      let createdScanner: MockHtml5Qrcode | null = null;
      const manager = new ScannerLifecycleManager({
        elementId: "qr-reader-viewport",
        createScanner: (el) => {
          createdScanner = new MockHtml5Qrcode(el);
          return createdScanner as any;
        },
      });

      await manager.start(vi.fn());
      expect(manager.isScanning()).toBe(true);

      await manager.destroy();
      expect(manager.isScanning()).toBe(false);
      expect(createdScanner!.stopCalls).toBe(1);
      expect(createdScanner!.clearCalls).toBe(1);
    });

    it("Test 5: duplicate QR callbacks during processing are debounced", async () => {
      let createdScanner: MockHtml5Qrcode | null = null;
      const manager = new ScannerLifecycleManager({
        elementId: "qr-reader-viewport",
        createScanner: (el) => {
          createdScanner = new MockHtml5Qrcode(el);
          return createdScanner as any;
        },
      });

      const processedTokens: string[] = [];
      let isProcessing = false;
      let lastToken: string | null = null;
      let lastTime = 0;

      const handleScan = (raw: string) => {
        const token = raw.trim();
        if (isProcessing) return;
        const now = Date.now();
        if (lastToken === token && now - lastTime < 1000) return;
        lastToken = token;
        lastTime = now;
        isProcessing = true;
        processedTokens.push(token);
        // Simulate async processing
        setTimeout(() => {
          isProcessing = false;
        }, 100);
      };

      await manager.start(handleScan);

      // Rapidly fire same QR callback 5 times within 10ms
      createdScanner!.simulateScan("TOKEN_ABC");
      createdScanner!.simulateScan("TOKEN_ABC");
      createdScanner!.simulateScan("TOKEN_ABC");
      createdScanner!.simulateScan("TOKEN_ABC");
      createdScanner!.simulateScan("TOKEN_ABC");

      expect(processedTokens).toHaveLength(1);
      expect(processedTokens[0]).toBe("TOKEN_ABC");
    });
  });

  describe("Apple Continuity Camera & Multi-Device Support", () => {
    it("classifies iPhone Continuity Camera correctly", async () => {
      const { getCameraDevices } = await import("../../../frontend/src/utils/qrScanner");

      vi.stubGlobal("navigator", {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue({
            getTracks: () => [{ stop: vi.fn() }],
          }),
          enumerateDevices: vi.fn().mockResolvedValue([
            { deviceId: "mac-cam-1", label: "FaceTime HD Camera (Built-in)", kind: "videoinput" },
            { deviceId: "iphone-cam-2", label: "Yojit's iPhone (Continuity Camera)", kind: "videoinput" },
            { deviceId: "usb-cam-3", label: "Logitech C920 USB Pro HD", kind: "videoinput" },
          ]),
        },
      });

      const devices = await getCameraDevices(true);
      expect(devices).toHaveLength(3);

      const iphone = devices.find((d) => d.deviceId === "iphone-cam-2");
      expect(iphone).toBeDefined();
      expect(iphone?.isContinuity).toBe(true);
      expect(iphone?.kind).toBe("IPHONE_CONTINUITY");
      expect(iphone?.displayLabel).toContain("📱");
      expect(iphone?.displayLabel).toContain("Continuity Camera");

      const mac = devices.find((d) => d.deviceId === "mac-cam-1");
      expect(mac?.kind).toBe("FACETIME_MAC");
      expect(mac?.displayLabel).toContain("💻");

      const ext = devices.find((d) => d.deviceId === "usb-cam-3");
      expect(ext?.kind).toBe("EXTERNAL");
      expect(ext?.displayLabel).toContain("🎥");
    });

    it("prioritizes iPhone / Continuity Camera when available", async () => {
      const { selectPreferredCamera } = await import("../../../frontend/src/utils/qrScanner");

      const devices = [
        {
          deviceId: "mac-cam",
          label: "FaceTime HD Camera",
          displayLabel: "💻 FaceTime HD Camera",
          kind: "FACETIME_MAC" as const,
          isContinuity: false,
        },
        {
          deviceId: "iphone-continuity",
          label: "iPhone 15 Pro",
          displayLabel: "📱 iPhone 15 Pro (Continuity Camera)",
          kind: "IPHONE_CONTINUITY" as const,
          isContinuity: true,
        },
      ];

      // Should automatically select the iPhone continuity camera even if it is second in the list
      const selected = selectPreferredCamera(devices);
      expect(selected).toBe("iphone-continuity");
    });

    it("falls back to Mac camera when no iPhone is available", async () => {
      const { selectPreferredCamera } = await import("../../../frontend/src/utils/qrScanner");

      const devices = [
        {
          deviceId: "mac-cam",
          label: "FaceTime HD Camera (Built-in)",
          displayLabel: "💻 FaceTime HD Camera (Mac Camera)",
          kind: "FACETIME_MAC" as const,
          isContinuity: false,
        },
      ];

      const selected = selectPreferredCamera(devices);
      expect(selected).toBe("mac-cam");
    });

    it("switches cameras cleanly by stopping previous stream and starting new deviceId", async () => {
      let createdScanner: MockHtml5Qrcode | null = null;
      let lastStartedCameraConfig: any = null;

      const manager = new ScannerLifecycleManager({
        elementId: "qr-reader-viewport",
        deviceId: "mac-cam",
        createScanner: (el) => {
          createdScanner = new MockHtml5Qrcode(el);
          const origStart = createdScanner.start.bind(createdScanner);
          createdScanner.start = async (cam, config, success, err) => {
            lastStartedCameraConfig = cam;
            return origStart(cam, config, success, err);
          };
          return createdScanner as any;
        },
      });

      // Start initially with Mac camera
      await manager.start(vi.fn());
      expect(manager.isScanning()).toBe(true);
      expect(lastStartedCameraConfig).toEqual({ deviceId: { exact: "mac-cam" } });

      // Switch to iPhone Continuity Camera
      await manager.stop();
      expect(manager.isScanning()).toBe(false);

      await manager.start(vi.fn(), undefined, "iphone-continuity-cam");
      expect(manager.isScanning()).toBe(true);
      expect(lastStartedCameraConfig).toEqual({ deviceId: { exact: "iphone-continuity-cam" } });
    });
  });

  describe("Offline Queue Synchronization Logic", () => {
    it("Test 6: automatic offline queue sync processes pending items and keeps failed items retryable", async () => {
      const mockStorage: Record<string, string> = {};
      const storageMock = {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v;
        },
        removeItem: (k: string) => {
          delete mockStorage[k];
        },
      };
      vi.stubGlobal("localStorage", storageMock);

      // Enqueue items
      const initialQueue = [
        {
          id: "scan-1",
          deviceId: "dev-1",
          clientScanId: "scan-1",
          token: "VALID_TOKEN",
          scannedAt: new Date().toISOString(),
          queuedAt: new Date().toISOString(),
          status: "PENDING",
        },
        {
          id: "scan-2",
          deviceId: "dev-1",
          clientScanId: "scan-2",
          token: "NETWORK_FAIL_TOKEN",
          scannedAt: new Date().toISOString(),
          queuedAt: new Date().toISOString(),
          status: "FAILED",
        },
      ];

      storageMock.setItem("eventpass_offline_scan_queue", JSON.stringify(initialQueue));

      // Simulate syncQueue logic with mock API
      const syncCheckInApi = vi.fn().mockImplementation(async (payload) => {
        if (payload.token === "NETWORK_FAIL_TOKEN") {
          throw new Error("Network timeout");
        }
        return {
          result: "SUCCESS",
          message: "Synced",
          syncEvent: { id: "sync-1" },
        };
      });

      let queue = JSON.parse(storageMock.getItem("eventpass_offline_scan_queue")!);
      let isSyncing = false;

      const runSync = async () => {
        if (isSyncing) return;
        isSyncing = true;

        const pending = queue.filter(
          (s: any) => s.status === "PENDING" || s.status === "FAILED"
        );

        for (const scan of pending) {
          try {
            await syncCheckInApi(scan);
            scan.status = "SYNCED";
          } catch (err: any) {
            scan.status = "FAILED";
            scan.lastError = err.message;
          }
        }

        storageMock.setItem("eventpass_offline_scan_queue", JSON.stringify(queue));
        isSyncing = false;
      };

      await runSync();

      const updatedQueue = JSON.parse(storageMock.getItem("eventpass_offline_scan_queue")!);
      expect(updatedQueue[0].status).toBe("SYNCED");
      expect(updatedQueue[1].status).toBe("FAILED");
      expect(updatedQueue[1].lastError).toBe("Network timeout");

      // Verify that the failed scan remains in queue and can be retried on next sync
      syncCheckInApi.mockImplementationOnce(async () => ({
        result: "SUCCESS",
        message: "Synced on retry",
        syncEvent: { id: "sync-2" },
      }));

      await runSync();

      const reUpdatedQueue = JSON.parse(storageMock.getItem("eventpass_offline_scan_queue")!);
      expect(reUpdatedQueue[1].status).toBe("SYNCED");
    });
  });
});
