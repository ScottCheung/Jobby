import "./dev-mock";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { StandaloneResumePreview } from "./components/StandaloneResumePreview";
import { FloatingJobCardDialog } from "./components/FloatingJobCardDialog";
import "./style.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element.");
}

const searchParams = new URLSearchParams(window.location.search);
const isStandaloneResumePreview = searchParams.has("resumePreview");
const isFloatingDialog = searchParams.has("floatingDialog");

createRoot(rootElement).render(
  <ErrorBoundary>
    {isStandaloneResumePreview ? (
      <StandaloneResumePreview />
    ) : isFloatingDialog ? (
      <FloatingJobCardDialog />
    ) : (
      <App />
    )}
  </ErrorBoundary>,
);
