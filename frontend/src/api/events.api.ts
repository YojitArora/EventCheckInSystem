import { apiClient } from "./axios";
import { ApiSuccessResponse, EventDetail, Registration, Ticket } from "../types";

export interface CreateEventPayload {
  name: string;
  date: string;
  capacity: number;
}

export interface UpdateEventPayload {
  name?: string;
  date?: string;
  capacity?: number;
}

export const eventsApi = {
  async listEvents(): Promise<EventDetail[]> {
    const res = await apiClient.get<ApiSuccessResponse<{ events: EventDetail[] }>>("/events");
    return res.data.data.events;
  },

  async getEventById(eventId: string): Promise<EventDetail> {
    const res = await apiClient.get<ApiSuccessResponse<{ event: EventDetail }>>(`/events/${eventId}`);
    return res.data.data.event;
  },

  async createEvent(payload: CreateEventPayload): Promise<EventDetail> {
    const res = await apiClient.post<ApiSuccessResponse<{ event: EventDetail }>>("/events", payload);
    return res.data.data.event;
  },

  async updateEvent(eventId: string, payload: UpdateEventPayload): Promise<EventDetail> {
    const res = await apiClient.patch<ApiSuccessResponse<{ event: EventDetail }>>(
      `/events/${eventId}`,
      payload
    );
    return res.data.data.event;
  },

  async deleteEvent(eventId: string): Promise<void> {
    await apiClient.delete<ApiSuccessResponse<null>>(`/events/${eventId}`);
  },

  async registerForEvent(
    eventId: string
  ): Promise<{ registration: Registration; ticket: Ticket }> {
    const res = await apiClient.post<
      ApiSuccessResponse<{ registration: Registration; ticket: Ticket }>
    >(`/events/${eventId}/register`);
    return res.data.data;
  },

  async getTicket(eventId: string): Promise<Ticket> {
    const res = await apiClient.get<ApiSuccessResponse<{ ticket: Ticket }>>(
      `/events/${eventId}/ticket`
    );
    return res.data.data.ticket;
  },
};
