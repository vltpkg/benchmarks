import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "@/routes";
import "@/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "Root element not found. Make sure there is a div with id='root' in your HTML.",
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
