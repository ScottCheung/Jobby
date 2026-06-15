/** @format */

(function () {
  'use strict';

  var rootId = 'linkedin-bot-status-root';
  var styleId = 'linkedin-bot-status-style';
  var widgetVersion = '2026-06-15-inline-status-v5';
  var maxHistory = 150;

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
    style.setAttribute('data-version', widgetVersion);
    style.textContent = [
      "#linkedin-bot-status-root{position:fixed;left:18px;bottom:18px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;pointer-events:none}",
      '#linkedin-bot-status-root.lb-compact{left:18px;bottom:18px}',
      '#linkedin-bot-status-root.lb-compact:not(.lb-expanded) .lb-panel{display:none}',
      '#linkedin-bot-status-root.lb-compact .lb-status{max-width:min(320px,calc(100vw - 36px));padding-right:7px}',
      '#linkedin-bot-status-root.lb-compact .lb-text{max-width:min(170px,calc(100vw - 170px))}',
      '#linkedin-bot-status-root .lb-card{display:flex;flex-direction:column;align-items:flex-start;gap:8px}',
      '#linkedin-bot-status-root .lb-status{position:relative;display:flex;align-items:center;gap:8px;max-width:min(620px,calc(100vw - 36px));min-height:34px;padding:6px 7px 6px 12px;border-radius:18px;background:rgba(255,255,255,.94);border:1px solid rgba(0,0,0,.1);box-shadow:0 8px 24px rgba(0,0,0,.16),0 1px 2px rgba(0,0,0,.08);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#1f2328;transform:translateY(10px);opacity:0;transition:opacity .38s ease,transform .38s ease,border-color .38s ease,box-shadow .38s ease,max-width .55s ease,padding .55s ease,background-color .38s ease;pointer-events:auto;will-change:transform,max-width}',
      '#linkedin-bot-status-root .lb-status.is-visible{opacity:1;transform:translateY(0)}',
      '#linkedin-bot-status-root .lb-dot{width:8px;height:8px;border-radius:999px;flex:0 0 auto;background:#0a66c2;transition:background-color .38s ease,box-shadow .38s ease,transform .38s ease}',
      '#linkedin-bot-status-root .lb-text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;line-height:16px;max-width:min(440px,calc(100vw - 170px));transition:max-width .55s ease,color .38s ease,opacity .38s ease}',
      '#linkedin-bot-status-root .lb-status:after{content:attr(data-full);display:none;position:absolute;left:0;bottom:calc(100% + 8px);width:max-content;max-width:min(560px,calc(100vw - 36px));padding:8px 10px;border-radius:8px;background:rgba(31,35,40,.96);box-shadow:0 8px 24px rgba(0,0,0,.22);color:#fff;font-size:12px;font-weight:600;line-height:16px;white-space:normal;word-break:break-word;z-index:1;animation:lbTooltipIn .26s ease both}',
      '#linkedin-bot-status-root .lb-status:hover:after{display:block}',
      '#linkedin-bot-status-root .lb-actions{display:flex;align-items:center;gap:4px;flex:0 0 auto;transition:gap .38s ease,opacity .38s ease}',
      '#linkedin-bot-status-root .lb-icon-btn{position:relative;min-width:24px;height:24px;border:0;border-radius:999px;background:rgba(0,0,0,.06);color:#1f2328;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0 7px;transition:background-color .3s ease,transform .3s ease,box-shadow .3s ease,color .3s ease;font-size:11px;font-weight:800}',
      '#linkedin-bot-status-root .lb-icon-btn:hover{background:rgba(10,102,194,.12)}',
      '#linkedin-bot-status-root .lb-icon-btn:active{transform:scale(.96)}',
      '#linkedin-bot-status-root .lb-chevron{width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(225deg);margin-top:3px;transition:transform .35s ease}',
      '#linkedin-bot-status-root.lb-expanded .lb-chevron{transform:rotate(45deg);margin-top:-2px}',
      "#linkedin-bot-status-root .lb-pause-icon:before,#linkedin-bot-status-root .lb-pause-icon:after{content:'';display:block;position:absolute;top:7px;width:3px;height:10px;border-radius:2px;background:currentColor}",
      '#linkedin-bot-status-root .lb-pause-icon:before{left:8px}',
      '#linkedin-bot-status-root .lb-pause-icon:after{right:8px}',
      '#linkedin-bot-status-root.lb-paused .lb-pause-icon:before{left:9px;top:6px;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid currentColor;border-radius:0;background:transparent}',
      '#linkedin-bot-status-root.lb-paused .lb-pause-icon:after{display:none}',
      '#linkedin-bot-status-root .lb-panel{display:block;width:min(360px,calc(100vw - 36px));max-height:0;overflow:hidden;border-radius:12px;background:rgba(255,255,255,.96);border:1px solid rgba(0,0,0,0);box-shadow:0 10px 30px rgba(0,0,0,0);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);pointer-events:none;opacity:0;transform:translateY(8px);transition:max-height .5s ease,opacity .38s ease,transform .38s ease,border-color .38s ease,box-shadow .38s ease}',
      '#linkedin-bot-status-root.lb-expanded .lb-panel{max-height:320px;opacity:1;transform:translateY(0);border-color:rgba(0,0,0,.1);box-shadow:0 10px 30px rgba(0,0,0,.18);pointer-events:auto}',
      '#linkedin-bot-status-root.lb-expanded.lb-needs-action .lb-panel{max-height:430px}',
      '#linkedin-bot-status-root .lb-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(0,0,0,.08);font-size:12px;font-weight:700;color:#1f2328}',
      '#linkedin-bot-status-root .lb-panel-actions{display:flex;align-items:center;gap:6px}',
      '#linkedin-bot-status-root .lb-link-btn{border:0;background:transparent;color:#0a66c2;font-size:11px;font-weight:700;cursor:pointer;padding:2px 0}',
      '#linkedin-bot-status-root .lb-pause-state{font-size:11px;font-weight:700;color:#0a66c2}',
      '#linkedin-bot-status-root .lb-recovery{max-height:0;opacity:0;overflow:hidden;padding:0 12px;border-bottom:1px solid rgba(0,0,0,0);background:rgba(255,248,230,.9);transition:max-height .45s ease,opacity .34s ease,padding .45s ease,border-color .34s ease}',
      '#linkedin-bot-status-root.lb-needs-action .lb-recovery{max-height:120px;opacity:1;padding:10px 12px;border-bottom-color:rgba(0,0,0,.08)}',
      '#linkedin-bot-status-root .lb-recovery-title{font-size:12px;font-weight:700;color:#1f2328;margin-bottom:4px}',
      '#linkedin-bot-status-root .lb-recovery-msg{font-size:11px;line-height:15px;color:#656d76;margin-bottom:8px;word-break:break-word}',
      '#linkedin-bot-status-root .lb-recovery-actions{display:flex;gap:8px;justify-content:flex-end}',
      '#linkedin-bot-status-root .lb-action-btn{height:26px;border:0;border-radius:14px;padding:0 10px;font-size:11px;font-weight:700;cursor:pointer;background:#0a66c2;color:#fff}',
      '#linkedin-bot-status-root .lb-action-btn.secondary{background:rgba(0,0,0,.08);color:#1f2328}',
      '#linkedin-bot-status-root .lb-panel-foot{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px 10px 22px}',
      '#linkedin-bot-status-root .lb-hint{font-size:11px;color:#656d76;line-height:15px;transition:color .34s ease,opacity .34s ease}',
      '#linkedin-bot-status-root .lb-bottom-btn{height:24px;border:0;border-radius:999px;padding:0 9px;background:#0a66c2;color:#fff;font-size:11px;font-weight:800;cursor:pointer;opacity:0;transform:translateY(5px);pointer-events:none;transition:opacity .34s ease,transform .34s ease,background-color .3s ease,box-shadow .3s ease}',
      '#linkedin-bot-status-root.lb-show-bottom .lb-bottom-btn{opacity:1;transform:translateY(0);pointer-events:auto}',
      '#linkedin-bot-status-root .lb-bottom-btn:hover{background:#004182;box-shadow:0 5px 14px rgba(10,102,194,.26)}',
      '#linkedin-bot-status-root .lb-timeline{position:relative;margin:0;padding:8px 12px 10px 22px;list-style:none;max-height:214px;overflow:auto;scroll-behavior:smooth}',
      '#linkedin-bot-status-root .lb-item{position:relative;padding:5px 0 7px 10px;animation:lbItemIn .32s ease both;transition:opacity .32s ease,transform .32s ease,color .32s ease}',
      "#linkedin-bot-status-root .lb-item:after{content:'';position:absolute;left:-9px;top:-8px;bottom:-8px;width:1px;background:rgba(10,102,194,.22);transition:background-color .34s ease}",
      "#linkedin-bot-status-root .lb-item:before{content:'';position:absolute;left:-12px;top:10px;width:7px;height:7px;border-radius:999px;background:#0a66c2;box-shadow:0 0 0 3px #fff;z-index:1;transition:background-color .34s ease,box-shadow .34s ease,transform .34s ease}",
      '#linkedin-bot-status-root .lb-item-time{font-size:10px;line-height:12px;color:#656d76}',
      '#linkedin-bot-status-root .lb-item-text{font-size:12px;line-height:16px;font-weight:600;color:#1f2328;word-break:break-word}',
      '#linkedin-bot-status-root .lb-item.active:before{background:#0a66c2}',
      '#linkedin-bot-status-root .lb-item.waiting:before{background:#b08000}',
      '#linkedin-bot-status-root .lb-item.success:before{background:#198038}',
      '#linkedin-bot-status-root .lb-item.failed:before{background:#cb2431}',
      '#linkedin-bot-status-root .lb-item.waiting .lb-item-text{color:#8a6300}',
      '#linkedin-bot-status-root .lb-item.success .lb-item-text{color:#198038}',
      '#linkedin-bot-status-root .lb-item.failed .lb-item-text{color:#cb2431}',
      '#linkedin-bot-status-root .lb-empty{padding:14px 12px;font-size:12px;color:#656d76}',
      '#linkedin-bot-status-root .active{border-color:rgba(10,102,194,.28)}',
      '#linkedin-bot-status-root .active .lb-dot{background:#0a66c2;animation:lbPulseBlue 1.8s infinite}',
      '#linkedin-bot-status-root .waiting{border-color:rgba(176,128,0,.32)}',
      '#linkedin-bot-status-root .waiting .lb-dot{background:#b08000;animation:lbPulseYellow 1.8s infinite}',
      '#linkedin-bot-status-root .success{border-color:rgba(25,128,56,.3)}',
      '#linkedin-bot-status-root .success .lb-dot{background:#198038}',
      '#linkedin-bot-status-root .failed{border-color:rgba(203,36,49,.3)}',
      '#linkedin-bot-status-root .failed .lb-dot{background:#cb2431}',
      '@keyframes lbItemIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes lbTooltipIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes lbPulseBlue{0%{box-shadow:0 0 0 0 rgba(10,102,194,.45)}70%{box-shadow:0 0 0 6px rgba(10,102,194,0)}100%{box-shadow:0 0 0 0 rgba(10,102,194,0)}}',
      '@keyframes lbPulseYellow{0%{box-shadow:0 0 0 0 rgba(176,128,0,.45)}70%{box-shadow:0 0 0 6px rgba(176,128,0,0)}100%{box-shadow:0 0 0 0 rgba(176,128,0,0)}}',
    ].join('');
    document.head.appendChild(style);
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
    root.innerHTML =
      '<div class="lb-card"><div class="lb-panel"><div class="lb-panel-head"><span>Status Timeline</span><span class="lb-panel-actions"><span class="lb-pause-state">Running</span><button class="lb-link-btn lb-clear-btn" type="button">Clear</button><button class="lb-link-btn lb-collapse-btn" type="button">Hide</button></span></div><div class="lb-recovery"><div class="lb-recovery-title">Search filters need attention</div><div class="lb-recovery-msg"></div><div class="lb-recovery-actions"><button class="lb-action-btn secondary lb-skip-btn" type="button">Skip this search</button><button class="lb-action-btn lb-retry-btn" type="button">Retry filters</button></div></div><ol class="lb-timeline"></ol><div class="lb-panel-foot"><div class="lb-hint">Pause stops the next bot step safely; resume continues from there.</div><button class="lb-bottom-btn" type="button" title="Jump to latest status">Bottom</button></div></div><div class="lb-status active"><span class="lb-dot"></span><span class="lb-text">Ready</span><span class="lb-actions"><button class="lb-icon-btn lb-expand-btn" type="button" title="Show status history"><span class="lb-chevron"></span></button><button class="lb-icon-btn lb-pause-btn" type="button" title="Pause bot"><span class="lb-pause-icon"></span></button></span></div></div>';
    document.body.appendChild(root);

    root.querySelector('.lb-expand-btn').addEventListener('click', function () {
      root.classList.remove('lb-compact');
      root.classList.toggle('lb-expanded');
      renderTimeline(root);
      requestAnimationFrame(function () {
        scrollTimelineToBottom(root, false);
      });
    });
    root.querySelector('.lb-pause-btn').addEventListener('click', function () {
      setPaused(!window.linkedinBotPaused);
    });
    root.querySelector('.lb-clear-btn').addEventListener('click', function () {
      window.linkedinBotStatusHistory = [];
      renderTimeline(root);
      updateBottomButton(root);
    });
    root
      .querySelector('.lb-collapse-btn')
      .addEventListener('click', function () {
        root.classList.remove('lb-expanded');
      });
    root.querySelector('.lb-retry-btn').addEventListener('click', function () {
      window.linkedinBotFilterAction = 'retry';
      clearFilterRecovery();
    });
    root.querySelector('.lb-skip-btn').addEventListener('click', function () {
      window.linkedinBotFilterAction = 'skip';
      clearFilterRecovery();
    });
    root.querySelector('.lb-bottom-btn').addEventListener('click', function () {
      scrollTimelineToBottom(root, true);
    });
    root.querySelector('.lb-timeline').addEventListener('scroll', function () {
      updateBottomButton(root);
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
    return list.scrollHeight - list.scrollTop - list.clientHeight < 8;
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
    window.setTimeout(function () {
      updateBottomButton(root);
    }, smooth ? 220 : 0);
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
        var type = item.type || statusClass(item.text);
        return (
          '<li class="lb-item ' +
          type +
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
  }

  function showFilterRecovery(message) {
    var root = ensureRoot();
    window.linkedinBotFilterAction = null;
    root.classList.remove('lb-compact');
    root.classList.add('lb-expanded', 'lb-needs-action');
    root.querySelector('.lb-recovery-msg').textContent =
      'Automatic retries did not finish this step. ' +
      String(message || 'Filter controls were not found.');
    renderTimeline(root, true);
  }

  function clearFilterRecovery() {
    var root = ensureRoot();
    root.classList.remove('lb-needs-action');
  }

  function setCompact(compact) {
    var root = ensureRoot();
    root.classList.toggle('lb-compact', !!compact);
    if (compact) root.classList.remove('lb-expanded');
  }

  function render(text) {
    if (!document.body) return;
    ensureStyle();
    var root = ensureRoot();
    var bubble = root.querySelector('.lb-status');
    var label = root.querySelector('.lb-text');
    var message = String(text || 'Ready');
    var cls = statusClass(message);
    bubble.className = 'lb-status is-visible ' + cls;
    label.textContent = message;
    label.title = message;
    bubble.setAttribute('data-full', message);
    addHistory(message);
    setPaused(!!window.linkedinBotPaused);
    if (root.classList.contains('lb-expanded')) renderTimeline(root, true);
    window.botStatus = message;
    window.botStatusTime = Date.now();
  }

  window.updateLinkedInBotStatus = render;
  window.setLinkedInBotPaused = setPaused;
  window.showLinkedInBotFilterRecovery = showFilterRecovery;
  window.clearLinkedInBotFilterRecovery = clearFilterRecovery;
  window.setLinkedInBotStatusCompact = setCompact;
  window.linkedinBotStatusVersion = widgetVersion;
  render(window.botStatus || 'Ready');
})();
