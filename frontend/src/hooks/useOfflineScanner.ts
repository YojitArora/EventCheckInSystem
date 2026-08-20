import { useCallback, useEffect, useRef, useState } from "react";
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

export function loadStoredQueue(): QueuedScan[] {
  try {
    const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveStoredQueue(queue: QueuedScan[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("Failed to persist offline queue:", err);
  }
}

export function useOfflineScanner() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [queue, setQueue] = useState<QueuedScan[]>(() => loadStoredQueue());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const isSyncingRef = useRef<boolean>(false);
  const queueRef = useRef<QueuedScan[]>(queue);

  // Keep queueRef and localStorage updated on state change
  useEffect(() => {
    queueRef.current = queue;
    saveStoredQueue(queue);
  }, [queue]);

  const enqueueScan = useCallback((token: string, eventName?: string): QueuedScan => {
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

    setQueue((prev) => {
      const updated = [newScan, ...prev];
      queueRef.current = updated;
      saveStoredQueue(updated);
      return updated;
    });

    return newScan;
  }, []);

  const syncQueue = useCallback(async (): Promise<{
    synced: number;
    failed: number;
    results: SyncCheckInResponse[];
  }> => {
    // Prevent duplicate sync requests and do not sync when offline
    if ((typeof navigator !== "undefined" && !navigator.onLine) || isSyncingRef.current) {
      return { synced: 0, failed: 0, results: [] };
    }

    const currentQueue = queueRef.current;
    const pendingScans = currentQueue.filter(
      (s) => s.status === "PENDING" || s.status === "FAILED"
    );

    if (pendingScans.length === 0) {
      return { synced: 0, failed: 0, results: [] };
    }

    isSyncingRef.current = true;
    setIsSyncing(true);

    let synced = 0;
    let failed = 0;
    const results: SyncCheckInResponse[] = [];

    for (const scan of pendingScans) {
      try {
        setQueue((prev) => {
          const updated = prev.map((s) =>
            s.id === scan.id ? { ...s, status: "SYNCING" as const } : s
          );
          queueRef.current = updated;
          saveStoredQueue(updated);
          return updated;
        });

        const response = await checkinApi.syncCheckIn({
          deviceId: scan.deviceId,
          clientScanId: scan.clientScanId,
          token: scan.token,
          scannedAt: scan.scannedAt,
        });

        results.push(response);
        synced++;

        setQueue((prev) => {
          const updated = prev.map((s) =>
            s.id === scan.id ? { ...s, status: "SYNCED" as const, lastError: undefined } : s
          );
          queueRef.current = updated;
          saveStoredQueue(updated);
          return updated;
        });
      } catch (err: any) {
        failed++;
        const errorMessage = err?.message || "Sync failed";
        setQueue((prev) => {
          const updated = prev.map((s) =>
            s.id === scan.id
              ? { ...s, status: "FAILED" as const, lastError: errorMessage }
              : s
          );
          queueRef.current = updated;
          saveStoredQueue(updated);
          return updated;
        });
      }
    }

    isSyncingRef.current = false;
    setIsSyncing(false);

    return { synced, failed, results };
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue((prev) => {
      const updated = prev.filter((s) => s.status !== "SYNCED");
      queueRef.current = updated;
      saveStoredQueue(updated);
      return updated;
    });
  }, []);

  // Listen for online/offline events and automatically trigger sync on reconnect
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Automatically synchronize pending scans on reconnect
      syncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // If online on initial mount with pending items, trigger background sync
    if (typeof navigator !== "undefined" && navigator.onLine) {
      const hasPending = queueRef.current.some(
        (s) => s.status === "PENDING" || s.status === "FAILED"
      );
      if (hasPending) {
        syncQueue();
      }
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncQueue]);

  const pendingCount = queue.filter(
    (s) => s.status === "PENDING" || s.status === "FAILED"
  ).length;

  return {
    isOnline,
    queue,
    isSyncing,
    pendingCount,
    enqueueScan,
    syncQueue,
    clearCompleted,
  };
}
