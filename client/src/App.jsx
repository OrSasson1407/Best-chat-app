import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";

// Updated imports to match the new Common modular folder structure
import AppLock from "./components/Common/AppLock";
import PageLoader from "./components/Common/PageLoader";
import ErrorBoundary from "./components/Common/ErrorBoundary";
import ProtectedRoute from "./components/Common/ProtectedRoute";

import { ROUTES } from "./utils/routes";
import { refreshTokenRoute } from "./utils/APIRoutes";

// =======================================================
// GLOBAL AXIOS CONFIGURATION (Moved entirely outside React)
// =======================================================

// 1. REQUEST INTERCEPTOR
// Attaches the current tab's access token to every request.
axios.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("chat-app-token");
    if (token) {
      const cleanToken = token.replace(/(Bearer\s*)+/gi, "").trim();
      config.headers.Authorization = `Bearer ${cleanToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 2. SILENT REFRESH STATE
let isRefreshing = false;         
let failedQueue = [];             

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
  // FIX: Prevent Incomplete Forced Logout by clearing local storage items (E2E Keys, Drafts)
  const storedUser = sessionStorage.getItem("chat-app-user");
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed._id) {
        localStorage.removeItem(`privateKey_${parsed._id}`);
        localStorage.removeItem(`fullE2EKeys_${parsed._id}`);
      }
    } catch (e) {
      console.error("Failed to parse user for logout cleanup", e);
    }
  }

  // Cleanup any remaining draft or encryption keys from other sessions locally
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('draft_') || key.startsWith('privateKey_') || key.startsWith('fullE2EKeys_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  sessionStorage.removeItem("chat-app-user");
  sessionStorage.removeItem("chat-app-token");
  sessionStorage.removeItem("chat-app-refresh-token");
  
  if (window.location.pathname !== ROUTES.LOGIN) {
    window.location.href = ROUTES.LOGIN;
  }
};

// 3. RESPONSE INTERCEPTOR
// Catches 401s globally. If TOKEN_EXPIRED, silently fetches a new token.
axios.interceptors.response.use(
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

      originalRequest._retry = true; 
      isRefreshing = true;

      const storedRefreshToken = sessionStorage.getItem("chat-app-refresh-token");

      if (!storedRefreshToken) {
        isRefreshing = false;
        forceLogout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          refreshTokenRoute,
          { refreshToken: storedRefreshToken },
          { _retry: true } 
        );

        const newAccessToken = data.token;
        sessionStorage.setItem("chat-app-token", newAccessToken);

        const storedUser = sessionStorage.getItem("chat-app-user");
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          parsed.token = newAccessToken;
          sessionStorage.setItem("chat-app-user", JSON.stringify(parsed));
        }

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axios(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError, null);
        forceLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // --------------------------------------------------
    // Case 2: Any other 401 (revoked, invalid, no token)
    // --------------------------------------------------
    console.warn("Session invalid. Logging out this tab...");
    forceLogout();
    return Promise.reject(error);
  }
);


// =======================================================
// REACT ROUTING & UI
// =======================================================

const Chat = lazy(() => import("./pages/Chat"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

const PublicRoute = ({ children }) => {
  const stored = sessionStorage.getItem("chat-app-user");
  const isAuthenticated = stored && stored !== "null" && stored !== "undefined";
  
  if (isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />;
  }
  return children;
};

export default function App() {
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