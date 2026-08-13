const BALL_CONTAINER_ID = "jobby-floating-ball-root";
const IFRAME_CONTAINER_ID = "jobby-in-page-sidepanel-root";
const DISMISS_KEY = "jobby-floating-ball-dismissed";
const DISABLED_DOMAINS_KEY = "jobby_disabled_domains";
const DISABLE_ALL_PAGES_KEY = "jobby_disabled_all_pages";
const PANEL_WIDTH = 380;
let panelState = "idle";
let ballRoot = null;
let iframeRoot = null;
let disabledDomains = [];
let disableAllPages = false;
let currentDocumentClickHandler = null;
const likelyPopup = window.opener !== null;
let windowCanHostSidepanel = !likelyPopup;
let openRequestPending = false;
let currentThemeMode = "system";
function updateThemeClasses() {
  const isDark = currentThemeMode === "dark" || currentThemeMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (iframeRoot) {
    if (isDark) iframeRoot.classList.add("dark");
    else iframeRoot.classList.remove("dark");
  }
  if (ballRoot) {
    if (isDark) ballRoot.classList.add("dark");
    else ballRoot.classList.remove("dark");
  }
}
let _savedBodyMarginRight = null;
function pushBodyRight() {
  if (_savedBodyMarginRight !== null) return;
  _savedBodyMarginRight = document.body.style.marginRight;
  document.body.style.transition = "margin-right 1s cubic-bezier(0.4, 0, 0.2, 1)";
  document.body.style.marginRight = `${PANEL_WIDTH}px`;
}
function restoreBodyRight() {
  if (_savedBodyMarginRight === null) return;
  document.body.style.transition = "margin-right 1s cubic-bezier(0.4, 0, 0.2, 1)";
  document.body.style.marginRight = _savedBodyMarginRight;
  _savedBodyMarginRight = null;
  setTimeout(() => {
    if (_savedBodyMarginRight === null) {
      document.body.style.transition = "";
    }
  }, 320);
}
const POSITION_KEY = "jobby-floating-ball-position";
function getSavedBallPosition() {
  try {
    const data = sessionStorage.getItem(POSITION_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if ((parsed.edge === "left" || parsed.edge === "right") && typeof parsed.top === "number" && !isNaN(parsed.top) && isFinite(parsed.top)) {
        return parsed;
      }
    }
  } catch (e) {
  }
  const vh = window.innerHeight > 0 ? window.innerHeight : 800;
  return {
    edge: "right",
    top: Math.max(20, vh - 80 - 60)
  };
}
function saveBallPosition(pos) {
  try {
    sessionStorage.setItem(POSITION_KEY, JSON.stringify(pos));
  } catch (e) {
  }
}
function isDismissed() {
  return sessionStorage.getItem(DISMISS_KEY) === "true";
}
function isDomainDisabled() {
  if (!disabledDomains || !disabledDomains.length) return false;
  const currentHost = window.location.hostname.toLowerCase();
  return disabledDomains.some((domain) => {
    const d = domain.toLowerCase();
    return currentHost === d || currentHost.endsWith("." + d);
  });
}
function shouldShowBall() {
  if (isDismissed()) return false;
  if (disableAllPages) return false;
  if (isDomainDisabled()) return false;
  return panelState === "idle";
}
function updateBallVisibility() {
  if (shouldShowBall()) {
    createFloatingBall();
  } else {
    removeFloatingBall();
  }
}
function removeFloatingBall() {
  if (currentDocumentClickHandler) {
    window.removeEventListener("click", currentDocumentClickHandler, true);
    currentDocumentClickHandler = null;
  }
  if (ballRoot) {
    ballRoot.remove();
    ballRoot = null;
  }
  const existing = document.getElementById(BALL_CONTAINER_ID);
  if (existing) {
    existing.remove();
  }
}
function createFloatingBall() {
  if (ballRoot) return;
  const existing = document.getElementById(BALL_CONTAINER_ID);
  if (existing) {
    existing.remove();
  }
  ballRoot = document.createElement("div");
  ballRoot.id = BALL_CONTAINER_ID;
  updateThemeClasses();
  const shadow = ballRoot.attachShadow({ mode: "open" });
  const logoUrl = chrome.runtime.getURL("favicon.svg");
  const SIZE = 60;
  const EDGE_MARGIN = 20;
  const DRAG_THRESHOLD = 6;
  const initialPos = getSavedBallPosition();
  const vh = window.innerHeight > 0 ? window.innerHeight : 800;
  const boundedTop = Math.max(
    EDGE_MARGIN,
    Math.min(vh - SIZE - EDGE_MARGIN, initialPos.top)
  );
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
    }
    #jobby-ball-wrapper {
      position: fixed;
      ${initialPos.edge === "right" ? `right: ${EDGE_MARGIN}px; left: auto;` : `left: ${EDGE_MARGIN}px; right: auto;`}
      top: ${boundedTop}px;
      width: ${SIZE}px;
      height: ${SIZE}px;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      border-radius: 9999px;
      background: transparent;
      box-sizing: border-box;
      /* Transition for snap animation (disabled during drag) */
      transition: filter 0.2s ease, transform 0.2s ease, left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), right 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      user-select: none;
      -webkit-user-drag: none;
    }
    #jobby-ball-wrapper.is-dragging {
      cursor: grabbing;
      transition: none;
    }
    #jobby-ball-wrapper:not(.is-dragging):hover .jobby-logo-img {
      filter: drop-shadow(0 0 10px rgba(20, 184, 166, 0.85)) drop-shadow(0 2px 10px rgba(0, 0, 0, 0.3));
      transform: scale(1.12);
    }
    #jobby-ball-wrapper:not(.is-dragging):active .jobby-logo-img {
      transform: scale(0.92);
    }
    .jobby-logo-img {
      width: 85%;
      height: 85%;
      object-fit: contain;
      user-select: none;
      pointer-events: none;
      filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.25));
      transition: filter 0.2s ease, transform 0.2s ease;
      -webkit-user-drag: none;
    }
    #close-btn {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 20px;
      height: 20px;
      border-radius: 9999px;
      background: rgba(15, 23, 42, 0.85);
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 11px;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease, background 0.2s ease;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      padding: 0;
      line-height: 1;
      z-index: 2;
    }
    #jobby-ball-wrapper:hover #close-btn,
    #jobby-ball-wrapper.menu-open #close-btn {
      opacity: 1;
    }
    #close-btn:hover {
      background: #dc2626;
    }
    /* Dismiss Menu Popover */
    #jobby-dismiss-menu {
      position: absolute;
      background: #ffffff;
      color: #0f172a;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      z-index: 2147483647;
      min-width: 195px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
    }
    :host(.dark) #jobby-dismiss-menu {
      background: #1e293b;
      color: #f8fafc;
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    #jobby-ball-wrapper.edge-right #jobby-dismiss-menu {
      right: calc(100% + 10px);
      left: auto;
      top: 50%;
      transform: translateY(-50%) scale(0.92);
      transform-origin: right center;
    }
    #jobby-ball-wrapper.edge-right #jobby-dismiss-menu.is-open {
      opacity: 1;
      transform: translateY(-50%) scale(1);
      pointer-events: auto;
    }
    #jobby-ball-wrapper.edge-left #jobby-dismiss-menu {
      left: calc(100% + 10px);
      right: auto;
      top: 50%;
      transform: translateY(-50%) scale(0.92);
      transform-origin: left center;
    }
    #jobby-ball-wrapper.edge-left #jobby-dismiss-menu.is-open {
      opacity: 1;
      transform: translateY(-50%) scale(1);
      pointer-events: auto;
    }
    .jobby-menu-item {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 9px 12px;
      border: none;
      background: transparent;
      color: inherit;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      font-size: 13.5px;
      font-weight: 500;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      transition: background 0.12s ease;
      box-sizing: border-box;
      user-select: none;
    }
    .jobby-menu-item:hover {
      background: rgba(15, 23, 42, 0.06);
    }
    :host(.dark) .jobby-menu-item:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .jobby-menu-item:active {
      background: rgba(15, 23, 42, 0.12);
    }
  `;
  const wrapper = document.createElement("div");
  wrapper.id = "jobby-ball-wrapper";
  wrapper.classList.add(initialPos.edge === "right" ? "edge-right" : "edge-left");
  const logo = document.createElement("img");
  logo.src = logoUrl;
  logo.className = "jobby-logo-img";
  logo.alt = "Jobby logo";
  logo.draggable = false;
  const closeBtn = document.createElement("button");
  closeBtn.id = "close-btn";
  closeBtn.innerHTML = "&#10005;";
  closeBtn.title = "Close options";
  const dismissMenu = document.createElement("div");
  dismissMenu.id = "jobby-dismiss-menu";
  const handleDismissAction = (action) => {
    dismissMenu.classList.remove("is-open");
    wrapper.classList.remove("menu-open");
    if (action === "session") {
      sessionStorage.setItem(DISMISS_KEY, "true");
      removeFloatingBall();
    } else if (action === "domain") {
      const host = window.location.hostname;
      if (host) {
        chrome.storage.local.get([DISABLED_DOMAINS_KEY], (res) => {
          const list = Array.isArray(res[DISABLED_DOMAINS_KEY]) ? res[DISABLED_DOMAINS_KEY] : [];
          if (!list.includes(host)) {
            list.push(host);
            chrome.storage.local.set({ [DISABLED_DOMAINS_KEY]: list }, () => {
              disabledDomains = list;
              removeFloatingBall();
            });
          } else {
            removeFloatingBall();
          }
        });
      } else {
        removeFloatingBall();
      }
    } else if (action === "all") {
      chrome.storage.local.set({ [DISABLE_ALL_PAGES_KEY]: true }, () => {
        disableAllPages = true;
        removeFloatingBall();
      });
    }
  };
  const options = [
    { label: "Hide until next visit", action: "session" },
    { label: "Disable on this domain", action: "domain" },
    { label: "Disable on all pages", action: "all" }
  ];
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "jobby-menu-item";
    btn.textContent = opt.label;
    btn.type = "button";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      handleDismissAction(opt.action);
    });
    dismissMenu.appendChild(btn);
  });
  const toggleDismissMenu = () => {
    const isOpen = dismissMenu.classList.contains("is-open");
    if (isOpen) {
      dismissMenu.classList.remove("is-open");
      wrapper.classList.remove("menu-open");
    } else {
      dismissMenu.classList.add("is-open");
      wrapper.classList.add("menu-open");
    }
  };
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleDismissMenu();
  });
  currentDocumentClickHandler = (e) => {
    if (!dismissMenu.classList.contains("is-open")) return;
    const path = e.composedPath();
    if (!path.includes(dismissMenu) && !path.includes(closeBtn)) {
      dismissMenu.classList.remove("is-open");
      wrapper.classList.remove("menu-open");
    }
  };
  window.addEventListener("click", currentDocumentClickHandler, true);
  wrapper.appendChild(logo);
  wrapper.appendChild(closeBtn);
  wrapper.appendChild(dismissMenu);
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startLeft = 0;
  let startTop = 0;
  let currentEdge = initialPos.edge;
  let snapTimer = null;
  let posLeft = 0;
  let posTop = boundedTop;
  function snapToEdge() {
    if (snapTimer) clearTimeout(snapTimer);
    const viewportWidth = document.documentElement.clientWidth;
    const mid = viewportWidth / 2;
    posTop = Math.max(
      EDGE_MARGIN,
      Math.min(window.innerHeight - SIZE - EDGE_MARGIN, posTop)
    );
    if (posLeft + SIZE / 2 > mid) {
      currentEdge = "right";
      wrapper.classList.add("edge-right");
      wrapper.classList.remove("edge-left");
      const targetLeft = viewportWidth - SIZE - EDGE_MARGIN;
      wrapper.style.left = `${targetLeft}px`;
      wrapper.style.top = `${posTop}px`;
      snapTimer = window.setTimeout(() => {
        if (currentEdge === "right" && !isDragging) {
          wrapper.style.left = "auto";
          wrapper.style.right = `${EDGE_MARGIN}px`;
        }
      }, 260);
    } else {
      currentEdge = "left";
      wrapper.classList.add("edge-left");
      wrapper.classList.remove("edge-right");
      wrapper.style.left = `${EDGE_MARGIN}px`;
      wrapper.style.right = "auto";
      wrapper.style.top = `${posTop}px`;
    }
    saveBallPosition({ edge: currentEdge, top: posTop });
  }
  const handleWindowResize = () => {
    if (isDragging) return;
    if (currentEdge === "right") {
      wrapper.style.left = "auto";
      wrapper.style.right = `${EDGE_MARGIN}px`;
    } else {
      wrapper.style.left = `${EDGE_MARGIN}px`;
      wrapper.style.right = "auto";
    }
    posTop = Math.max(
      EDGE_MARGIN,
      Math.min(window.innerHeight - SIZE - EDGE_MARGIN, posTop)
    );
    wrapper.style.top = `${posTop}px`;
    saveBallPosition({ edge: currentEdge, top: posTop });
  };
  window.addEventListener("resize", handleWindowResize);
  wrapper.addEventListener("pointerdown", (e) => {
    if (e.target.id === "close-btn" || e.target.classList.contains("jobby-menu-item")) return;
    dismissMenu.classList.remove("is-open");
    wrapper.classList.remove("menu-open");
    if (snapTimer) clearTimeout(snapTimer);
    isDragging = false;
    const rect = wrapper.getBoundingClientRect();
    posLeft = rect.left;
    posTop = rect.top;
    wrapper.style.right = "auto";
    wrapper.style.left = `${posLeft}px`;
    wrapper.style.top = `${posTop}px`;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startLeft = posLeft;
    startTop = posTop;
    wrapper.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  wrapper.addEventListener("pointermove", (e) => {
    if (!wrapper.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (!isDragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      isDragging = true;
      wrapper.classList.add("is-dragging");
    }
    if (isDragging) {
      const viewportWidth = document.documentElement.clientWidth;
      posLeft = Math.max(
        EDGE_MARGIN,
        Math.min(viewportWidth - SIZE - EDGE_MARGIN, startLeft + dx)
      );
      posTop = Math.max(
        EDGE_MARGIN,
        Math.min(window.innerHeight - SIZE - EDGE_MARGIN, startTop + dy)
      );
      wrapper.style.left = `${posLeft}px`;
      wrapper.style.top = `${posTop}px`;
    }
  });
  wrapper.addEventListener("pointerup", (e) => {
    if (!wrapper.hasPointerCapture(e.pointerId)) return;
    wrapper.releasePointerCapture(e.pointerId);
    if (isDragging) {
      wrapper.classList.remove("is-dragging");
      isDragging = false;
      requestAnimationFrame(() => snapToEdge());
    } else {
      handleBallClick();
    }
  });
  shadow.appendChild(style);
  shadow.appendChild(wrapper);
  document.body.insertBefore(ballRoot, document.body.firstChild);
}
function handleBallClick() {
  if (panelState !== "idle") return;
  if (!windowCanHostSidepanel) {
    showSidepanelIframe();
    return;
  }
  if (openRequestPending) return;
  openRequestPending = true;
  const fallbackTimer = window.setTimeout(() => {
    openRequestPending = false;
    if (panelState === "idle") {
      showSidepanelIframe();
    }
  }, 600);
  chrome.runtime.sendMessage({ type: "sidepanel.open" }, (response) => {
    openRequestPending = false;
    window.clearTimeout(fallbackTimer);
    if (chrome.runtime.lastError || response?.ok === false) {
      if (panelState === "idle") {
        showSidepanelIframe();
      }
    }
  });
}
function preloadSidepanelIframe() {
  if (iframeRoot || document.getElementById(IFRAME_CONTAINER_ID)) return;
  iframeRoot = document.createElement("div");
  iframeRoot.id = IFRAME_CONTAINER_ID;
  const shadow = iframeRoot.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host {
      --panel-bg: #f8fafc;
      --tab-x: #94a3b8;
      --tab-x-hover: #334155;
      --tab-x-bg-hover: rgba(15, 23, 42, 0.08);
      --tab-x-bg-active: rgba(15, 23, 42, 0.16);
    }
    :host(.dark) {
      --panel-bg: #0f172a;
      --tab-x: #64748b;
      --tab-x-hover: #f1f5f9;
      --tab-x-bg-hover: rgba(255, 255, 255, 0.12);
      --tab-x-bg-active: rgba(255, 255, 255, 0.22);
    }
    #jobby-iframe-wrapper {
      position: fixed;
      right: 0;
      top: 0;
      width: ${PANEL_WIDTH}px;
      height: 100vh;
      z-index: 2147483647;
      box-shadow: -4px 0 16px rgba(0, 0, 0, 0.15);
      border: none;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      /* Off-screen by default — React loads silently here */
      transform: translateX(100%);
      background-color: var(--panel-bg);
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      flex: 1;
      background-color: transparent;
    }
    #close-tab {
      position: absolute;
      left: -80px;
      top: 50%;
      transform: translateY(-50%);
      width: 80px;
      height: 120px;
      visibility: hidden;
      cursor: pointer;
      display: block;
      background: none;
      border: none;
      padding: 0;
      /* Clip shadow bleed on the right edge so it seamlessly joins the iframe container */
      clip-path: inset(-30px 0px -30px -40px);
    }
    #jobby-iframe-wrapper.is-visible #close-tab {
      visibility: visible;
    }
    #close-tab svg {
      display: block;
      width: 100%;
      height: 100%;
      filter: drop-shadow(-4px 0 12px rgba(0, 0, 0, 0.15));
    }
    #close-tab .tab-logo {
      opacity: 1;
      transform-origin: 48px 60px;
      transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #close-tab:hover .tab-logo {
      opacity: 0;
      transform: scale(0.75);
    }
    #close-tab .tab-x-group {
      opacity: 0;
      transform-origin: 48px 60px;
      transform: scale(0.75);
      transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #close-tab:hover .tab-x-group {
      opacity: 1;
      transform: scale(1);
    }
    #close-tab .tab-x-bg {
      fill: var(--tab-x-bg-hover);
    }
    #close-tab:active .tab-x-bg {
      fill: var(--tab-x-bg-active);
    }
    #close-tab .tab-x-line {
      stroke: var(--tab-x-hover);
    }
  `;
  const wrapper = document.createElement("div");
  wrapper.id = "jobby-iframe-wrapper";
  const logoUrl = chrome.runtime.getURL("favicon.svg");
  const closeTab = document.createElement("button");
  closeTab.id = "close-tab";
  closeTab.title = "Close Jobby Panel";
  closeTab.setAttribute("aria-label", "Close Jobby Panel");
  closeTab.innerHTML = `
<svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path style="fill: var(--panel-bg);" d="
    M 80 0
    C 80 14, 66 28, 52 28
    L 40 28
    A 24 24 0 0 0 16 52
    L 16 68
    A 24 24 0 0 0 40 92
    L 52 92
    C 66 92, 80 106, 80 120
    L 80 0
    Z
  " />

  <image
    class="tab-logo"
    href="${logoUrl}"
    x="28"
    y="40"
    width="40"
    height="40"
  />

  <g class="tab-x-group">
    <rect
      class="tab-x-bg"
      x="24"
      y="36"
      width="48"
      height="48"
      rx="16"
    />
    <line x1="37" y1="49" x2="59" y2="71" stroke-width="4.5" stroke-linecap="round" class="tab-x-line" />
    <line x1="59" y1="49" x2="37" y2="71" stroke-width="4.5" stroke-linecap="round" class="tab-x-line" />
  </g>
</svg>
  `;
  closeTab.addEventListener("click", hideSidepanelIframe);
  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("src/sidepanel/index.html");
  wrapper.appendChild(closeTab);
  wrapper.appendChild(iframe);
  shadow.appendChild(style);
  shadow.appendChild(wrapper);
  document.body.insertBefore(iframeRoot, document.body.firstChild);
  updateThemeClasses();
}
function showSidepanelIframe() {
  if (panelState === "iframe") return;
  if (!iframeRoot) {
    preloadSidepanelIframe();
  }
  const wrapper = iframeRoot.shadowRoot.getElementById(
    "jobby-iframe-wrapper"
  );
  if (!wrapper) return;
  panelState = "iframe";
  removeFloatingBall();
  pushBodyRight();
  requestAnimationFrame(() => {
    wrapper.classList.add("is-visible");
    wrapper.style.transform = "translateX(0)";
  });
}
function hideSidepanelIframe() {
  if (!iframeRoot || panelState !== "iframe") return;
  const wrapper = iframeRoot.shadowRoot?.getElementById("jobby-iframe-wrapper");
  if (!wrapper) return;
  panelState = "idle";
  wrapper.classList.remove("is-visible");
  wrapper.style.transform = "translateX(100%)";
  restoreBodyRight();
  updateBallVisibility();
}
function removeSidepanelIframe() {
  if (!iframeRoot) return;
  const wrapper = iframeRoot.shadowRoot?.getElementById("jobby-iframe-wrapper");
  const cleanup = () => {
    iframeRoot?.remove();
    iframeRoot = null;
    restoreBodyRight();
    updateBallVisibility();
  };
  if (wrapper && panelState === "iframe") {
    wrapper.classList.remove("is-visible");
    wrapper.style.transform = "translateX(100%)";
    wrapper.addEventListener("transitionend", cleanup, { once: true });
  } else {
    cleanup();
  }
}
export function initializeFloatingBall() {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.onMessage)
    return;
  chrome.storage.local.get(
    ["auto-job-ui-theme", DISABLED_DOMAINS_KEY, DISABLE_ALL_PAGES_KEY],
    (res) => {
      if (res["auto-job-ui-theme"]) {
        currentThemeMode = res["auto-job-ui-theme"];
      }
      if (Array.isArray(res[DISABLED_DOMAINS_KEY])) {
        disabledDomains = res[DISABLED_DOMAINS_KEY];
      }
      if (typeof res[DISABLE_ALL_PAGES_KEY] === "boolean") {
        disableAllPages = res[DISABLE_ALL_PAGES_KEY];
      }
      updateThemeClasses();
      updateBallVisibility();
    }
  );
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      let stateChanged = false;
      if (changes["auto-job-ui-theme"]) {
        currentThemeMode = changes["auto-job-ui-theme"].newValue;
        updateThemeClasses();
      }
      if (changes[DISABLED_DOMAINS_KEY]) {
        disabledDomains = Array.isArray(changes[DISABLED_DOMAINS_KEY].newValue) ? changes[DISABLED_DOMAINS_KEY].newValue : [];
        stateChanged = true;
      }
      if (changes[DISABLE_ALL_PAGES_KEY] !== void 0) {
        disableAllPages = !!changes[DISABLE_ALL_PAGES_KEY].newValue;
        stateChanged = true;
      }
      if (stateChanged) {
        updateBallVisibility();
      }
    }
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (currentThemeMode === "system") {
      updateThemeClasses();
    }
  });
  updateBallVisibility();
  if (likelyPopup) {
    preloadSidepanelIframe();
  }
  chrome.runtime.sendMessage({ type: "sidepanel.query-state" }, (response) => {
    if (response?.ok) {
      if (typeof response.canHostSidepanel === "boolean") {
        windowCanHostSidepanel = response.canHostSidepanel;
      }
      if (windowCanHostSidepanel) {
        panelState = response.isOpen ? "native" : "idle";
      } else {
        panelState = "idle";
        if (!iframeRoot) preloadSidepanelIframe();
      }
      updateBallVisibility();
    }
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "sidepanel.state-changed") return;
    if (!windowCanHostSidepanel) return;
    if (message.isOpen) {
      openRequestPending = false;
      if (panelState === "iframe") {
        removeSidepanelIframe();
      }
      panelState = "native";
      updateBallVisibility();
    } else {
      panelState = "idle";
      updateBallVisibility();
    }
  });
}
