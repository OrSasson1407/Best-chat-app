// client/src/App.js
import React, { Suspense, lazy, useEffect } from "react"; 
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios"; 
import AppLock from "./components/AppLock";
import PageLoader from "./components/PageLoader";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { ROUTES } from "./utils/routes";


// ✅ ADDED: Inject the specific tab's token into EVERY request header
axios.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("chat-app-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

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

  // --- GLOBAL AXIOS 401 INTERCEPTOR ---
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response, 
      (error) => {
        // If the backend says the token is invalid/expired (401)
        if (error.response && error.response.status === 401) {
          console.warn("Session expired. Logging out this tab globally...");
          
          // 1. Destroy the dead token and user data from this tab
          sessionStorage.removeItem("chat-app-user");
          sessionStorage.removeItem("chat-app-token"); // Ensure token is cleared!
          
          // 2. Force the browser to go to the login screen
          if (window.location.pathname !== ROUTES.LOGIN) {
            window.location.href = ROUTES.LOGIN; 
          }
        }
        return Promise.reject(error);
      }
    );

    // Clean up the interceptor when the app unmounts
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