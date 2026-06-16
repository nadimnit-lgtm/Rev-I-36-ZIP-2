/**
 * Rev I-36 — Browser-based Android TV layout probe.
 *
 * Opens the packaged WebView app in a real Chromium engine at 1920x1080 and
 * 1366x768, renders known problem content in TV mode, and validates horizontal
 * containment, scroll safety, footer clearance, pop-out behaviour, and reading
 * layer states both OFF and ON.
 *
 * Usage: node tools/tv_layout_probe.mjs
 */
import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "app/src/main/assets");
const QA = path.join(ROOT, "qa-results");
fs.mkdirSync(QA, { recursive: true });

const OUTPUT_FILES = {
  log1920: "tv-layout-probe-1920x1080.log",
  log1366: "tv-layout-probe-1366x768.log",
  json1920: "tv-layout-probe-1920x1080.json",
  json1366: "tv-layout-probe-1366x768.json",
  summary: "tv-layout-probe-summary-rev-i-36.log",
  darkShot: "tv-screenshot-dark-1920x1080.png",
  lightShot: "tv-screenshot-light-1920x1080.png",
  fullLayersShot: "tv-screenshot-full-reading-layers.png",
};

const TEST_ITEMS = [
  "SubhanAllahi wa Bihamdihi",
  "Rabbana hab lana min ladunka",
  "Rabbana innana amanna",
  "Pleased with Allah as Lord",
  "Before Sleep In Your Name",
  "Ayat al-Kursi",
  "Fifth Kalima Istighfar",
  "ﷺ",
  "First Kalima",
];

const VIEWPORTS = [
  { width: 1920, height: 1080, name: "1920x1080" },
  { width: 1366, height: 768, name: "1366x768" },
];


function outputFileForViewport(vp, ext) {
  if (vp.name === "1920x1080" && ext === "log") return OUTPUT_FILES.log1920;
  if (vp.name === "1366x768" && ext === "log") return OUTPUT_FILES.log1366;
  if (vp.name === "1920x1080" && ext === "json") return OUTPUT_FILES.json1920;
  if (vp.name === "1366x768" && ext === "json") return OUTPUT_FILES.json1366;
  return `tv-layout-probe-${vp.name}.${ext}`;
}

const LAYER_MODES = [
  { name: "default-off", showTranslit: false, showEnglish: false, showUrdu: false, theme: "dark-ambient" },
  { name: "full-on", showTranslit: true, showEnglish: true, showUrdu: true, showTitle: true, theme: "dark-ambient" },
];

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  throw new Error("Chromium/Chrome executable not found. Set CHROME_BIN or install chromium.");
}

function contentType(p) {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (p.endsWith(".json")) return "application/json; charset=utf-8";
  if (p.endsWith(".ttf")) return "font/ttf";
  if (p.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      let rel = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      if (!rel) rel = "index.html";
      const file = path.resolve(ASSETS, rel);
      if (!file.startsWith(ASSETS) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end("Not found"); return;
      }
      res.writeHead(200, { "Content-Type": contentType(file), "Cache-Control": "no-store" });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      res.writeHead(500); res.end(String(e && e.stack || e));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForJson(url, attempts = 80) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      last = new Error("HTTP " + res.status);
    } catch (e) { last = e; }
    await wait(100);
  }
  throw last || new Error("Timed out waiting for " + url);
}

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.seq = 0;
    this.pending = new Map();
    this.events = [];
  }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result || {});
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }
  send(method, params = {}, sessionId = undefined) {
    const id = ++this.seq;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async close() { try { this.ws.close(); } catch {} }
}

async function launchChrome(debugPort) {
  const chrome = findChrome();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "azkar-tv-probe-"));
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ];
  const proc = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (d) => { stderr += d.toString(); });
  proc.stdout.on("data", () => {});
  return { proc, userDataDir, getStderr: () => stderr };
}

function jsString(v) { return JSON.stringify(v); }

async function evaluate(cdp, sid, expression, awaitPromise = true) {
  const out = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  }, sid);
  if (out.exceptionDetails) {
    throw new Error(out.exceptionDetails.text + ": " + JSON.stringify(out.exceptionDetails.exception?.description || out.exceptionDetails.exception?.value || ""));
  }
  return out.result ? out.result.value : undefined;
}

