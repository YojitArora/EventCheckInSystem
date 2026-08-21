export type Role = "ORGANIZER" | "ATTENDEE";

export type RegistrationStatus = "REGISTERED" | "CANCELLED";

export type CheckInSource = "ONLINE" | "OFFLINE_SYNC";

export type SyncResult =
  | "SUCCESS"
  | "ALREADY_CHECKED_IN"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "EVENT_CLOSED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthResponseData {
  user: User;
  token: string;
}

export interface EventDetail {
  id: string;
  name: string;
  date: string;
  capacity: number;
  organizerId: string;
  organizer: {
    id: string;
    name: string;
    email: string;
  };
  registeredCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Registration {
  id: string;
  eventId: string;
  attendeeId: string;
  status: RegistrationStatus;
  createdAt: string;
  event?: EventDetail;
}

export interface QrTicketInfo {
  token: string;
  qrCodeDataUrl: string;
  expiresAt: string;
}

export interface Ticket {
  id: string;
  eventId: string;
  attendeeId: string;
  status: RegistrationStatus;
  createdAt: string;
  event: {
    id: string;
    name: string;
    date: string;
    capacity: number;
  };
  attendee: {
    id: string;
    name: string;
    email: string;
  };
  ticket?: QrTicketInfo;
}

export interface CheckInRecord {
  id: string;
  registrationId: string;
  checkedInAt: string;
  source: CheckInSource;
  createdAt?: string;
}

export interface CheckInSuccessPayload {
  checkIn: CheckInRecord;
  attendee: {
    id: string;
    name: string;
    email: string;
  };
  event: {
    id: string;
    name: string;
    date: string;
    capacity: number;
    organizerId: string;
  };
}

export interface SyncCheckInPayload {
  deviceId: string;
  clientScanId: string;
  token: string;
  scannedAt: string;
}

export interface SyncCheckInResponse {
  result: SyncResult;
  isDuplicateSync?: boolean;
  message: string;
  syncEvent: {
    id: string;
    deviceId: string;
    clientScanId: string;
    result: SyncResult;
    scannedAt: string;
    syncedAt: string;
    checkInId?: string | null;
  };
  checkIn?: CheckInRecord;
  attendee?: {
    id: string;
    name: string;
    email: string;
  };
  event?: {
    id: string;
    name: string;
    date: string;
  };
}

export interface PeakCheckInTime {
  hour: string;
  count: number;
}

export interface EventDashboard {
  totalCapacity: number;
  totalRegisteredAttendees: number;
  checkedInCount: number;
  remainingCapacity: number;
  noShows: number;
  attendancePercentage: number;
  peakCheckInTime: PeakCheckInTime | null;
}

export interface AIInsightResponse {
  source: "gemini" | "database" | string;
  statistics: EventDashboard;
  insight?: string;
  summary: string;
  observations: string[];
  recommendations: string[];
}

export interface ApiSuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
