// client/src/App.js
import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import AppLock from "./components/AppLock";
import PageLoader from "./components/PageLoader";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { ROUTES } from "./utils/routes";
import { refreshTokenRoute } from "./utils/APIRoutes"; // ✅ FIX: import the refresh endpoint

// =======================================================
// REQUEST INTERCEPTOR
// Attaches the current tab's access token to every request.
// =======================================================
axios.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("chat-app-token");
    if (token) {
      // Strip any accidental "Bearer Bearer ..." duplication saved in storage
      const cleanToken = token.replace(/(Bearer\s*)+/gi, "").trim();
      config.headers.Authorization = `Bearer ${cleanToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// =======================================================
// SILENT REFRESH HELPER
// Called once when a 401 TOKEN_EXPIRED is detected.
// Exchanges the refresh token for a new access token,
// saves it, and returns it so the interceptor can retry.
// Returns null if refresh fails (forces logout).
// =======================================================
let isRefreshing = false;         // prevents multiple simultaneous refresh calls
let failedQueue = [];             // queues requests that arrive while refresh is in flight

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const forceLogout = () => {
  sessionStorage.removeItem("chat-app-user");
  sessionStorage.removeItem("chat-app-token");
  sessionStorage.removeItem("chat-app-refresh-token");
  if (window.location.pathname !== ROUTES.LOGIN) {
    window.location.href = ROUTES.LOGIN;
  }
};

// --- LAZY LOADING ---
const Chat = lazy(() => import("./pages/Chat"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

const PublicRoute = ({ children }) => {
  const isAuthenticated = sessionStorage.getItem("chat-app-user");
  if (isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />;
  }
  return children;
};

export default function App() {

  // =======================================================
  // RESPONSE INTERCEPTOR
  // Catches 401s. If the backend says TOKEN_EXPIRED, it
  // silently fetches a new access token using the refresh
  // token and retries the original request automatically.
  // Any other 401 (bad token, revoked, etc.) → logout.
  // =======================================================
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (!error.response || error.response.status !== 401) {
          return Promise.reject(error);
        }

        const errorCode = error.response.data?.code;

        // --------------------------------------------------
        // Case 1: Token expired → attempt silent refresh
        // --------------------------------------------------
        if (errorCode === "TOKEN_EXPIRED" && !originalRequest._retry) {
          // If a refresh is already in flight, queue this request
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((newToken) => {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return axios(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true; // mark so we don't loop
          isRefreshing = true;

          const storedRefreshToken = sessionStorage.getItem("chat-app-refresh-token");

          if (!storedRefreshToken) {
            // No refresh token saved → can't recover, logout
            isRefreshing = false;
            forceLogout();
            return Promise.reject(error);
          }

          try {
            const { data } = await axios.post(
              refreshTokenRoute,
              { refreshToken: storedRefreshToken },
              { _retry: true } // prevent this refresh call itself from being intercepted
            );

            const newAccessToken = data.token;

            // Save new access token for this tab
            sessionStorage.setItem("chat-app-token", newAccessToken);

            // Also update the token inside the stored user object
            const storedUser = sessionStorage.getItem("chat-app-user");
            if (storedUser) {
              const parsed = JSON.parse(storedUser);
              parsed.token = newAccessToken;
              sessionStorage.setItem("chat-app-user", JSON.stringify(parsed));
            }

            // Flush the queue with the new token
            processQueue(null, newAccessToken);

            // Retry the original request with the new token
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return axios(originalRequest);

          } catch (refreshError) {
            // Refresh token itself is expired or invalid → logout
            processQueue(refreshError, null);
            forceLogout();
            return Promise.reject(refreshError);
          } finally {
            isRefreshing = false;
          }
        }

        // --------------------------------------------------
        // Case 2: Any other 401 (revoked, invalid, no token)
        // → hard logout, no retry
        // --------------------------------------------------
        console.warn("Session invalid. Logging out this tab...");
        forceLogout();
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  return (
    <BrowserRouter>
      <AppLock>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path={ROUTES.REGISTER} element={<PublicRoute><Register /></PublicRoute>} />
              <Route path={ROUTES.LOGIN} element={<PublicRoute><Login /></PublicRoute>} />
              <Route path={ROUTES.HOME} element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppLock>
    </BrowserRouter>
  );
}