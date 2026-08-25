import "./dev-mock";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { StandaloneResumePreview } from "./components/StandaloneResumePreview";
import "./style.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element.");
}

const isStandaloneResumePreview = new URLSearchParams(
  window.location.search,
).has("resumePreview");

createRoot(rootElement).render(
  <ErrorBoundary>
    {isStandaloneResumePreview ? <StandaloneResumePreview /> : <App />}
  </ErrorBoundary>,
);
