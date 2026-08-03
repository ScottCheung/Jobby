const ACTION_SELECTOR = "button, input[type='button'], input[type='submit'], [role='button']";
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function isVisible(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}
function isEnabled(element) {
  return !element.matches(":disabled") && element.getAttribute("aria-disabled") !== "true";
}
function labelFor(element) {
  return cleanText(
    element.getAttribute("aria-label") || element.getAttribute("value") || element.textContent
  );
}
function matchesAction(label, action) {
  if (action === "previous") return /(?:back|previous|返回|上一步)/i.test(label);
  if (action === "submit") return /(?:submit|apply|send|finish|提交|申请|发送|完成)/i.test(label);
  return /(?:continue|next|review|proceed|继续|下一步|审核)/i.test(label) && !/(?:submit|apply|send|finish|提交|申请|发送|完成)/i.test(label);
}
export function getSeekApplicationAction(action) {
  return Array.from(document.querySelectorAll(ACTION_SELECTOR)).find(
    (element) => isVisible(element) && isEnabled(element) && matchesAction(labelFor(element), action)
  ) || null;
}
export function getSeekApplicationActionLabel() {
  const action = getSeekApplicationAction("submit") || getSeekApplicationAction("next") || getSeekApplicationAction("previous");
  return action ? labelFor(action) || void 0 : void 0;
}
export function getSeekApplicationActionKind() {
  if (getSeekApplicationAction("submit")) return "submit";
  if (getSeekApplicationAction("next")) return "next";
  return void 0;
}
export async function clickSeekApplicationAction(action) {
  const button = getSeekApplicationAction(action);
  if (!button) {
    return {
      status: "unavailable",
      message: action === "previous" ? "The SEEK Back action is not available." : action === "next" ? "The SEEK Continue action is not available." : "The SEEK submit action is not available.",
      url: window.location.href
    };
  }
  const actionLabel = labelFor(button) || void 0;
  button.scrollIntoView({ block: "center", inline: "nearest" });
  button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
  button.click();
  return {
    status: "clicked",
    message: action === "previous" ? "SEEK application moved to the previous step." : action === "next" ? "SEEK application continued to the next step." : "SEEK application submitted.",
    url: window.location.href,
    ...actionLabel ? { actionLabel } : {}
  };
}
