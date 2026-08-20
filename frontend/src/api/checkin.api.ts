import { apiClient } from "./axios";
import {
  ApiSuccessResponse,
  CheckInSuccessPayload,
  SyncCheckInPayload,
  SyncCheckInResponse,
} from "../types";

export const checkinApi = {
  async checkIn(token: string): Promise<CheckInSuccessPayload> {
    const res = await apiClient.post<ApiSuccessResponse<CheckInSuccessPayload>>("/api/checkins", {
      token,
    });
    return res.data.data;
  },

  async syncCheckIn(payload: SyncCheckInPayload): Promise<SyncCheckInResponse> {
    const res = await apiClient.post<ApiSuccessResponse<SyncCheckInResponse>>(
      "/api/checkins/sync",
      payload
    );
    return res.data.data;
  },
};
