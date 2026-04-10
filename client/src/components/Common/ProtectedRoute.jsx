// client/src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { ROUTES } from "../../utils/routes";

const ProtectedRoute = ({ children }) => {
  const stored = sessionStorage.getItem("chat-app-user");
  
  // ✅ FIX: Guard against string "null" or "undefined" that causes infinite loops
  const isAuthenticated = stored && stored !== "null" && stored !== "undefined";

  if (!isAuthenticated) {
    // If not authenticated, redirect to Login
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // If authenticated, render the requested component
  return children;
};

export default ProtectedRoute;