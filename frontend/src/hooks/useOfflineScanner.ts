import { useEffect, useState } from "react";
import { checkinApi } from "../api/checkin.api";
import { SyncCheckInPayload, SyncCheckInResponse } from "../types";

export interface QueuedScan extends SyncCheckInPayload {
  id: string;
  eventName?: string;
  queuedAt: string;
  status: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
  lastError?: string;
}

const OFFLINE_QUEUE_KEY = "eventpass_offline_scan_queue";
const DEVICE_ID_KEY = "eventpass_device_id";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `scanner-${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function useOfflineScanner() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [queue, setQueue] = useState<QueuedScan[]>(() => {
    try {
      const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }, [queue]);

  const enqueueScan = (token: string, eventName?: string): QueuedScan => {
    const clientScanId = `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newScan: QueuedScan = {
      id: clientScanId,
      deviceId: getDeviceId(),
      clientScanId,
      token,
      scannedAt: new Date().toISOString(),
      queuedAt: new Date().toISOString(),
      eventName,
      status: "PENDING",
    };

    setQueue((prev) => [newScan, ...prev]);
    return newScan;
  };

  const syncQueue = async (): Promise<{
    synced: number;
    failed: number;
    results: SyncCheckInResponse[];
  }> => {
    if (!navigator.onLine || isSyncing) {
      return { synced: 0, failed: 0, results: [] };
    }

    const pendingScans = queue.filter((s) => s.status === "PENDING" || s.status === "FAILED");
    if (pendingScans.length === 0) {
      return { synced: 0, failed: 0, results: [] };
    }

    setIsSyncing(true);
    let synced = 0;
    let failed = 0;
    const results: SyncCheckInResponse[] = [];

    for (const scan of pendingScans) {
      try {
        setQueue((prev) =>
          prev.map((s) => (s.id === scan.id ? { ...s, status: "SYNCING" } : s))
        );

        const response = await checkinApi.syncCheckIn({
          deviceId: scan.deviceId,
          clientScanId: scan.clientScanId,
          token: scan.token,
          scannedAt: scan.scannedAt,
        });

        results.push(response);
        synced++;

        setQueue((prev) =>
          prev.map((s) => (s.id === scan.id ? { ...s, status: "SYNCED" } : s))
        );
      } catch (err: any) {
        failed++;
        setQueue((prev) =>
          prev.map((s) =>
            s.id === scan.id
              ? { ...s, status: "FAILED", lastError: err?.message || "Sync failed" }
              : s
          )
        );
      }
    }

    setIsSyncing(false);
    return { synced, failed, results };
  };

  const clearCompleted = () => {
    setQueue((prev) => prev.filter((s) => s.status !== "SYNCED"));
  };

  return {
    isOnline,
    queue,
    isSyncing,
    pendingCount: queue.filter((s) => s.status === "PENDING" || s.status === "FAILED").length,
    enqueueScan,
    syncQueue,
    clearCompleted,
  };
}
