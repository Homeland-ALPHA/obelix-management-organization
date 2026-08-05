import axios from "axios";

const TOKEN_KEY = "obelix_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Unset/empty means same-origin — the Cloudflare Worker serves both this app
// and /api. Point it elsewhere for split deployments or local dev servers.
const BASE = process.env.REACT_APP_BACKEND_URL || "";

export const api = axios.create({ baseURL: `${BASE}/api` });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && getToken()) {
      clearToken();
      if (!window.location.pathname.startsWith("/signin")) {
        window.location.assign("/signin");
      }
    }
    return Promise.reject(err);
  },
);

export const apiError = (err, fallback = "Something went wrong") => {
  const d = err?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  return err?.message || fallback;
};
