/**
 * Rev I-36 — Android TV boot-path and default-display DOM smoke test.
 *
 * Loads index.html + app.js in jsdom under a TV user agent, stubs fetch for the
 * two content JSON files, and asserts the app boots cleanly with no console
 * errors / null crashes. Run in CI BEFORE the Gradle APK build so a boot-path
 * regression fails fast instead of shipping in an APK.
 *
 * Usage:  node tools/dom_smoke.mjs   (run from the repository root)
 * Exit:   0 = pass, 1 = fail
 */
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "app/src/main/assets");

function readAsset(rel) {
  const p = path.join(ASSETS, rel);
  if (!fs.existsSync(p)) { console.error("MISSING ASSET: " + p); process.exit(1); }
  return fs.readFileSync(p, "utf8");
}

const indexHtml    = readAsset("index.html");
const appJs        = readAsset("app.js");
const contentJson  = readAsset("content/content.json");
const sectionsJson = readAsset("content/sections.json");

const TV_UA = "Mozilla/5.0 (Linux; Android 12; BRAVIA 4K GoogleTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 CrKey/1.56";

const errors = [];
const warns = [];

const dom = new JSDOM(indexHtml, {
  runScripts: "outside-only",
  pretendToBeVisual: true,
  url: "https://app.local/index.html?tv=1",
  userAgent: TV_UA,
});
const { window } = dom;

// --- environment shims jsdom lacks ---
window.matchMedia = window.matchMedia || function (q) {
  return { matches: false, media: q, onchange: null,
    addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return false; } };
};
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = (id) => clearTimeout(id);
Object.defineProperty(window.screen, "width",  { value: 1920, configurable: true });
Object.defineProperty(window.screen, "height", { value: 1080, configurable: true });
Object.defineProperty(window.navigator, "maxTouchPoints", { value: 0, configurable: true });
window.scrollTo = () => {};
if (!window.Element.prototype.scrollTo) window.Element.prototype.scrollTo = function () {};
if (!window.Element.prototype.scrollIntoView) window.Element.prototype.scrollIntoView = function () {};
window.HTMLCanvasElement.prototype.getContext = function () {
  return { measureText: () => ({ width: 10 }), fillText(){}, fillRect(){}, beginPath(){}, moveTo(){},
    lineTo(){}, stroke(){}, arc(){}, fill(){}, save(){}, restore(){}, translate(){}, scale(){},
    clearRect(){}, drawImage(){}, createLinearGradient: () => ({ addColorStop(){} }) };
};
window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
window.localStorage.clear();

window.fetch = (url) => {
  let body = "{}";
  if (String(url).includes("content.json")) body = contentJson;
  else if (String(url).includes("sections.json")) body = sectionsJson;
  return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(body)), text: () => Promise.resolve(body) });
};

window.addEventListener("error", (e) => errors.push("window.error: " + (e.error && e.error.stack || e.message)));
window.addEventListener("unhandledrejection", (e) => errors.push("unhandledrejection: " + (e.reason && e.reason.stack || e.reason)));
window.console.error = (...a) => errors.push("console.error: " + a.map(String).join(" "));
window.console.warn = (...a) => warns.push(a.map(String).join(" "));

try { window.eval(appJs); }
catch (e) { errors.push("eval(app.js) threw: " + (e.stack || e)); }

function dispatchKey(key) {
  const ev = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  (window.document.activeElement || window.document.body).dispatchEvent(ev);
  window.document.dispatchEvent(ev);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await wait(350);

  const assertions = [];
  const check = (name, cond) => { assertions.push({ name, ok: !!cond }); if (!cond) errors.push("ASSERT FAILED: " + name); };

  const body = window.document.body;
  check("window.__azkarReady is true (boot completed)", window.__azkarReady === true);
  check("body.tv applied (TV mode resolved)", body.classList.contains("tv"));

  const arabic = window.document.querySelector("#mArabic");
  check("reader Arabic (#mArabic) populated", arabic && arabic.textContent.trim().length > 0);

  const title = window.document.querySelector("#mTitle");
  check("reader title (#mTitle) present", !!title);

  const settingsBody = window.document.querySelector("#settingsSheet .sheet-body");
  const rows = settingsBody ? settingsBody.querySelectorAll(".tv-set-row").length : 0;
  check("TV settings rows built (.tv-set-row > 0)", rows > 0);

  const savedSettings = JSON.parse(window.localStorage.getItem("azkartv.v02.settings") || "{}");
  check("Rev I-36 TV settings migration marker saved", savedSettings.tvVisualRevision === "I-36-tv-visual-proof-layout-closure");
  check("Transliteration defaults OFF on TV", savedSettings.showTranslit === false);
  check("English translation defaults OFF on TV", savedSettings.showEnglish === false);
  check("Urdu translation defaults OFF on TV", savedSettings.showUrdu === false);
  check("Item name/title defaults OFF on TV", savedSettings.showTitle === false);

  const translit = window.document.querySelector("#mTranslit");
  const english = window.document.querySelector("#mTranslation");
  const urdu = window.document.querySelector("#mUrdu");
  check("Transliteration card hidden on first TV render", translit && translit.classList.contains("hidden"));
  check("English translation card hidden on first TV render", english && english.classList.contains("hidden"));
  check("Urdu translation card hidden on first TV render", urdu && urdu.classList.contains("hidden"));
  check("Item name/title hidden on first TV render", title && title.classList.contains("hidden"));

  let durationRow = false;
  if (settingsBody) settingsBody.querySelectorAll(".tv-set-name").forEach((n) => { if (/display duration/i.test(n.textContent)) durationRow = true; });
  check("Display Duration row exists", durationRow);

  const applyBtn = window.document.querySelector("#settingsSheet .btn-apply, .btn-apply");
  check("Save & Apply button exists", !!applyBtn);

  const ribbon = window.document.querySelector("#prayerRibbon");
  check("prayer header/ribbon mounts (no null crash)", !!ribbon);

  // exercise boot-sensitive key paths
  for (const k of ["ArrowRight","ArrowLeft","Enter","Enter","ArrowDown","ArrowUp","Escape"]) {
    try { dispatchKey(k); await wait(15); }
    catch (e) { errors.push("key '" + k + "' handler threw: " + (e.stack || e)); }
  }
  check("no console errors / null crashes across boot + key sequence", errors.length === 0);

  await wait(80);

  console.log("\n===== Rev I-36 DOM SMOKE TEST (Android TV mode) =====");
  assertions.forEach((a) => console.log((a.ok ? "  PASS  " : "  FAIL  ") + a.name));
  console.log("settings rows:", rows, "| warnings:", warns.length);
  if (errors.length) { console.log("\nERRORS:"); errors.forEach((e) => console.log("  [ERROR] " + e)); }
  console.log("\nRESULT: " + (errors.length === 0 ? "PASS" : "FAIL"));
  process.exit(errors.length === 0 ? 0 : 1);
})();
