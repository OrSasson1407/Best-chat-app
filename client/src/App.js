// client/src/App.js
import React, { Suspense, lazy, useEffect } from "react"; 
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios"; 
import AppLock from "./components/AppLock";
import PageLoader from "./components/PageLoader";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { ROUTES } from "./utils/routes";

// --- NEW: GLOBAL AXIOS CONFIGURATION ---
// Automatically attach secure HttpOnly cookies to EVERY request in the app.
axios.defaults.withCredentials = true;

// --- LAZY LOADING ---
const Chat = lazy(() => import("./pages/Chat"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

// רכיב עזר לנתיבים פתוחים: מונע ממשתמש מחובר לגשת בטעות לעמודי התחברות והרשמה
const PublicRoute = ({ children }) => {
  // תוקן: קריאה מ-sessionStorage עם המפתח המדויק
  const isAuthenticated = sessionStorage.getItem("chat-app-user");
  if (isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />;
  }
  return children;
};

export default function App() {

  // --- NEW: GLOBAL AXIOS 401 INTERCEPTOR ---
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response, 
      (error) => {
        // If the backend says the token is invalid/expired (401)
        if (error.response && error.response.status === 401) {
          console.warn("Session expired. Logging out globally...");
          
          // 1. Destroy the dead token
          sessionStorage.removeItem("chat-app-user");
          
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
      {/* שכבת הגנה כללית של האפליקציה */}
      <AppLock>
        {/* תפיסת שגיאות קריטיות בטעינת הרכיבים */}
        <ErrorBoundary>
          {/* מציג את טעינת העמוד בזמן שהרכיבים יורדים ברקע */}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              
              <Route 
                path={ROUTES.REGISTER} 
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                } 
              />
              
              <Route 
                path={ROUTES.LOGIN} 
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } 
              />
              
              <Route 
                path={ROUTES.HOME} 
                element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                } 
              />
              
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppLock>
    </BrowserRouter>
  );
}