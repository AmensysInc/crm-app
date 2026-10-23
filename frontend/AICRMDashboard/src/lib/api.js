import axios from "axios";

/* Base URL — override with VITE_API_URL in a .env file if needed.
   Defaults to the backend dev server (port 8000). */
const baseURL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const TOKEN_KEY = "xeno_crm_token";

const api = axios.create({ baseURL });

/* Attach the JWT to every request if we have one. */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* Normalise responses & errors so callers get clean data / messages. */
api.interceptors.response.use(
  (res) => res.data,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      error.message ||
      "Something went wrong";

    // Auto-logout on an expired/invalid token (but not on the login screen).
    if (status === 401 && !window.location.pathname.startsWith("/login")) {
      localStorage.removeItem(TOKEN_KEY);
    }

    return Promise.reject({ status, message });
  }
);

export default api;
