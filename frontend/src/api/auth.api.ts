import { apiClient } from "./axios";
import { ApiSuccessResponse, AuthResponseData, Role, User } from "../types";

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role?: Role;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  async register(data: RegisterPayload): Promise<AuthResponseData> {
    const res = await apiClient.post<ApiSuccessResponse<AuthResponseData>>("/auth/register", data);
    return res.data.data;
  },

  async login(data: LoginPayload): Promise<AuthResponseData> {
    const res = await apiClient.post<ApiSuccessResponse<AuthResponseData>>("/auth/login", data);
    return res.data.data;
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get<ApiSuccessResponse<{ user: User }>>("/auth/me");
    return res.data.data.user;
  },
};
