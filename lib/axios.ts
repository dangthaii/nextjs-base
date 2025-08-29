import axios from "axios";
import { toast } from "./toast";

export const axiosClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Middleware for request
axiosClient.interceptors.request.use((config) => {
  return config;
});

// Middleware for response
axiosClient.interceptors.response.use(
  (response) => {
    return response;
  },

  async (error) => {
    console.log("error :", error);
    const originalRequest = error.config;
    // handle expired token
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      error.response?.data?.code === "TRY_REFRESH_TOKEN" &&
      !originalRequest._retry
    ) {
      try {
        await axiosClient.post("/auth/refresh");
        return axiosClient(originalRequest);
      } catch (error) {
        window.location.href = "/login";
      }
    }

    toast.error(error.response?.data?.message || error.message);

    throw error;
  }
);
