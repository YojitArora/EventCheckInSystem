import axios, { AxiosError } from "axios";
import { ApiErrorResponse } from "../types";

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== "undefined" && window.location?.hostname) {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      return `${protocol}//${hostname}:5050/api`;
    }
  }
  return "http://localhost:5050/api";
};

export const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: Attach JWT token if available
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("eventpass_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Standardize error format and handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401) {
      // Clear token if invalid/expired, unless we are attempting to login/register
      const isAuthPath = error.config?.url?.includes("/auth/login") || error.config?.url?.includes("/auth/register");
      if (!isAuthPath) {
        localStorage.removeItem("eventpass_token");
        localStorage.removeItem("eventpass_user");
        // Dispatch custom event so context can react immediately without full reload
        window.dispatchEvent(new Event("eventpass_unauthorized"));
      }
    }

    const customError = error.response?.data?.error;
    const message = customError?.message || error.message || "An unexpected error occurred";
    const code = customError?.code || "UNKNOWN_ERROR";

    return Promise.reject({
      status: error.response?.status,
      code,
      message,
      details: customError?.details,
    });
  }
);
