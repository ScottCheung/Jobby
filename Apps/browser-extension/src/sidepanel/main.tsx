import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import "./style.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element.");
}

createRoot(rootElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
