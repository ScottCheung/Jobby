/** @format */

(function () {
  'use strict';

  var rootId = 'linkedin-bot-status-root';
  var styleId = 'linkedin-bot-status-style';
  var storageKey = 'linkedin-bot-status-layout-v1';
  var widgetVersion = '__LINKEDIN_STATUS_WIDGET_VERSION__';
  var maxHistory = 150;
  var dockOffset = 18;
  var dragState = null;
  var layoutRaf = 0;

  function statusClass(text) {
    var value = String(text || '').toLowerCase();
    if (
      value.indexOf('wait') >= 0 ||
      value.indexOf('sleep') >= 0 ||
      value.indexOf('pause') >= 0 ||
      value.indexOf('delay') >= 0
    ) {
      return 'waiting';
    }
    if (
      value.indexOf('fail') >= 0 ||
      value.indexOf('error') >= 0 ||
      value.indexOf('blacklist') >= 0 ||
      value.indexOf('skip') >= 0 ||
      value.indexOf('stuck') >= 0
    ) {
      return 'failed';
    }
    if (
      value.indexOf('success') >= 0 ||
      value.indexOf('submitted') >= 0 ||
      value.indexOf('applied') >= 0 ||
      value.indexOf('done') >= 0
    ) {
      return 'success';
    }
    return 'active';
  }

  function ensureStyle() {
    var existing = document.getElementById(styleId);
    if (existing && existing.getAttribute('data-version') === widgetVersion) {
      return;
    }
    if (existing) existing.remove();

    var style = document.createElement('style');
    style.id = styleId;
    style.type = 'text/css';
    style.setAttribute('data-version', widgetVersion);
    style.textContent = [
      "#linkedin-bot-status-root{position:fixed;left:18px;bottom:18px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;pointer-events:none;transition:top .26s ease,left .26s ease,transform .28s ease,opacity .28s ease,width .26s ease,max-width .26s ease}",
      '#linkedin-bot-status-root.lb-dragging,#linkedin-bot-status-root.lb-dragging *{transition:none !important;animation:none !important;scroll-behavior:auto !important}',
      '#linkedin-bot-status-root.lb-dragging{transform:scale(1.015)}',
      '#linkedin-bot-status-root .lb-card{display:flex;flex-direction:column;align-items:flex-start;gap:10px;pointer-events:none;transition:all .26s ease}',
      '#linkedin-bot-status-root[data-dock^="r"] .lb-card{align-items:flex-end}',
      '#linkedin-bot-status-root .lb-status,#linkedin-bot-status-root .lb-panel{pointer-events:auto}',
      '#linkedin-bot-status-root.lb-compact:not(.lb-expanded) .lb-panel{display:none}',
      '#linkedin-bot-status-root .lb-status{position:relative;display:flex;align-items:center;gap:12px;max-width:min(640px,calc(100vw - 28px));min-height:60px;padding:10px 12px 10px 12px;border-radius:24px;background:#fff;border:1px solid rgba(15,23,42,.08);box-shadow:0 18px 44px rgba(15,23,42,.10),0 2px 14px rgba(15,23,42,.05);color:#14213d;transform:translateY(10px);opacity:0;transition:all .26s ease,opacity .42s ease,transform .42s ease;overflow:hidden;cursor:grab;user-select:none}',
      '#linkedin-bot-status-root .lb-status:before{content:"";position:absolute;inset:0;border-radius:23px;background:linear-gradient(180deg,rgba(255,255,255,.75),rgba(255,255,255,0));opacity:.65;pointer-events:none}',
      '#linkedin-bot-status-root .lb-status:after{display:none}',
      '#linkedin-bot-status-root .lb-status.is-visible{opacity:1;transform:translateY(0)}',
      '#linkedin-bot-status-root .lb-status:active{cursor:grabbing}',
      '#linkedin-bot-status-root .lb-indicator{position:relative;width:34px;height:34px;flex:0 0 34px;display:flex;align-items:center;justify-content:center}',
      '#linkedin-bot-status-root .lb-orb{position:relative;width:18px;height:18px;border-radius:999px;transition:transform .35s ease,opacity .35s ease,background .35s ease,box-shadow .35s ease}',
      '#linkedin-bot-status-root .lb-orb:before,#linkedin-bot-status-root .lb-orb:after{content:"";position:absolute;inset:0;border-radius:inherit}',
      '#linkedin-bot-status-root .lb-status.active .lb-orb{width:20px;height:20px;background:linear-gradient(135deg,#0a66c2,#4f8cff);box-shadow:0 0 0 1px rgba(255,255,255,.75),0 8px 18px rgba(10,102,194,.20)}',
      '#linkedin-bot-status-root .lb-status.active .lb-orb:before{inset:-8px;border:2px solid rgba(10,102,194,.14);animation:lbPulseRing 1.8s ease-out infinite}',
      '#linkedin-bot-status-root .lb-status.active .lb-orb:after{inset:5px;background:rgba(255,255,255,.92);opacity:.95}',
      '#linkedin-bot-status-root .lb-status.waiting .lb-orb{width:20px;height:20px;border:2px solid rgba(176,128,0,.18);border-top-color:#d49914;border-right-color:#f0c548;animation:lbSpin .9s linear infinite;box-shadow:0 0 0 1px rgba(255,255,255,.55)}',
      '#linkedin-bot-status-root .lb-status.waiting .lb-orb:before,#linkedin-bot-status-root .lb-status.waiting .lb-orb:after{display:none}',
      '#linkedin-bot-status-root .lb-status.success .lb-orb{background:radial-gradient(circle at 30% 30%,#b8ffd3,#1ea65a 60%,#13753e);box-shadow:0 0 0 1px rgba(255,255,255,.55),0 0 16px rgba(30,166,90,.24)}',
      '#linkedin-bot-status-root .lb-status.success .lb-orb:before{inset:-6px;background:radial-gradient(circle,rgba(30,166,90,.18),rgba(30,166,90,0) 68%);filter:blur(8px)}',
      '#linkedin-bot-status-root .lb-status.failed .lb-orb{width:12px;height:12px;background:radial-gradient(circle at 30% 30%,#ffb3bf,#cf334d 68%,#8a1731);box-shadow:0 0 0 6px rgba(207,51,77,.08),0 0 0 1px rgba(255,255,255,.55)}',
      '#linkedin-bot-status-root.lb-paused .lb-status .lb-orb{width:12px;height:12px;background:radial-gradient(circle at 30% 30%,#cfd6e6,#7f8ca7 68%,#5a6680);box-shadow:0 0 0 6px rgba(127,140,167,.08),0 0 0 1px rgba(255,255,255,.55)}',
      '#linkedin-bot-status-root .lb-copy{position:relative;display:flex;flex-direction:column;min-width:0;flex:1 1 auto;padding-right:4px}',
      '#linkedin-bot-status-root[data-dock^="r"] .lb-copy{align-items:flex-end}',
      '#linkedin-bot-status-root .lb-kicker{font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:rgba(20,33,61,.3);line-height:8px;}',
      '#linkedin-bot-status-root[data-dock^="r"] .lb-kicker{width:100%;text-align:right}',
      '#linkedin-bot-status-root .lb-text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600;line-height:18px;max-width:min(420px,calc(100vw - 186px));color:#111827}',
      '#linkedin-bot-status-root[data-dock^="r"] .lb-text{text-align:right}',
      '#linkedin-bot-status-root .lb-status:hover{box-shadow:0 20px 50px rgba(15,23,42,.18),0 2px 14px rgba(15,23,42,.08),inset 0 1px 0 rgba(255,255,255,.55)}',
      '#linkedin-bot-status-root .lb-status[data-full]:hover .lb-tooltip{opacity:1;transform:translateY(0);pointer-events:auto}',
      '#linkedin-bot-status-root .lb-tooltip{position:absolute;left:0;bottom:calc(100% + 10px);width:max-content;max-width:min(560px,calc(100vw - 24px));padding:10px 12px;border-radius:14px;background:rgba(17,24,39,.9);box-shadow:0 14px 34px rgba(0,0,0,.22);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#f8fafc;font-size:12px;font-weight:600;line-height:17px;white-space:normal;word-break:break-word;opacity:0;transform:translateY(6px);pointer-events:none;transition:opacity .24s ease,transform .24s ease}',
      '#linkedin-bot-status-root[data-dock^="r"] .lb-tooltip{left:auto;right:0}',
      '#linkedin-bot-status-root .lb-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto;position:relative;z-index:1}',
      '#linkedin-bot-status-root .lb-icon-btn{position:relative;width:30px;height:30px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(255,255,255,.5);color:#172033;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.45);transition:transform .25s ease,background .25s ease,border-color .25s ease,box-shadow .25s ease}',
      '#linkedin-bot-status-root .lb-icon-btn:hover{background:rgba(255,255,255,.72);border-color:rgba(255,255,255,.44);box-shadow:0 10px 24px rgba(15,23,42,.12),inset 0 1px 0 rgba(255,255,255,.5)}',
      '#linkedin-bot-status-root .lb-icon-btn:active{transform:scale(.96)}',
      '#linkedin-bot-status-root .lb-chevron{width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(225deg);margin-top:4px;transition:transform .3s ease,margin-top .3s ease}',
      '#linkedin-bot-status-root.lb-expanded .lb-chevron{transform:rotate(45deg);margin-top:-1px}',
      "#linkedin-bot-status-root .lb-pause-icon:before,#linkedin-bot-status-root .lb-pause-icon:after{content:'';display:block;position:absolute;top:8px;width:3px;height:12px;border-radius:2px;background:currentColor}",
      '#linkedin-bot-status-root .lb-pause-icon:before{left:10px}',
      '#linkedin-bot-status-root .lb-pause-icon:after{right:10px}',
      '#linkedin-bot-status-root.lb-paused .lb-pause-icon:before{left:11px;top:7px;width:0;height:0;border-top:7px solid transparent;border-bottom:7px solid transparent;border-left:10px solid currentColor;border-radius:0;background:transparent}',
      '#linkedin-bot-status-root.lb-paused .lb-pause-icon:after{display:none}',
      '#linkedin-bot-status-root .lb-panel{display:block;width:min(390px,calc(100vw - 24px));max-height:0;overflow:hidden;border-radius:22px;background:#fff;border:1px solid rgba(15,23,42,.08);box-shadow:0 20px 52px rgba(15,23,42,.10),0 2px 14px rgba(15,23,42,.05);opacity:0;transform:translateY(8px);transition:all .26s ease,max-height .45s ease,opacity .32s ease,transform .32s ease}',
      '#linkedin-bot-status-root.lb-expanded .lb-panel{max-height:380px;opacity:1;transform:translateY(0)}',
      '#linkedin-bot-status-root.lb-expanded.lb-needs-action .lb-panel{max-height:470px}',
      '#linkedin-bot-status-root[data-dock^="t"] .lb-card{flex-direction:column-reverse}',
      '#linkedin-bot-status-root[data-dock^="t"] .lb-panel{transform:translateY(-8px)}',
      '#linkedin-bot-status-root.lb-expanded[data-dock^="t"] .lb-panel{transform:translateY(0)}',
      '#linkedin-bot-status-root .lb-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:14px 16px 10px}',
      '#linkedin-bot-status-root .lb-panel-title{display:flex;flex-direction:column;gap:2px}',
      '#linkedin-bot-status-root .lb-panel-eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:rgba(20,33,61,.46)}',
      '#linkedin-bot-status-root .lb-panel-main{font-size:14px;font-weight:800;line-height:18px;color:#0f172a}',
      '#linkedin-bot-status-root .lb-panel-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
      '#linkedin-bot-status-root .lb-pause-state{font-size:11px;font-weight:800;color:#0a66c2}',
      '#linkedin-bot-status-root .lb-link-btn{border:0;background:transparent;color:#0a66c2;font-size:11px;font-weight:800;cursor:pointer;padding:2px 0}',
      '#linkedin-bot-status-root .lb-link-btn:hover{text-decoration:underline}',
      '#linkedin-bot-status-root .lb-recovery{max-height:0;opacity:0;overflow:hidden;padding:0 16px;border-top:1px solid rgba(255,255,255,0);border-bottom:1px solid rgba(255,255,255,0);background:linear-gradient(180deg,rgba(255,247,224,.74),rgba(255,247,224,.54));transition:max-height .34s ease,opacity .26s ease,padding .34s ease,border-color .26s ease}',
      '#linkedin-bot-status-root.lb-needs-action .lb-recovery{max-height:130px;opacity:1;padding:12px 16px;border-top-color:rgba(255,255,255,.36);border-bottom-color:rgba(255,255,255,.34)}',
      '#linkedin-bot-status-root .lb-recovery-title{font-size:12px;font-weight:800;color:#111827;margin-bottom:5px}',
      '#linkedin-bot-status-root .lb-recovery-msg{font-size:11px;line-height:16px;color:#6b7280;margin-bottom:9px;word-break:break-word}',
      '#linkedin-bot-status-root .lb-recovery-actions{display:flex;gap:8px;justify-content:flex-end}',
      '#linkedin-bot-status-root .lb-action-btn{height:28px;border:0;border-radius:999px;padding:0 12px;font-size:11px;font-weight:800;cursor:pointer;background:#0a66c2;color:#fff;box-shadow:0 10px 22px rgba(10,102,194,.18)}',
      '#linkedin-bot-status-root .lb-action-btn.secondary{background:#f8fafc;color:#14213d;box-shadow:none}',
      '#linkedin-bot-status-root .lb-timeline-wrap{position:relative;padding:0 0 12px}',
      '#linkedin-bot-status-root .lb-timeline-wrap:before,#linkedin-bot-status-root .lb-timeline-wrap:after{content:"";position:absolute;left:0;right:0;height:18px;pointer-events:none;z-index:2}',
      '#linkedin-bot-status-root .lb-timeline-wrap:before{top:0;background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,0))}',
      '#linkedin-bot-status-root .lb-timeline-wrap:after{bottom:0;background:linear-gradient(0deg,rgba(255,255,255,.96),rgba(255,255,255,0))}',
      '#linkedin-bot-status-root .lb-timeline{position:relative;margin:0;padding:4px 16px 8px 26px;list-style:none;max-height:220px;overflow:auto;scroll-behavior:smooth}',
      '#linkedin-bot-status-root .lb-item{position:relative;padding:7px 10px 9px 12px;animation:lbItemIn .3s ease both}',
      "#linkedin-bot-status-root .lb-item:after{content:'';position:absolute;left:-8px;top:-8px;bottom:-8px;width:1px;background:linear-gradient(180deg,rgba(10,102,194,.18),rgba(10,102,194,.05))}",
      "#linkedin-bot-status-root .lb-item:before{content:'';position:absolute;left:-11px;top:12px;width:7px;height:7px;border-radius:999px;background:#0a66c2;box-shadow:0 0 0 4px rgba(255,255,255,.8)}",
      '#linkedin-bot-status-root .lb-item-time{font-size:10px;line-height:12px;color:#7b8497}',
      '#linkedin-bot-status-root .lb-item-text{font-size:12px;line-height:17px;font-weight:700;color:#172033;word-break:break-word}',
      '#linkedin-bot-status-root .lb-item.waiting:before{background:#d49914}',
      '#linkedin-bot-status-root .lb-item.waiting .lb-item-text{color:#9a6a00}',
      '#linkedin-bot-status-root .lb-item.success:before{background:#1ea65a}',
      '#linkedin-bot-status-root .lb-item.success .lb-item-text{color:#177b44}',
      '#linkedin-bot-status-root .lb-item.failed:before{background:#cf334d}',
      '#linkedin-bot-status-root .lb-item.failed .lb-item-text{color:#a11e37}',
      '#linkedin-bot-status-root .lb-empty{padding:18px 16px 12px;font-size:12px;font-weight:600;color:#6b7280}',
      '#linkedin-bot-status-root .lb-sticky-bottom{position:absolute;right:16px;bottom:10px;z-index:3;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid rgba(15,23,42,.08);border-radius:999px;background:#fff;box-shadow:0 14px 30px rgba(15,23,42,.10);cursor:pointer;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .26s ease,transform .26s ease,background .26s ease}',
      '#linkedin-bot-status-root.lb-show-bottom .lb-sticky-bottom{opacity:1;transform:translateY(0);pointer-events:auto}',
      '#linkedin-bot-status-root .lb-sticky-bottom:hover{background:rgba(255,255,255,.88)}',
      '#linkedin-bot-status-root .lb-sticky-bottom svg{width:14px;height:14px;fill:none;stroke:#0a66c2;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round}',
      '#linkedin-bot-status-root .active{border-color:rgba(120,180,255,.24)}',
      '#linkedin-bot-status-root .waiting{border-color:rgba(221,176,75,.26)}',
      '#linkedin-bot-status-root .success{border-color:rgba(63,180,111,.24)}',
      '#linkedin-bot-status-root .failed{border-color:rgba(207,51,77,.22)}',
      '@keyframes lbItemIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes lbSpin{to{transform:rotate(360deg)}}',
      '@keyframes lbHaloSpin{to{transform:rotate(360deg)}}',
      '@keyframes lbBreathe{0%,100%{transform:scale(.88);opacity:.65}50%{transform:scale(1.08);opacity:1}}',
      '@keyframes lbPulseRing{0%{transform:scale(.7);opacity:.0}20%{opacity:.28}100%{transform:scale(1.32);opacity:0}}',
    ].join('');
    (document.head || document.body || document.documentElement).appendChild(
      style,
    );
  }

  function applyStyles(node, styles) {
    if (!node || !styles) return;
    Object.keys(styles).forEach(function (key) {
      node.style[key] = styles[key];
    });
  }

  function createNode(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function buildWidgetTree(root) {
    var card = createNode('div', 'lb-card');

    var panel = createNode('div', 'lb-panel');
    var panelHead = createNode('div', 'lb-panel-head');
    var panelTitle = createNode('div', 'lb-panel-title');
    panelTitle.appendChild(
      createNode('span', 'lb-panel-eyebrow', 'Live Session'),
    );
    panelTitle.appendChild(
      createNode('span', 'lb-panel-main', 'Status Timeline'),
    );

    var panelActions = createNode('span', 'lb-panel-actions');
    panelActions.appendChild(createNode('span', 'lb-pause-state', 'Running'));

    var clearBtn = createNode('button', 'lb-link-btn lb-clear-btn', 'Clear');
    clearBtn.type = 'button';
    var collapseBtn = createNode(
      'button',
      'lb-link-btn lb-collapse-btn',
      'Hide',
    );
    collapseBtn.type = 'button';
    panelActions.appendChild(clearBtn);
    panelActions.appendChild(collapseBtn);

    panelHead.appendChild(panelTitle);
    panelHead.appendChild(panelActions);

    var recovery = createNode('div', 'lb-recovery');
    recovery.appendChild(
      createNode('div', 'lb-recovery-title', 'Search filters need attention'),
    );
    recovery.appendChild(createNode('div', 'lb-recovery-msg', ''));

    var recoveryActions = createNode('div', 'lb-recovery-actions');
    var skipBtn = createNode(
      'button',
      'lb-action-btn secondary lb-skip-btn',
      'Skip this search',
    );
    skipBtn.type = 'button';
    var retryBtn = createNode(
      'button',
      'lb-action-btn lb-retry-btn',
      'Retry filters',
    );
    retryBtn.type = 'button';
    recoveryActions.appendChild(skipBtn);
    recoveryActions.appendChild(retryBtn);
    recovery.appendChild(recoveryActions);

    var timelineWrap = createNode('div', 'lb-timeline-wrap');
    var timeline = createNode('ol', 'lb-timeline');
    var stickyBottom = createNode('button', 'lb-sticky-bottom');
    stickyBottom.type = 'button';
    stickyBottom.title = 'Jump to latest status';
    stickyBottom.setAttribute('aria-label', 'Jump to latest status');

    var stickySvg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    stickySvg.setAttribute('viewBox', '0 0 16 16');
    var stickyPath1 = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    stickyPath1.setAttribute('d', 'M8 3v8');
    var stickyPath2 = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    stickyPath2.setAttribute('d', 'M4.5 8.5 8 12l3.5-3.5');
    stickySvg.appendChild(stickyPath1);
    stickySvg.appendChild(stickyPath2);
    stickyBottom.appendChild(stickySvg);

    timelineWrap.appendChild(timeline);
    timelineWrap.appendChild(stickyBottom);

    panel.appendChild(panelHead);
    panel.appendChild(recovery);
    panel.appendChild(timelineWrap);

    var status = createNode('div', 'lb-status active');
    var indicator = createNode('span', 'lb-indicator');
    indicator.appendChild(createNode('span', 'lb-orb'));

    var copy = createNode('span', 'lb-copy');
    copy.appendChild(createNode('span', 'lb-kicker', 'Auto Apply'));
    copy.appendChild(createNode('span', 'lb-text', 'Ready'));

    var actions = createNode('span', 'lb-actions');
    var expandBtn = createNode('button', 'lb-icon-btn lb-expand-btn');
    expandBtn.type = 'button';
    expandBtn.title = 'Show status history';
    expandBtn.appendChild(createNode('span', 'lb-chevron'));

    var pauseBtn = createNode('button', 'lb-icon-btn lb-pause-btn');
    pauseBtn.type = 'button';
    pauseBtn.title = 'Pause bot';
    pauseBtn.appendChild(createNode('span', 'lb-pause-icon'));

    actions.appendChild(expandBtn);
    actions.appendChild(pauseBtn);

    status.appendChild(indicator);
    status.appendChild(copy);
    status.appendChild(actions);
    status.appendChild(createNode('div', 'lb-tooltip', ''));

    card.appendChild(panel);
    card.appendChild(status);
    root.appendChild(card);
  }

  function applyInlineFallback(root, state) {
    if (!root) return;
    var bubble = root.querySelector('.lb-status');
    var panel = root.querySelector('.lb-panel');
    var card = root.querySelector('.lb-card');
    var indicator = root.querySelector('.lb-indicator');
    var orb = root.querySelector('.lb-orb');
    var copy = root.querySelector('.lb-copy');
    var kicker = root.querySelector('.lb-kicker');
    var text = root.querySelector('.lb-text');
    var actions = root.querySelector('.lb-actions');
    var expandBtn = root.querySelector('.lb-expand-btn');
    var pauseBtn = root.querySelector('.lb-pause-btn');
    var timeline = root.querySelector('.lb-timeline');
    var panelHead = root.querySelector('.lb-panel-head');
    var stickyBottom = root.querySelector('.lb-sticky-bottom');
    var statusType = state && state.statusType ? state.statusType : 'active';
    var paused = !!(state && state.paused);
    var expanded = root.classList.contains('lb-expanded');
    var isActive = !paused && statusType === 'active';
    var orbBackground = '#0a66c2';
    var orbBoxShadow = '0 0 0 1px rgba(255,255,255,.55)';
    var dock = root.dataset.dock || 'bl';
    var horizontalOffset =
      dock.indexOf('r') >= 0 ?
        parseInt(root.style.right, 10)
      : parseInt(root.style.left, 10);
    var verticalOffset =
      dock.indexOf('b') >= 0 ?
        parseInt(root.style.bottom, 10)
      : parseInt(root.style.top, 10);

    if (!Number.isFinite(horizontalOffset)) horizontalOffset = dockOffset;
    if (!Number.isFinite(verticalOffset)) verticalOffset = dockOffset;

    if (statusType === 'waiting') {
      orbBackground = 'linear-gradient(135deg,#f7d774,#d49914)';
      orbBoxShadow =
        '0 0 0 1px rgba(255,255,255,.55),0 0 14px rgba(212,153,20,.25)';
    } else if (statusType === 'success') {
      orbBackground =
        'radial-gradient(circle at 30% 30%,#b8ffd3,#1ea65a 60%,#13753e)';
      orbBoxShadow =
        '0 0 0 1px rgba(255,255,255,.55),0 0 16px rgba(30,166,90,.24)';
    } else if (statusType === 'failed' || paused) {
      orbBackground =
        paused ?
          'radial-gradient(circle at 30% 30%,#cfd6e6,#7f8ca7 68%,#5a6680)'
        : 'radial-gradient(circle at 30% 30%,#ffb3bf,#cf334d 68%,#8a1731)';
      orbBoxShadow =
        paused ?
          '0 0 0 6px rgba(127,140,167,.08),0 0 0 1px rgba(255,255,255,.55)'
        : '0 0 0 6px rgba(207,51,77,.08),0 0 0 1px rgba(255,255,255,.55)';
    } else if (isActive) {
      orbBackground = 'linear-gradient(135deg,#0a66c2,#4f8cff)';
      orbBoxShadow =
        '0 0 0 1px rgba(255,255,255,.75),0 8px 18px rgba(10,102,194,.20)';
    }

    applyDockPosition(root, dock, horizontalOffset, verticalOffset);
    applyStyles(card, {
      display: 'flex',
      flexDirection: dock.indexOf('t') === 0 ? 'column-reverse' : 'column',
      alignItems: dock.indexOf('r') >= 0 ? 'flex-end' : 'flex-start',
      gap: '10px',
      pointerEvents: 'none',
    });
    applyStyles(bubble, {
      position: 'relative',
      display: 'flex',
      transition: 'all 1s',
      alignItems: 'center',
      gap: '12px',
      maxWidth: 'min(640px, calc(100vw - 28px))',
      minHeight: '60px',
      padding: '10px 12px',
      borderRadius: '999px',
      background: '#fff',
      border: '1px solid rgba(15,23,42,.08)',
      boxShadow: '0 18px 44px rgba(15,23,42,.10),0 2px 14px rgba(15,23,42,.05)',
      color: '#14213d',
      overflow: 'hidden',
      cursor: 'grab',
      userSelect: 'none',
      pointerEvents: 'auto',
      opacity: '1',
      transform: 'translateY(0)',
    });
    applyStyles(indicator, {
      position: 'relative',
      width: '34px',
      height: '34px',
      flex: '0 0 34px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    applyStyles(orb, {
      display: 'block',
      transition: 'all 1s',
      width:
        statusType === 'failed' || paused ? '12px'
        : statusType === 'active' ? '22px'
        : '20px',
      height:
        statusType === 'failed' || paused ? '12px'
        : statusType === 'active' ? '22px'
        : '20px',
      borderRadius: '999px',
      background: orbBackground,
      boxShadow: orbBoxShadow,
      border: statusType === 'waiting' ? '2px solid rgba(176,128,0,.18)' : '0',
      borderTopColor: statusType === 'waiting' ? '#d49914' : '',
      borderRightColor: statusType === 'waiting' ? '#f0c548' : '',
    });
    applyStyles(copy, {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: dock.indexOf('r') >= 0 ? 'flex-end' : 'flex-start',
      minWidth: '0',
      flex: '1 1 auto',
      paddingRight: '4px',
    });
    applyStyles(kicker, {
      display: 'block',
      fontSize: '8px',
      fontWeight: '800',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'rgba(20,33,61,.3)',
      lineHeight: '8px',
      paddingBottom: '4px',
    });
    applyStyles(text, {
      display: 'block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontSize: '14px',
      fontWeight: '600',
      lineHeight: '18px',
      maxWidth: 'min(420px, calc(100vw - 186px))',
      color: '#111827',
      textAlign: dock.indexOf('r') >= 0 ? 'right' : 'left',
    });
    applyStyles(actions, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flex: '0 0 auto',
      position: 'relative',
      zIndex: '1',
    });
    [expandBtn, pauseBtn].forEach(function (button) {
      applyStyles(button, {
        position: 'relative',
        width: '30px',
        height: '30px',
        border: '1px solid rgba(255,255,255,.28)',
        borderRadius: '999px',
        background: '#fff',
        color: '#172033',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.45)',
        pointerEvents: 'auto',
      });
    });
    applyStyles(panel, {
      display: expanded ? 'block' : 'none',
      width: 'min(390px, calc(100vw - 24px))',
      overflow: 'hidden',
      borderRadius: '22px',
      background: '#fff',
      border: '1px solid rgba(15,23,42,.08)',
      boxShadow: '0 20px 52px rgba(15,23,42,.10),0 2px 14px rgba(15,23,42,.05)',
      pointerEvents: 'auto',
      opacity: expanded ? '1' : '0',
      maxHeight:
        expanded ?
          root.classList.contains('lb-needs-action') ?
            '470px'
          : '380px'
        : '0',
      transform:
        expanded ? 'translateY(0)'
        : dock.indexOf('t') === 0 ? 'translateY(-8px)'
        : 'translateY(8px)',
    });
    applyStyles(panelHead, {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '14px',
      padding: '14px 16px 10px',
    });
    applyStyles(timeline, {
      position: 'relative',
      margin: '0',
      padding: '4px 16px 8px 26px',
      listStyle: 'none',
      maxHeight: '220px',
      overflow: 'auto',
      scrollBehavior: 'smooth',
    });
    applyStyles(stickyBottom, {
      position: 'absolute',
      right: '16px',
      bottom: '10px',
      zIndex: '3',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '34px',
      height: '34px',
      border: '1px solid rgba(255,255,255,.32)',
      borderRadius: '999px',
      background: '#fff',
      boxShadow: '0 14px 30px rgba(15,23,42,.10)',
      cursor: 'pointer',
      opacity: '0',
      pointerEvents: 'none',
    });
  }

  function readLayout() {
    try {
      var value = window.localStorage.getItem(storageKey);
      return value ? JSON.parse(value) : null;
    } catch (_error) {
      return null;
    }
  }

  function writeLayout(layout) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch (_error) {}
  }

  function getDefaultLayout() {
    return { dock: 'bl' };
  }

  function getRootLayout(root) {
    return root._lbLayout || getDefaultLayout();
  }

  function refreshWidgetLayout(root) {
    if (!root) return;
    if (root.classList.contains('lb-dragging')) return;
    applyInlineFallback(root, {
      statusType: statusClass(window.botStatus || 'Ready'),
      paused: !!window.linkedinBotPaused,
    });
  }

  function setExpanded(root, expanded) {
    if (!root) return;
    root.classList.toggle('lb-expanded', !!expanded);
    if (expanded) root.classList.remove('lb-compact');
    refreshWidgetLayout(root);
  }

  function setDockState(root, dock, persist) {
    if (!root) return;
    root.dataset.dock = dock;
    root._lbLayout = { dock: dock };
    if (persist !== false) writeLayout(root._lbLayout);
    refreshWidgetLayout(root);
  }

  function applyDockPosition(root, dock, horizontalOffset, verticalOffset) {
    var isRight = dock.indexOf('r') >= 0;
    var isBottom = dock.indexOf('b') >= 0;
    applyStyles(root, {
      position: 'fixed',
      left: isRight ? 'auto' : horizontalOffset + 'px',
      right: isRight ? horizontalOffset + 'px' : 'auto',
      top: isBottom ? 'auto' : verticalOffset + 'px',
      bottom: isBottom ? verticalOffset + 'px' : 'auto',
      zIndex: '2147483647',
      pointerEvents: 'none',
      fontFamily:
        "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif",
    });
  }

  function alignRootToDock(root) {
    if (!root) return;
    var dock = (root.dataset && root.dataset.dock) || 'bl';
    if (dock === 'free') return;
    var margin = dockOffset;
    var rect = root.getBoundingClientRect();
    var horizontalOffset = margin;
    var verticalOffset = margin;
    if (dock.indexOf('r') >= 0) {
      horizontalOffset = clamp(
        margin,
        margin,
        Math.max(margin, window.innerWidth - rect.width - margin),
      );
    }
    if (dock.indexOf('b') >= 0) {
      verticalOffset = clamp(
        margin,
        margin,
        Math.max(margin, window.innerHeight - rect.height - margin),
      );
    }
    applyDockPosition(root, dock, horizontalOffset, verticalOffset);
  }

  function scheduleLayoutRealign(root) {
    if (!root) return;
    if (root.classList.contains('lb-dragging')) return;
    if (layoutRaf) {
      cancelAnimationFrame(layoutRaf);
    }
    layoutRaf = requestAnimationFrame(function () {
      layoutRaf = 0;
      alignRootToDock(root);
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function applyDockLayout(root, layout) {
    if (!root) return;
    var dock = layout && layout.dock ? layout.dock : 'bl';
    var margin = dockOffset;
    var rect = root.getBoundingClientRect();
    var horizontalOffset = margin;
    var verticalOffset = margin;
    if (dock.indexOf('r') >= 0) {
      horizontalOffset = clamp(
        margin,
        margin,
        Math.max(margin, window.innerWidth - rect.width - margin),
      );
    }
    if (dock.indexOf('b') >= 0) {
      verticalOffset = clamp(
        margin,
        margin,
        Math.max(margin, window.innerHeight - rect.height - margin),
      );
    }
    applyDockPosition(root, dock, horizontalOffset, verticalOffset);
    setDockState(root, dock, true);
    scheduleLayoutRealign(root);
  }

  function nearestDock(root) {
    var rect = root.getBoundingClientRect();
    var midX = rect.left + rect.width / 2;
    var midY = rect.top + rect.height / 2;
    var horizontal = midX < window.innerWidth / 2 ? 'l' : 'r';
    var vertical = midY < window.innerHeight / 2 ? 't' : 'b';
    return vertical + horizontal;
  }

  function bindDragging(root) {
    var handle = root.querySelector('.lb-status');
    if (!handle || handle.dataset.dragBound === 'true') return;
    handle.dataset.dragBound = 'true';

    handle.addEventListener('pointerdown', function (event) {
      if (event.target.closest('.lb-icon-btn')) return;
      var rect = root.getBoundingClientRect();
      dragState = {
        id: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      root.classList.add('lb-dragging');
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener('pointermove', function (event) {
      if (!dragState || dragState.id !== event.pointerId) return;
      var maxLeft = Math.max(
        dockOffset,
        window.innerWidth - root.offsetWidth - dockOffset,
      );
      var maxTop = Math.max(
        dockOffset,
        window.innerHeight - root.offsetHeight - dockOffset,
      );
      root.style.left =
        clamp(event.clientX - dragState.offsetX, dockOffset, maxLeft) + 'px';
      root.style.top =
        clamp(event.clientY - dragState.offsetY, dockOffset, maxTop) + 'px';
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      var liveDock = nearestDock(root);
      if (root.dataset.dock !== liveDock) {
        setDockState(root, liveDock, false);
      }
    });

    function endDrag(event) {
      if (!dragState || (event && dragState.id !== event.pointerId)) return;
      root.classList.remove('lb-dragging');
      dragState = null;
      applyDockLayout(root, { dock: nearestDock(root) });
    }

    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }

  function ensureRoot() {
    var root = document.getElementById(rootId);
    if (
      root &&
      root.getAttribute('data-version') === widgetVersion &&
      root.querySelector('.lb-pause-btn')
    ) {
      return root;
    }
    if (root) root.remove();

    root = document.createElement('div');
    root.id = rootId;
    root.setAttribute('data-version', widgetVersion);
    root.style.position = 'fixed';
    root.style.left = dockOffset + 'px';
    root.style.bottom = dockOffset + 'px';
    root.style.zIndex = '2147483647';
    root.style.pointerEvents = 'none';
    buildWidgetTree(root);
    document.body.appendChild(root);

    applyInlineFallback(root, { statusType: 'active', paused: false });

    bindDragging(root);
    applyDockLayout(root, readLayout() || getDefaultLayout());

    function bindAction(selector, handler) {
      var node = root.querySelector(selector);
      if (!node) return;
      node.addEventListener('pointerdown', function (event) {
        event.stopPropagation();
      });
      node.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        handler(event);
      });
    }

    bindAction('.lb-expand-btn', function () {
      setExpanded(root, !root.classList.contains('lb-expanded'));
      renderTimeline(root);
      requestAnimationFrame(function () {
        scrollTimelineToBottom(root, false);
      });
      scheduleLayoutRealign(root);
    });
    bindAction('.lb-pause-btn', function () {
      setPaused(!window.linkedinBotPaused);
    });
    bindAction('.lb-clear-btn', function () {
      window.linkedinBotStatusHistory = [];
      renderTimeline(root);
      updateBottomButton(root);
      scheduleLayoutRealign(root);
    });
    bindAction('.lb-collapse-btn', function () {
      setExpanded(root, false);
      scheduleLayoutRealign(root);
    });
    bindAction('.lb-retry-btn', function () {
      window.linkedinBotFilterAction = 'retry';
      clearFilterRecovery();
    });
    bindAction('.lb-skip-btn', function () {
      window.linkedinBotFilterAction = 'skip';
      clearFilterRecovery();
    });
    bindAction('.lb-sticky-bottom', function () {
      scrollTimelineToBottom(root, true);
    });
    root.querySelector('.lb-timeline').addEventListener('scroll', function () {
      updateBottomButton(root);
    });

    if (typeof ResizeObserver !== 'undefined') {
      var resizeObserver = new ResizeObserver(function () {
        if (dragState) return;
        scheduleLayoutRealign(root);
      });
      resizeObserver.observe(root);
      root._lbResizeObserver = resizeObserver;
    }

    window.addEventListener('resize', function () {
      if (!root || !document.body.contains(root)) return;
      scheduleLayoutRealign(root);
    });

    requestAnimationFrame(function () {
      var bubble = root.querySelector('.lb-status');
      if (bubble) bubble.classList.add('is-visible');
    });
    return root;
  }

  function ensureHistory() {
    if (!Array.isArray(window.linkedinBotStatusHistory)) {
      window.linkedinBotStatusHistory = [];
    }
    return window.linkedinBotStatusHistory;
  }

  function formatTime(timestamp) {
    var date = new Date(timestamp || Date.now());
    var hours = String(date.getHours()).padStart(2, '0');
    var minutes = String(date.getMinutes()).padStart(2, '0');
    var seconds = String(date.getSeconds()).padStart(2, '0');
    return hours + ':' + minutes + ':' + seconds;
  }

  function addHistory(message) {
    var history = ensureHistory();
    var last = history[history.length - 1];
    if (last && last.text === message) return;
    history.push({
      text: message,
      time: Date.now(),
      type: statusClass(message),
    });
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }
  }

  function isTimelineAtBottom(list) {
    if (!list) return true;
    return list.scrollHeight - list.scrollTop - list.clientHeight < 10;
  }

  function updateBottomButton(root) {
    var list = root.querySelector('.lb-timeline');
    root.classList.toggle('lb-show-bottom', !isTimelineAtBottom(list));
  }

  function scrollTimelineToBottom(root, smooth) {
    var list = root.querySelector('.lb-timeline');
    if (!list) return;
    list.scrollTo({
      top: list.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
    window.setTimeout(
      function () {
        updateBottomButton(root);
      },
      smooth ? 220 : 0,
    );
  }

  function renderTimeline(root, followBottom) {
    var list = root.querySelector('.lb-timeline');
    if (!list) return;
    var shouldFollow = followBottom || isTimelineAtBottom(list);
    var history = ensureHistory();
    if (!history.length) {
      list.innerHTML = '<li class="lb-empty">No status yet</li>';
      updateBottomButton(root);
      return;
    }
    list.innerHTML = history
      .map(function (item) {
        return (
          '<li class="lb-item ' +
          (item.type || statusClass(item.text)) +
          '"><div class="lb-item-time">' +
          formatTime(item.time) +
          '</div><div class="lb-item-text"></div></li>'
        );
      })
      .join('');
    var textNodes = list.querySelectorAll('.lb-item-text');
    history.forEach(function (item, index) {
      textNodes[index].textContent = item.text;
    });
    if (shouldFollow) {
      requestAnimationFrame(function () {
        scrollTimelineToBottom(root, true);
      });
    } else {
      updateBottomButton(root);
    }
  }

  function setPaused(paused) {
    var root = ensureRoot();
    window.linkedinBotPaused = !!paused;
    root.classList.toggle('lb-paused', window.linkedinBotPaused);
    root.querySelector('.lb-pause-btn').title =
      window.linkedinBotPaused ? 'Resume bot' : 'Pause bot';
    root.querySelector('.lb-pause-state').textContent =
      window.linkedinBotPaused ? 'Paused' : 'Running';
    refreshWidgetLayout(root);
    scheduleLayoutRealign(root);
  }

  function showFilterRecovery(message) {
    var root = ensureRoot();
    window.linkedinBotFilterAction = null;
    setExpanded(root, true);
    root.classList.add('lb-needs-action');
    root.querySelector('.lb-recovery-msg').textContent =
      'Automatic retries did not finish this step. ' +
      String(message || 'Filter controls were not found.');
    refreshWidgetLayout(root);
    renderTimeline(root, true);
    scheduleLayoutRealign(root);
  }

  function clearFilterRecovery() {
    var root = ensureRoot();
    root.classList.remove('lb-needs-action');
    refreshWidgetLayout(root);
    scheduleLayoutRealign(root);
  }

  function setCompact(compact) {
    var root = ensureRoot();
    root.classList.toggle('lb-compact', !!compact);
    if (compact) setExpanded(root, false);
    refreshWidgetLayout(root);
    scheduleLayoutRealign(root);
  }

  function render(text) {
    if (!document.body) return;
    ensureStyle();
    var root = ensureRoot();
    var bubble = root.querySelector('.lb-status');
    var label = root.querySelector('.lb-text');
    var tooltip = root.querySelector('.lb-tooltip');
    var message = String(text || 'Ready');
    var cls = window.linkedinBotPaused ? 'failed' : statusClass(message);
    bubble.className =
      'lb-status is-visible ' + (window.linkedinBotPaused ? 'failed' : cls);
    label.textContent = message;
    label.title = message;
    bubble.setAttribute('data-full', message);
    tooltip.textContent = message;
    addHistory(message);
    setPaused(!!window.linkedinBotPaused);
    if (!root.classList.contains('lb-dragging')) {
      applyInlineFallback(root, {
        statusType: cls,
        paused: !!window.linkedinBotPaused,
      });
    }
    if (root.classList.contains('lb-expanded')) renderTimeline(root, true);
    window.botStatus = message;
    window.botStatusTime = Date.now();
    scheduleLayoutRealign(root);
  }

  window.updateLinkedInBotStatus = render;
  window.setLinkedInBotPaused = setPaused;
  window.showLinkedInBotFilterRecovery = showFilterRecovery;
  window.clearLinkedInBotFilterRecovery = clearFilterRecovery;
  window.setLinkedInBotStatusCompact = setCompact;
  window.linkedinBotStatusVersion = widgetVersion;
  render(window.botStatus || 'Ready');
})();
