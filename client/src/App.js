// client/src/App.js
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLock from "./components/AppLock";
import PageLoader from "./components/PageLoader";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { ROUTES } from "./utils/routes";

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