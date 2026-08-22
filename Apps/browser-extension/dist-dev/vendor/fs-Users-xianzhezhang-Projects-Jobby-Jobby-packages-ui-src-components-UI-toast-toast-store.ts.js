import __vite__cjsImport0_react from "/vendor/.vite-deps-react.js__v--f5b0ea50.js"; const React = ((m) => m?.__esModule ? m : { ...typeof m === "object" && !Array.isArray(m) || typeof m === "function" ? m : {}, default: m })(__vite__cjsImport0_react);
let activeToast = null;
const listeners = /* @__PURE__ */ new Set();
function notifyListeners() {
  listeners.forEach((listener) => listener());
}
export function showToast(toast) {
  const item = typeof toast === "string" ? {
    id: Math.random().toString(36).substring(7),
    type: "info",
    message: toast,
    duration: 1200
  } : {
    id: Math.random().toString(36).substring(7),
    type: toast.type || "info",
    message: toast.message,
    title: toast.title,
    duration: toast.duration ?? 1200
  };
  activeToast = item;
  notifyListeners();
}
export function removeToast(id) {
  if (!id || activeToast?.id === id) {
    activeToast = null;
    notifyListeners();
  }
}
export function useToast() {
  return React.useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => activeToast,
    () => null
  );
}
export function showGlobalToast(message, duration = 1200) {
  showToast({ type: "info", message, duration });
}
export const notify = {
  success: (message, title, duration = 1200) => showToast({ type: "success", message, title, duration }),
  error: (message, title, duration = 1800) => showToast({ type: "error", message, title, duration }),
  info: (message, title, duration = 1200) => showToast({ type: "info", message, title, duration }),
  warning: (message, title, duration = 1500) => showToast({ type: "warning", message, title, duration })
};
