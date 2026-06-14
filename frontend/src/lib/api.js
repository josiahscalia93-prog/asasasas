import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true,
});

// --- Auto token refresh on 401 -------------------------------------------
// When the short-lived access token expires, transparently refresh it using
// the long-lived refresh cookie and retry the original request once.
let refreshPromise = null;
const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/me"];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || "";
    const skip = NO_REFRESH.some((p) => url.includes(p));

    if (status === 401 && original && !original._retry && !skip) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = api.post("/auth/refresh").finally(() => { refreshPromise = null; });
        }
        await refreshPromise;
        return api(original); // retry with fresh cookie
      } catch (e) {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