function validationExpression(query, mode) {
  return `
(async function(){
  const mode = ${jsString(mode)};
  const query = ${jsString(query)};
  if (!window.__azkarReady || !window.__azkarProbe) throw new Error('App/probe not ready');
  const result = window.__azkarProbe.showItem(query, mode);
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise(r => setTimeout(r, 80));

  const reader = document.querySelector('#reader');
  const sc = document.querySelector('#readerScroll');
  const footer = document.querySelector('.bottombar');
  if (!reader || !sc) throw new Error('Reader not found');
  const readerBox = reader.getBoundingClientRect();
  const footerBox = footer ? footer.getBoundingClientRect() : { top: innerHeight + 1 };
  const selectors = ['#mArabic', '#mTranslit', '#mTranslation', '#mUrdu', '.source-row'];
  const failures = [];
  const details = [];

  function visible(el) {
    if (!el) return false;
    const st = getComputedStyle(el);
    return !el.classList.contains('hidden') && st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0' && el.textContent.trim().length > 0;
  }
  function checkHorizontal(el, label) {
    const box = el.getBoundingClientRect();
    details.push({ label, left: Math.round(box.left), right: Math.round(box.right), top: Math.round(box.top), bottom: Math.round(box.bottom), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
    if (box.left < readerBox.left - 3) failures.push(label + ' left overflow');
    if (box.right > readerBox.right + 3) failures.push(label + ' right overflow');
    if (el.scrollWidth > el.clientWidth + 3) failures.push(label + ' horizontal scroll overflow');
  }

  const elements = selectors.map(sel => document.querySelector(sel)).filter(visible);
  elements.forEach((el) => checkHorizontal(el, el.id || el.className || el.tagName));

  const scrollable = sc.scrollHeight > sc.clientHeight + 24;
  if (!scrollable) {
    elements.forEach((el) => {
      const box = el.getBoundingClientRect();
      const label = el.id || el.className || el.tagName;
      if (box.top < readerBox.top - 3) failures.push(label + ' top overflow');
      if (box.bottom > readerBox.bottom + 3) failures.push(label + ' bottom clipping');
    });
  } else {
    const before = sc.scrollTop;
    sc.scrollTop = 0;
    await new Promise(r => requestAnimationFrame(r));
    const first = elements[0];
    if (first && first.getBoundingClientRect().top < readerBox.top - 3) failures.push('scroll top starts clipped');
    sc.scrollTop = sc.scrollHeight;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const visibleAtBottom = selectors.map(sel => document.querySelector(sel)).filter(visible).filter(el => {
      const b = el.getBoundingClientRect();
      return b.bottom > readerBox.top && b.top < readerBox.bottom;
    });
    const last = visibleAtBottom[visibleAtBottom.length - 1];
    if (last && last.getBoundingClientRect().bottom > readerBox.bottom + 3) failures.push('scroll bottom clips last visible card');
    sc.scrollTop = before;
  }

  if (readerBox.bottom > footerBox.top - 2) failures.push('reader collides with footer/progress bar');
  if (readerBox.left < 0 || readerBox.right > innerWidth) failures.push('reader outside viewport horizontally');
  if (readerBox.top < 0 || readerBox.bottom > innerHeight) failures.push('reader outside viewport vertically');

  const hiddenState = {
    translitHidden: document.querySelector('#mTranslit')?.classList.contains('hidden') || false,
    englishHidden: document.querySelector('#mTranslation')?.classList.contains('hidden') || false,
    urduHidden: document.querySelector('#mUrdu')?.classList.contains('hidden') || false,
    titleHidden: document.querySelector('#mTitle')?.classList.contains('hidden') || false,
  };
  if (mode.name === 'default-off') {
    if (!hiddenState.translitHidden) failures.push('default transliteration is visible');
    if (!hiddenState.englishHidden) failures.push('default English translation is visible');
    if (!hiddenState.urduHidden) failures.push('default Urdu translation is visible');
    if (!hiddenState.titleHidden) failures.push('default item name/title is visible');
  }
  if (mode.name === 'full-on') {
    if (hiddenState.translitHidden) failures.push('full mode transliteration hidden');
    if (hiddenState.englishHidden) failures.push('full mode English hidden');
    if (hiddenState.urduHidden) failures.push('full mode Urdu hidden');
    if (hiddenState.titleHidden) failures.push('full mode item name/title hidden');
  }

  return {
    ok: failures.length === 0,
    query,
    mode: mode.name,
    result,
    failures,
    scrollable,
    reader: { top: Math.round(readerBox.top), bottom: Math.round(readerBox.bottom), left: Math.round(readerBox.left), right: Math.round(readerBox.right), height: Math.round(readerBox.height) },
    hiddenState,
    details
  };
})()`;
}

