// client/src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AppLock from "./components/AppLock"; // <-- IMPORT APPLOCK

export default function App() {
  return (
    <BrowserRouter>
      {/* Wrap everything in the AppLock shield */}
      <AppLock>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Chat />} />
        </Routes>
      </AppLock>
    </BrowserRouter>
  );
}