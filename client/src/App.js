// client/src/App.js
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLock from "./components/AppLock";

// --- FRONTEND IMPROVEMENT: LAZY LOADING ---
// By lazy loading these pages, we split the JavaScript bundle. 
// The user downloads the Chat components ONLY when they reach the "/" route, making the app load instantly.
const Chat = lazy(() => import("./pages/Chat"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

// A clean, themed loading spinner to show while the chunk is being downloaded
const PageLoader = () => (
  <div style={{ 
    display: 'flex', justifyContent: 'center', alignItems: 'center', 
    height: '100vh', backgroundColor: '#131324', color: 'white', flexDirection: 'column'
  }}>
    <div className="spinner" style={{
      border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #4e0eff',
      borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite',
      marginBottom: '15px'
    }}></div>
    <h3>Loading App...</h3>
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      {/* Wrap everything in the AppLock shield */}
      <AppLock>
        {/* Suspense catches the lazy-loaded components and displays the fallback while they load */}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Chat />} />
          </Routes>
        </Suspense>
      </AppLock>
    </BrowserRouter>
  );
}