// client/src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { ROUTES } from "../utils/routes";

const ProtectedRoute = ({ children }) => {
  // בדיקה אם המשתמש מחובר. 
  // תוקן: קריאה מ-sessionStorage עם המפתח המדויק
  const isAuthenticated = sessionStorage.getItem("chat-app-user");

  if (!isAuthenticated) {
    // אם לא מחובר, מפנה חזרה ללוגין
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // אם מחובר, מציג את הרכיב המבוקש (הצ'אט)
  return children;
};

export default ProtectedRoute;