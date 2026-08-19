import { apiClient } from "./axios";
import { AIInsightResponse, ApiSuccessResponse } from "../types";

export interface AIInsightPayload {
  eventId: string;
  question: string;
}

export const aiApi = {
  async getInsights(payload: AIInsightPayload): Promise<AIInsightResponse> {
    const res = await apiClient.post<ApiSuccessResponse<AIInsightResponse>>(
      "/ai/insights",
      payload
    );
    return res.data.data;
  },
};
