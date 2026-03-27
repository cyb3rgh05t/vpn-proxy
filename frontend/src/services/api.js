import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthUrl = error.config?.url?.includes("/auth/");
    if (!isAuthUrl) {
      if (
        error.response?.status === 401 ||
        error.response?.status === 403 ||
        (!error.response && localStorage.getItem("token"))
      ) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
