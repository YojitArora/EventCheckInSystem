import { API_BASE_URL, apiClient } from "./axios";
import { ApiSuccessResponse, EventDashboard } from "../types";

export const dashboardApi = {
  async getDashboard(eventId: string): Promise<EventDashboard> {
    const res = await apiClient.get<ApiSuccessResponse<{ dashboard: EventDashboard }>>(
      `/events/${eventId}/dashboard`
    );
    return res.data.data.dashboard;
  },

  getExportUrl(eventId: string): string {
    return `${API_BASE_URL}/events/${eventId}/export`;
  },

  async downloadCsv(eventId: string, eventName: string): Promise<void> {
    const res = await apiClient.get(`/events/${eventId}/export`, {
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const sanitizedName = eventName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    link.setAttribute("download", `event-${sanitizedName}-attendees.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
