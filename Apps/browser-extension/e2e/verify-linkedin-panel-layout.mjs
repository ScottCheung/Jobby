import WebSocket from 'ws';

const debuggerUrl = process.env.CHROME_DEBUGGER_URL ?? 'http://127.0.0.1:9222';
const fixtureUrl = process.env.LINKEDIN_FIXTURE_URL;
const windowMode = process.env.JOBBY_E2E_WINDOW ?? 'popup';
const verifyMutualExclusion = process.env.JOBBY_E2E_VERIFY_MUTUAL === 'true';

if (windowMode === 'popup' && !fixtureUrl) {
  throw new Error('LINKEDIN_FIXTURE_URL is required for the popup test.');
}

async function targetFor(urlPart, openerId) {
  const targets = await fetch(`${debuggerUrl}/json/list`).then((res) => res.json());
  const target = targets.find(
    (item) =>
      item.type === 'page' &&
      item.url.includes(urlPart) &&
      (openerId === undefined || item.openerId === openerId),
  );
  if (!target) throw new Error(`No page target found for ${urlPart}.`);
  return target;
}

function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();

  socket.on('message', (data) => {
    const message = JSON.parse(data);
    const resolver = pending.get(message.id);
    if (!resolver) return;
    pending.delete(message.id);
    if (message.error) resolver.reject(new Error(message.error.message));
    else resolver.resolve(message.result);
  });

  return new Promise((resolve, reject) => {
    socket.once('open', () => {
      resolve({
        call(method, params = {}) {
          const id = ++nextId;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveCall, rejectCall) => {
            pending.set(id, { resolve: resolveCall, reject: rejectCall });
          });
        },
        close() {
          socket.close();
        },
      });
    });
    socket.once('error', reject);
  });
}

async function evaluate(client, expression, userGesture = false) {
  const result = await client.call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(client, expression, description) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

const pageTarget = await targetFor('linkedin-layout-fixture.html');
let activeTarget = pageTarget;

if (windowMode === 'popup') {
  const page = await connect(pageTarget);
  await evaluate(page, `void window.open(${JSON.stringify(fixtureUrl)}, 'jobby-e2e-popup', 'width=1200,height=900')`, true);

  let popupTarget;
  for (let attempts = 0; attempts < 40; attempts += 1) {
    const targets = await fetch(`${debuggerUrl}/json/list`).then((res) => res.json());
    const candidates = targets.filter(
      (item) =>
        item.type === 'page' &&
        item.url.includes('linkedin-layout-fixture.html') &&
        item.id !== pageTarget.id,
    );
    for (const candidate of candidates) {
      const candidateClient = await connect(candidate);
      const hasOpener = await evaluate(candidateClient, 'Boolean(window.opener)');
      candidateClient.close();
      if (hasOpener) {
        popupTarget = candidate;
        break;
      }
    }
    if (popupTarget) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  page.close();
  if (!popupTarget) throw new Error('The popup target did not open.');
  activeTarget = popupTarget;
}

const popup = await connect(activeTarget);
await waitFor(
  popup,
  `Boolean(document.getElementById('jobby-floating-ball-root')?.shadowRoot?.getElementById('jobby-ball-wrapper'))`,
  'the extension floating ball',
);

const ballCenter = await evaluate(
  popup,
  `(() => {
    const rect = document.getElementById('jobby-floating-ball-root').shadowRoot.getElementById('jobby-ball-wrapper').getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`,
);
await popup.call('Input.dispatchMouseEvent', {
  type: 'mousePressed',
  x: ballCenter.x,
  y: ballCenter.y,
  button: 'left',
  clickCount: 1,
});
await popup.call('Input.dispatchMouseEvent', {
  type: 'mouseReleased',
  x: ballCenter.x,
  y: ballCenter.y,
  button: 'left',
  clickCount: 1,
});
await waitFor(
  popup,
  `document.getElementById('jobby-in-page-sidepanel-root')?.shadowRoot?.getElementById('jobby-iframe-wrapper')?.classList.contains('is-visible') === true`,
  'the in-page panel to open',
);
await new Promise((resolve) => setTimeout(resolve, 900));

const openLayout = await evaluate(
  popup,
  `(() => {
    const panel = document.getElementById('jobby-in-page-sidepanel-root').shadowRoot.getElementById('jobby-iframe-wrapper').getBoundingClientRect();
    const app = document.getElementById('app__container').getBoundingClientRect();
    const nav = document.getElementById('global-nav').getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      panelLeft: panel.left,
      panelWidth: panel.width,
      appRight: app.right,
      navRight: nav.right,
      bodyPaddingRight: getComputedStyle(document.body).paddingRight,
    };
  })()`,
);

if (
  openLayout.panelWidth !== 380 ||
  Math.abs(openLayout.panelLeft - (openLayout.viewportWidth - 380)) > 1 ||
  openLayout.appRight > openLayout.panelLeft + 1 ||
  openLayout.navRight > openLayout.panelLeft + 1 ||
  openLayout.bodyPaddingRight !== '380px'
) {
  throw new Error(`Panel overlaps LinkedIn content: ${JSON.stringify(openLayout)}`);
}

let closedLayout;
if (verifyMutualExclusion) {
  if (windowMode !== 'normal') {
    throw new Error('Mutual-exclusion verification requires JOBBY_E2E_WINDOW=normal.');
  }
  const workerTarget = (await fetch(`${debuggerUrl}/json/list`).then((res) => res.json())).find(
    (target) => target.type === 'service_worker' && target.url.startsWith('chrome-extension://'),
  );
  if (!workerTarget) throw new Error('Extension service worker was not found.');
  const worker = await connect(workerTarget);
  await evaluate(worker, `chrome.tabs.query({ url: ${JSON.stringify(pageTarget.url)} }).then(([tab]) => {
    if (tab?.id === undefined) throw new Error('Fixture tab was not found.');
    // The content listener intentionally does not reply to this broadcast.
    // Do not await the no-response channel; delivery begins immediately.
    void chrome.tabs.sendMessage(tab.id, { type: 'sidepanel.state-changed', isOpen: true }).catch(() => undefined);
  })`);
  worker.close();
  await waitFor(
    popup,
    `!document.getElementById('jobby-in-page-sidepanel-root')`,
    'the in-page panel to be removed when the native panel opens',
  );
  await waitFor(
    popup,
    `Boolean(document.getElementById('jobby-floating-ball-root')?.shadowRoot?.getElementById('jobby-ball-wrapper'))`,
    'the floating-ball switch control after the native panel opens',
  );
} else {
  await evaluate(
    popup,
    `document.getElementById('jobby-in-page-sidepanel-root').shadowRoot.getElementById('close-tab').click()`,
    true,
  );
  await new Promise((resolve) => setTimeout(resolve, 900));
}

closedLayout = await evaluate(
  popup,
  `(() => ({
    appRight: document.getElementById('app__container').getBoundingClientRect().right,
    viewportWidth: window.innerWidth,
    bodyPaddingRight: getComputedStyle(document.body).paddingRight,
  }))()`,
);

if (
  Math.abs(closedLayout.appRight - closedLayout.viewportWidth) > 1 ||
  closedLayout.bodyPaddingRight !== '0px'
) {
  throw new Error(`LinkedIn layout did not restore: ${JSON.stringify(closedLayout)}`);
}

popup.close();
console.log(JSON.stringify({ windowMode, verifyMutualExclusion, openLayout, closedLayout }, null, 2));
