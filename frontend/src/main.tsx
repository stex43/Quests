import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

if (import.meta.env.DEV) {
  document.title = `dev - ${document.title}`;
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
