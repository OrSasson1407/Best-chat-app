// 1. ALL IMPORTS GO HERE AT THE VERY TOP
import process from 'process';
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// 2. THEN YOU CAN ASSIGN VARIABLES
window.process = process;

// 3. STANDARD REACT RENDER LOGIC
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);