async function runViewport(vp, appUrl, debugPort) {
  const browser = await launchChrome(debugPort);
  let cdp;
  const log = [];
  try {
    const version = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
    cdp = new CDP(version.webSocketDebuggerUrl);
    await cdp.open();
    const target = await cdp.send("Target.createTarget", { url: "about:blank" });
    const attach = await cdp.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    const sid = attach.sessionId;
    await cdp.send("Runtime.enable", {}, sid);
    await cdp.send("Page.enable", {}, sid);
    await cdp.send("Network.enable", {}, sid);
    await cdp.send("Network.setUserAgentOverride", { userAgent: "Mozilla/5.0 (Linux; Android 12; Panasonic TH-65MX740M Google TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 CrKey/1.56" }, sid);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: false }, sid);
    await cdp.send("Page.navigate", { url: appUrl }, sid);

    for (let i = 0; i < 100; i++) {
      const ready = await evaluate(cdp, sid, "Boolean(window.__azkarReady && window.__azkarProbe)", true).catch(() => false);
      if (ready) break;
      await wait(100);
      if (i === 99) {
        const diagnostic = await evaluate(cdp, sid, `(function(){
          const splash = document.querySelector('#splash');
          return {
            href: location.href,
            readyState: document.readyState,
            bodyClass: document.body ? document.body.className : '',
            azkarReady: Boolean(window.__azkarReady),
            probeType: typeof window.__azkarProbe,
            appType: typeof window.__azkar,
            splashText: splash ? splash.textContent.trim().slice(0, 500) : '',
            bodyText: document.body ? document.body.innerText.slice(0, 500) : ''
          };
        })()`, true).catch((e) => ({ diagnosticError: String(e && e.message || e) }));
        throw new Error("Timed out waiting for app readiness: " + JSON.stringify(diagnostic));
      }
    }

    const results = [];
    for (const mode of LAYER_MODES) {
      for (const query of TEST_ITEMS) {
        const result = await evaluate(cdp, sid, validationExpression(query, mode), true);
        results.push(result);
        log.push(`${result.ok ? 'PASS' : 'FAIL'} | ${vp.name} | ${mode.name} | ${query}${result.failures.length ? ' | ' + result.failures.join('; ') : ''}`);
      }
    }

    // Required screenshot evidence at 1920x1080.
    if (vp.width === 1920 && vp.height === 1080) {
      await evaluate(cdp, sid, validationExpression("Ayat al-Kursi", { name: "screenshot-dark", showTranslit: false, showEnglish: false, showUrdu: false, theme: "dark-ambient" }), true);
      let shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true }, sid);
      fs.writeFileSync(path.join(QA, OUTPUT_FILES.darkShot), Buffer.from(shot.data, "base64"));

      await evaluate(cdp, sid, validationExpression("Ayat al-Kursi", { name: "screenshot-light", showTranslit: false, showEnglish: false, showUrdu: false, theme: "elder-light" }), true);
      shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true }, sid);
      fs.writeFileSync(path.join(QA, OUTPUT_FILES.lightShot), Buffer.from(shot.data, "base64"));

      await evaluate(cdp, sid, validationExpression("Fifth Kalima Istighfar", { name: "screenshot-full", showTranslit: true, showEnglish: true, showUrdu: true, showTitle: true, theme: "dark-ambient" }), true);
      shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true }, sid);
      fs.writeFileSync(path.join(QA, OUTPUT_FILES.fullLayersShot), Buffer.from(shot.data, "base64"));
    }

    const fail = results.filter(r => !r.ok);
    fs.writeFileSync(path.join(QA, outputFileForViewport(vp, "json")), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(QA, outputFileForViewport(vp, "log")), log.join("\n") + "\n");
    if (fail.length) throw new Error(`${fail.length} TV layout probe failures at ${vp.name}. See qa-results/${outputFileForViewport(vp, "log")}`);
    return log;
  } finally {
    if (cdp) await cdp.close().catch(() => {});
    try { browser.proc.kill("SIGTERM"); } catch {}
    await wait(150);
    try { fs.rmSync(browser.userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  }
}

(async function main() {
  const { server, port } = await startServer();
  const appUrl = `http://127.0.0.1:${port}/index.html?tv=1`;
  const all = [];
  try {
    let debugPort = 9222 + Math.floor(Math.random() * 1000);
    for (const vp of VIEWPORTS) {
      const lines = await runViewport(vp, appUrl, debugPort++);
      all.push(...lines);
    }
    const summary = [
      "===== Rev I-36 TV Layout Probe =====",
      ...all,
      "RESULT: PASS",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(QA, OUTPUT_FILES.summary), summary);
    console.log(summary);
  } finally {
    server.close();
  }
})().catch((e) => {
  console.error("TV layout probe failed:");
  console.error(e && e.stack || e);
  process.exit(1);
});
