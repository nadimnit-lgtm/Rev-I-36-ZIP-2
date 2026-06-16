/* ==========================================================================
   Dua & Zikr — Rev I-36 TV Visual Proof and Layout Closure
   Reading engine: categories (Azkar / Dua / Kalima), mixed flow, navigation,
   dynamic Arabic fit, settings, prayer ribbon. TV (D-pad) + touch + tablet.
   Offline-first. All assets served from the bundled appassets origin.
   ========================================================================== */
(function () {
  "use strict";

  var LS = "azkartv.v02.settings";
  var LS_POS = "azkartv.v02.pos";
  var LS_LOC = "azkartv.v02.loc";
  var LS_PRAYER = "azkartv.v02.prayer";
  var CATS = ["Azkar", "Dua", "Kalima", "Hajj & Umrah"];

  // Repeat may be null, undefined, a number, or a numeric string.
  function parseRepeat(v) {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return (isFinite(v) && v > 0) ? Math.floor(v) : 0;
    var n = parseInt(String(v).trim(), 10);
    return (isFinite(n) && n > 0) ? n : 0;
  }

  // Round-robin interleave Azkar -> Dua -> Kalima -> repeat. Exhausted lists
  // are skipped so the cycle keeps producing items until everything is used.
  function buildMixed(buckets) {
    var out = [], i = 0, remaining = CATS.reduce(function (n, c) { return n + buckets[c].length; }, 0);
    while (out.length < remaining) {
      for (var c = 0; c < CATS.length; c++) {
        var list = buckets[CATS[c]];
        if (i < list.length) out.push(list[i]);
      }
      i++;
      if (i > 5000) break; // hard safety
    }
    return out;
  }

  // Section browsing uses explicit content order when available. This keeps
  // Salah sections in prayer-flow order even after future content edits.
  function byDisplayOrder(a, b) {
    var ao = (typeof a.order === "number") ? a.order : ((typeof a.priority === "number") ? a.priority : 999999);
    var bo = (typeof b.order === "number") ? b.order : ((typeof b.priority === "number") ? b.priority : 999999);
    return ao - bo;
  }

  var THEMES = [
    { id: "dark-ambient",  name: "Dark",   a: "#0e1318", b: "#d8b25a" },
    { id: "elder-light",   name: "Light",  a: "#f5f3ec", b: "#1f6d4a" }
  ];

  var CITY_LABEL = { auto: "Auto", riyadh: "Riyadh", jeddah: "Jeddah", makkah: "Makkah", madinah: "Madinah", dammam: "Dammam" };
  var CITY_LABEL_UR = { auto: "خودکار", riyadh: "ریاض", jeddah: "جدہ", makkah: "مکہ", madinah: "مدینہ", dammam: "دمام" };
  function cityLabel(id) { return state && state.settings && state.settings.lang === "ur" ? (CITY_LABEL_UR[id] || CITY_LABEL[id] || id) : (CITY_LABEL[id] || id); }
  var APPROX = {
    riyadh:  { Fajr:"04:30", Dhuhr:"11:55", Asr:"15:20", Maghrib:"18:35", Isha:"20:05" },
    jeddah:  { Fajr:"04:45", Dhuhr:"12:10", Asr:"15:35", Maghrib:"18:50", Isha:"20:20" },
    makkah:  { Fajr:"04:42", Dhuhr:"12:08", Asr:"15:33", Maghrib:"18:48", Isha:"20:18" },
    madinah: { Fajr:"04:38", Dhuhr:"12:05", Asr:"15:28", Maghrib:"18:45", Isha:"20:15" },
    dammam:  { Fajr:"04:18", Dhuhr:"11:45", Asr:"15:10", Maghrib:"18:25", Isha:"19:55" }
  };
  var CITY_LABEL_EN = { auto:"Auto", riyadh:"Riyadh", jeddah:"Jeddah", makkah:"Makkah", madinah:"Madinah", dammam:"Dammam" };
  var CITY_COORDS = {
    riyadh:  { lat:24.7136, lng:46.6753, tz:3 },
    jeddah:  { lat:21.4858, lng:39.1925, tz:3 },
    makkah:  { lat:21.3891, lng:39.8579, tz:3 },
    madinah: { lat:24.5247, lng:39.5692, tz:3 },
    dammam:  { lat:26.4207, lng:50.0888, tz:3 }
  };

  var DEFAULTS = {
    theme: "dark-ambient",
    arabicScript: "uthmani",          // uthmani | indopak
    arabicFont: "scheherazade",       // scheherazade | amiri | reemkufi | nastaliq
    arScale: 0.7, tlScale: 1.0, trScale: 1.0,   // Arabic starts ~70%; other text 100%
    tvFit: true,                      // automatic per-device fit (no user toggle)
    easyView: false,                  // Simple mode OFF by default (full professional view)
    showArabic: true,
    showTranslit: false,
    showEnglish: false,
    showUrdu: false,
    showTranslation: false,            // legacy alias, kept for old saved settings
    showSource: false,                 // reference hidden by default
    showTitle: false,                  // item name/title optional; default OFF, user can enable from Settings
    showPauseMarks: true,
    showWaqfLegend: false,
    showRibbon: true, tajweed: false,
    prayerHeaderDetail: "minimal",       // TV only: off | minimal | standard | full
    showCopy: true,
    showShare: true,                   // Share restored on phone/tablet (hidden on TV)
    arabicWeight: "regular",           // regular weight by default (not bold)
    flowMode: "mixed",                // mixed (default) | category
    autoRotate: false, interval: 30,  // auto-advance off by default; TV first-launch enables 30 sec runtime
    city: "auto",
    lang: "en",                       // en | ar | ur
    bismillahSize: "large",
    bismillahColor: "olive",
    smartSentenceFlow: true,
    highContrast: false,
    showProgress: true,
    swipeNav: true,
    showTags: false,
    themeAccent: "olive",                 // TV only: olive | gold | green
    deviceProfile: "auto",                // auto | mobile | tablet | tv
    tvVisualRevision: "I-36-tv-visual-proof-layout-closure"              // TV-only visual settings migration marker
  };

  var AR_FONTS = {
    scheherazade: '"Scheherazade", "Amiri", "Noto Naskh Arabic", serif',
    amiri: '"Scheherazade", "Amiri", "Noto Naskh Arabic", serif',
    reemkufi: '"ReemKufi", "Scheherazade", sans-serif',
    nastaliq: '"NastaliqUrdu", "Scheherazade", serif'
  };

  function normalizeSettings(input) {
    var raw = (input && typeof input === "object" && !Array.isArray(input)) ? input : {};
    var s = Object.assign({}, DEFAULTS);
    Object.keys(DEFAULTS).forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(raw, k) && raw[k] !== null && raw[k] !== undefined) s[k] = raw[k];
    });

    function num(key, min, max, fallback) {
      var n = Number(s[key]);
      if (!isFinite(n)) n = fallback;
      s[key] = Math.min(max, Math.max(min, Math.round(n * 100) / 100));
    }
    num("arScale", IS_TV ? 0.7 : 0.7, IS_TV ? 1.45 : 2.0, DEFAULTS.arScale);
    num("tlScale", 0.75, 1.8, DEFAULTS.tlScale);
    num("trScale", 0.75, 1.8, DEFAULTS.trScale);
    num("interval", 5, 300, DEFAULTS.interval);
    if (IS_TV) {
      var tvDurations = [15, 30, 45, 60];
      if (tvDurations.indexOf(Number(s.interval)) < 0) s.interval = DEFAULTS.interval;
      s.smartSentenceFlow = true;
      if (s.theme !== "dark-ambient" && s.theme !== "elder-light") s.theme = "dark-ambient";
      s.highContrast = false;
      s.arabicFont = "scheherazade";
      if (!s.arabicScript) s.arabicScript = DEFAULTS.arabicScript;
    }

    ["showArabic", "showTranslit", "showEnglish", "showUrdu", "showTranslation", "showSource", "showTitle", "showPauseMarks", "showWaqfLegend", "showRibbon", "tajweed", "showCopy", "showShare", "tvFit", "easyView", "autoRotate", "smartSentenceFlow", "highContrast", "showProgress", "swipeNav", "showTags"].forEach(function (k) { s[k] = !!s[k]; });

    if (!["en", "ar", "ur"].includes(s.lang)) s.lang = DEFAULTS.lang;
    if (!["uthmani", "indopak", "naskh"].includes(s.arabicScript)) s.arabicScript = DEFAULTS.arabicScript;
    if (!["scheherazade", "amiri", "reemkufi", "nastaliq"].includes(s.arabicFont)) s.arabicFont = DEFAULTS.arabicFont;
    if (!["regular", "thick"].includes(s.arabicWeight)) s.arabicWeight = DEFAULTS.arabicWeight;
    if (!["mixed", "category"].includes(s.flowMode)) s.flowMode = DEFAULTS.flowMode;
    if (!["auto", "riyadh", "jeddah", "makkah", "madinah", "dammam"].includes(s.city)) s.city = DEFAULTS.city;
    if (!["off", "minimal", "standard", "full"].includes(s.prayerHeaderDetail)) s.prayerHeaderDetail = DEFAULTS.prayerHeaderDetail;
    if (!["normal", "small", "medium", "large", "xl"].includes(s.bismillahSize)) s.bismillahSize = DEFAULTS.bismillahSize;
    if (!["olive", "gold", "dark"].includes(s.bismillahColor)) s.bismillahColor = DEFAULTS.bismillahColor;
    if (!["olive", "gold", "green"].includes(s.themeAccent)) s.themeAccent = DEFAULTS.themeAccent;
    if (!["auto", "mobile", "tablet", "tv"].includes(s.deviceProfile)) s.deviceProfile = DEFAULTS.deviceProfile;
    if (typeof s.tvVisualRevision !== "string") s.tvVisualRevision = DEFAULTS.tvVisualRevision;
    if (!THEMES.some(function (th) { return th.id === s.theme; })) s.theme = DEFAULTS.theme;

    // Legacy single translation switch remains mapped to English visibility.
    s.showTranslation = !!s.showEnglish;
    return s;
  }

  function ensureSettings() {
    state.settings = normalizeSettings(state.settings);
    return state.settings;
  }

  function ensureDraft() {
    state.draft = normalizeSettings(state.draft || state.settings);
    return state.draft;
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var IS_TV = (function () {
    if (/[?&]tv=1\b/.test(location.search)) return true;
    var ua = navigator.userAgent || "";
    if (/Google TV|Android TV|Leanback|AFT[A-Z]|BRAVIA|SmartTV|Smart-TV|HbbTV|NetCast|Web0S|webOS|Tizen|CrKey|Chromecast|DTV|\bTV\b/i.test(ua)) return true;
    try {
      var noFine = !matchMedia("(any-pointer:fine)").matches;
      var noTouch = !("ontouchstart" in window) && (navigator.maxTouchPoints || 0) === 0;
      var big = Math.min(screen.width || 0, screen.height || 0) >= 600;
      if (noFine && noTouch && big) return true;   // remote-only large display
    } catch (e) {}
    return false;
  })();

  /* ---- i18n: English / Urdu UI -------------------------------------------- */
  var I18N = {
    en: {
      nowReading:"", mixedFlow:"Mixed Flow", mixedSub:"Azkar → Dua → Kalima, cycling",
      whatToRead:"What to read", singleCategory:"Single category", browseSection:"Browse by section",
      category:"Category", section:"Section", settings:"Settings", saveApply:"Save & Apply",
      close:"Close", share:"Share", copied:"Copied", shareTextCopied:"Share text copied",
      shareUnavailable:"Share not available", settingsSaved:"Settings saved", noMatchingDuas:"No matching du’as",
      noSectionContent:"No content is available in this section.", noViewContent:"No content is available for this view.",
      approx:"approx", unavailable:"Unavailable", lastSaved:"Last saved", online:"Online", approximate:"Approximate", autoLocation:"Auto location", locating:"Locating…", myLocation:"My location", selectedCity:"Selected city", prayerUnavailable:"Prayer time unavailable",
      scroll:"scroll ⌄", prev:"Previous", next:"Next", menu:"Menu", auto:"AUTO", reference:"Reference",
      grpDisplay:"Display", grpContent:"Content visibility", grpNavigation:"Navigation", grpPrayer:"Prayer", grpAbout:"About", openAbout:"Open About page",
      language:"Language", languageDesc:"App language for the interface and translation.",
      theme:"Theme", themeDesc:"Calm palettes. High Contrast aids low vision. Live preview on tap.",
      simpleMode:"Simple mode (large text & buttons)", simpleModeDesc:"Bigger Arabic, buttons and spacing — easiest to read and operate.",
      fitTv:"Fit full content on screen (TV)", fitTvDesc:"On: shrink text so the whole dua fits one TV screen with no scrolling. Off: larger fixed text that scrolls.",
      arabicTypeface:"Arabic typeface", arabicTypefaceDesc:"Font style for the hero Arabic text. Live preview on change.",
      arabicWeight:"Arabic Font Weight", arabicWeightDesc:"Regular is calmer; Thick is easier from distance. Live preview on change.",
      arabicTextSize:"Arabic text size", arabicTextSizeDesc:"Hero Arabic text size.",
      translationFont:"Translation font", translationFontDesc:"English and Urdu translation size.",
      transliterationFont:"Transliteration font", transliterationFontDesc:"Latin transliteration size.",
      showArabic:"Show Arabic", showArabicDesc:"Arabic text remains the main reading layer.",
      showTranslit:"Show transliteration", showTranslitDesc:"Latin reading aid below Arabic.",
      showEnglish:"Show English translation", showEnglishDesc:"English meaning block.",
      showUrdu:"Show Urdu translation", showUrduDesc:"Urdu meaning block when available.",
      showSource:"Show reference", showSourceDesc:"Surah, ayah or hadith reference at the bottom.",
      showPauseMarks:"Show Qur’an Pause Marks", showPauseMarksDesc:"Display Waqf signs exactly as preserved in Qur’anic Arabic.",
      showWaqfLegend:"Show Waqf Legend", showWaqfLegendDesc:"Show a compact pause-mark guide here in Settings only.",
      waqfLegend:"Waqf legend", waqfLegendDesc:"Qur’anic pause signs used for reading.",
      tajweed:"Tajweed colouring", tajweedDesc:"Applies only to Qur’anic items when enabled.",
      defaultFlow:"Default flow", defaultFlowDesc:"Mixed cycles Azkar → Dua → Kalima. Single category stays in one group.",
      autoRotation:"Auto-rotation", autoRotationDesc:"Advance items automatically. Long-press the card, or press OK on TV, to pause.",
      rotationInterval:"Rotation interval", rotationIntervalDesc:"Seconds per item when auto-rotation is on.",
      copyButton:"Copy button", copyButtonDesc:"Show a copy control on each card. Hidden on TV.",
      shareButton:"Share button", shareButtonDesc:"Share the current card as a PNG through Android share sheet on phone/tablet. Hidden on TV.",
      prayerRibbon:"Compact prayer ribbon", prayerRibbonDesc:"Slim next-prayer strip under the top bar.",
      location:"Location", locationDesc:"Prayer times follow wherever you are; no need to pick a city.",
      liveLocationNote:"Automatic — based on your live GPS / network location.",
      aboutHtml:'<strong>Dua & Zikr — TV Reading Edition.</strong> A calm, offline Islamic reading app for phones, tablets and Android TV. Content shows one remembrance at a time with Arabic as the focus, optional transliteration, English and Urdu translation, Qur’an pause-mark support, and a source reference.<br><br>Content is organised into three categories — Azkar, Dua and Kalima — and can be read as a mixed flow or one category at a time. Every entry carries a source and a verification flag. Sources have not yet been confirmed by a qualified scholar, so treat the content as provisional until reviewed. Tajweed colouring is available for Qur’anic items as a conservative visual foundation pending final review.<br><br>Prayer times use online calculation when connected. If accurate auto-location data is unavailable, the ribbon shows unavailable or last saved instead of silently using a wrong city.',
      contentVersion:"Content version", lastUpdated:"Last updated", canonicalItems:"Canonical items", sectionReferences:"Section references", fontNote:"Arabic uses Scheherazade New; Urdu uses Noto Nastaliq Urdu (both SIL OFL).", reviewBadge:"Content review status: pending scholarly review",
      optEnglish:"English", optUrdu:"Urdu", optRegular:"Regular", optThick:"Thick", optMixed:"Mixed flow", optByCategory:"By category", optOn:"On", optOff:"Off",
      fontScheherazade:"Scheherazade (Naskh)", fontAmiri:"Amiri (Madinah-style)", fontReem:"Reem Kufi (modern)", fontNastaliq:"Noto Nastaliq (Indo-Pak)",
      theme_elder_dark:"Elder Ease Dark", theme_elder_light:"Elder Ease Light", theme_dark_ambient:"Dark Ambient", theme_gold_navy:"Gold & Navy", theme_haram_light:"Haram Light", theme_green_classic:"Green Classic", theme_high_contrast:"High Contrast", theme_sepia:"Sepia",
      grpReadingDisplay:"1. Reading & Display", grpAppearance:"2. Appearance", grpContentCategories:"3. Content & Categories", grpPrayerBar:"4. Prayer Bar", grpLanguage:"5. Language", grpNavigationExperience:"6. Navigation & Experience",
      bismillahSize:"Bismillah size", bismillahSizeDesc:"Larger display for Bismillah.", bismillahColor:"Bismillah color", bismillahColorDesc:"Darker olive / gold tone.", smartSentenceFlow:"Smart sentence flow", smartSentenceFlowDesc:"Better Arabic line wrapping.", waqfPauseSigns:"Waqf & pause signs", waqfPauseSignsDesc:"Show waqf and pause helpers where appropriate.", showTranslitShort:"Transliteration", showTranslationShort:"Translation", showUrduShort:"Urdu translation", contentCatsDesc:"Hajj & Umrah is added as a section and tag without duplicate duas.", manageTags:"Manage Tags", cityLocation:"City / Location", connectionStatus:"Connection status", highContrastMode:"High contrast mode", highContrastModeDesc:"Improve readability.", scriptUthmani:"Uthmani", scriptIndopak:"Indo-Pak", optLight:"Light", optDarkAmbient:"Aurora", optSepia:"Sepia", swipeNavigation:"Swipe navigation", swipeNavigationDesc:"Left / Right to navigate.", showTagsOnDisplay:"Show Tags on Display", showTagsOnDisplayDesc:"Show category tags on the reading card.", pageProgressIndicator:"Page progress indicator", pageProgressIndicatorDesc:"Show reading progress.", optArabic:"Arabic",
      vQuran:"Qur’an", vHadith:"Hadith — source cited", vCompilation:"Traditional — unverified", searchDuas:"Search du’as by name…",
      prayer_Fajr:"Fajr", prayer_Dhuhr:"Dhuhr", prayer_Asr:"Asr", prayer_Maghrib:"Maghrib", prayer_Isha:"Isha"
    },
    ur: {
      nowReading:"", mixedFlow:"مخلوط مطالعہ", mixedSub:"اذکار ← دعا ← کلمہ، باری باری",
      whatToRead:"کیا پڑھیں", singleCategory:"ایک زمرہ", browseSection:"حصوں کے مطابق دیکھیں",
      category:"زمرہ", section:"حصہ", settings:"ترتیبات", saveApply:"محفوظ کریں",
      close:"بند کریں", share:"شیئر", copied:"کاپی ہو گیا", shareTextCopied:"شیئر متن کاپی ہو گیا",
      shareUnavailable:"شیئر دستیاب نہیں", settingsSaved:"ترتیبات محفوظ ہو گئیں", noMatchingDuas:"کوئی دعا نہیں ملی",
      noSectionContent:"اس حصے میں مواد دستیاب نہیں۔", noViewContent:"اس منظر کے لیے مواد دستیاب نہیں۔",
      approx:"تقریباً", unavailable:"دستیاب نہیں", lastSaved:"آخری محفوظ", online:"آن لائن", approximate:"تقریبی", autoLocation:"خودکار مقام", locating:"مقام تلاش ہو رہا ہے…", myLocation:"میرا مقام", selectedCity:"منتخب شہر", prayerUnavailable:"نماز کا وقت دستیاب نہیں",
      scroll:"سکرول ⌄", prev:"پچھلا", next:"اگلا", menu:"مینو", auto:"خودکار", reference:"حوالہ",
      grpDisplay:"ڈسپلے", grpContent:"مواد کی نمائش", grpNavigation:"نیویگیشن", grpPrayer:"نماز", grpAbout:"تعارف", openAbout:"تعارف کھولیں",
      language:"زبان", languageDesc:"ایپ کے انٹرفیس اور ترجمے کی زبان۔",
      theme:"تھیم", themeDesc:"پرسکون رنگ۔ ہائی کنٹراسٹ کمزور نظر کے لیے بہتر ہے۔",
      simpleMode:"آسان موڈ (بڑا متن اور بٹن)", simpleModeDesc:"بڑی عربی، بڑے بٹن اور زیادہ جگہ — پڑھنا اور چلانا آسان۔",
      fitTv:"ٹی وی پر مکمل مواد فٹ کریں", fitTvDesc:"آن: دعا کو ایک ٹی وی اسکرین میں فٹ کرنے کے لیے متن کم کیا جائے۔ آف: بڑا متن سکرول کے ساتھ۔",
      arabicTypeface:"عربی خط", arabicTypefaceDesc:"مرکزی عربی متن کا فونٹ۔ تبدیلی پر فوری پیش منظر۔",
      arabicWeight:"عربی فونٹ وزن", arabicWeightDesc:"Regular پرسکون؛ Thick دور سے آسان۔ تبدیلی پر فوری پیش منظر۔",
      arabicTextSize:"عربی متن کا سائز", arabicTextSizeDesc:"مرکزی عربی متن کا سائز۔",
      translationFont:"ترجمہ فونٹ", translationFontDesc:"انگریزی اور اردو ترجمے کا سائز۔",
      transliterationFont:"تلفظ فونٹ", transliterationFontDesc:"لاطینی تلفظ کا سائز۔",
      showArabic:"عربی دکھائیں", showArabicDesc:"عربی متن مرکزی پڑھنے والی تہہ رہے گا۔",
      showTranslit:"تلفظ دکھائیں", showTranslitDesc:"عربی کے نیچے لاطینی تلفظ۔",
      showEnglish:"انگریزی ترجمہ دکھائیں", showEnglishDesc:"انگریزی معنی کا حصہ۔",
      showUrdu:"اردو ترجمہ دکھائیں", showUrduDesc:"دستیاب ہونے پر اردو معنی کا حصہ۔",
      showSource:"حوالہ دکھائیں", showSourceDesc:"سورہ، آیت یا حدیث کا حوالہ نیچے دکھائیں۔",
      showPauseMarks:"قرآنی وقف علامات دکھائیں", showPauseMarksDesc:"قرآنی عربی میں محفوظ وقف علامات دکھائیں۔",
      showWaqfLegend:"وقف رہنما دکھائیں", showWaqfLegendDesc:"ترتیبات میں مختصر وقف علامات کی رہنمائی دکھائیں۔",
      waqfLegend:"وقف رہنما", waqfLegendDesc:"قرآنی پڑھائی میں استعمال ہونے والی وقف علامات۔",
      tajweed:"تجوید رنگ", tajweedDesc:"فعال ہونے پر صرف قرآنی items پر لاگو ہوتا ہے۔",
      defaultFlow:"ابتدائی ترتیب", defaultFlowDesc:"مخلوط ترتیب: اذکار ← دعا ← کلمہ۔ ایک زمرہ اسی گروپ میں رہتا ہے۔",
      autoRotation:"خودکار تبدیلی", autoRotationDesc:"آئٹمز خود آگے بڑھیں۔ کارڈ کو دیر تک دبائیں، یا ٹی وی پر OK دبائیں۔",
      rotationInterval:"تبدیلی کا وقفہ", rotationIntervalDesc:"خودکار تبدیلی میں ہر آئٹم کے سیکنڈ۔",
      copyButton:"کاپی بٹن", copyButtonDesc:"ہر کارڈ پر کاپی کنٹرول دکھائیں۔ ٹی وی پر پوشیدہ۔",
      shareButton:"شیئر بٹن", shareButtonDesc:"فون/ٹیبلٹ پر موجودہ کارڈ PNG کے طور پر Android share sheet سے شیئر کریں۔ ٹی وی پر پوشیدہ۔",
      prayerRibbon:"مختصر نماز پٹی", prayerRibbonDesc:"اوپر والی بار کے نیچے اگلی نماز کی مختصر پٹی۔",
      location:"مقام", locationDesc:"نماز کے اوقات مقام کے مطابق رہیں گے؛ شہر منتخب کرنے کی ضرورت نہیں۔",
      liveLocationNote:"خودکار — آپ کے GPS / نیٹ ورک مقام کے مطابق۔",
      aboutHtml:'<strong>Dua & Zikr — TV Reading Edition.</strong> فون، ٹیبلٹ اور Android TV کے لیے ایک پرسکون، آف لائن اسلامی مطالعہ ایپ۔ ہر کارڈ میں عربی متن مرکزی حیثیت رکھتا ہے، ساتھ میں اختیاری تلفظ، انگریزی اور اردو ترجمہ، قرآنی وقف علامات اور حوالہ شامل ہے۔<br><br>مواد تین بڑے زمروں — اذکار، دعا اور کلمہ — میں منظم ہے، اور اسے مخلوط ترتیب یا ایک زمرے کے طور پر پڑھا جا سکتا ہے۔ ہر اندراج میں حوالہ اور تصدیقی نشان موجود ہے۔ حتمی علمی تصدیق ابھی باقی ہے، اس لیے مواد کو حتمی عالم دین کے جائزے تک عارضی سمجھا جائے۔ قرآنی items کے لیے تجوید رنگ بطور محتاط بنیاد موجود ہے۔<br><br>انٹرنیٹ دستیاب ہو تو نماز کے اوقات آن لائن حساب سے آتے ہیں۔ اگر درست خودکار مقام دستیاب نہ ہو تو ایپ غلط شہر خاموشی سے استعمال نہیں کرتی بلکہ unavailable یا last saved دکھاتی ہے۔',
      contentVersion:"مواد ورژن", lastUpdated:"آخری اپ ڈیٹ", canonicalItems:"اصل آئٹمز", sectionReferences:"حصہ حوالہ جات", fontNote:"عربی کے لیے Scheherazade New؛ اردو کے لیے Noto Nastaliq Urdu استعمال ہوتا ہے۔", reviewBadge:"مواد جائزہ: علمی تصدیق باقی ہے",
      optEnglish:"English", optUrdu:"اردو", optRegular:"Regular", optThick:"Thick", optMixed:"مخلوط مطالعہ", optByCategory:"زمرہ کے مطابق", optOn:"آن", optOff:"آف",
      fontScheherazade:"Scheherazade (نسخ)", fontAmiri:"Amiri (مدنی انداز)", fontReem:"Reem Kufi (جدید)", fontNastaliq:"Noto Nastaliq (ہند و پاک)",
      theme_elder_dark:"بزرگ آسانی — ڈارک", theme_elder_light:"بزرگ آسانی — لائٹ", theme_dark_ambient:"ڈارک ایمبیئنٹ", theme_gold_navy:"سنہرا اور نیوی", theme_haram_light:"حرم لائٹ", theme_green_classic:"سبز کلاسک", theme_high_contrast:"ہائی کنٹراسٹ", theme_sepia:"سیپیا",
      grpReadingDisplay:"1. پڑھائی اور ڈسپلے", grpAppearance:"2. ظاہری شکل", grpContentCategories:"3. مواد اور زمرے", grpPrayerBar:"4. نماز پٹی", grpLanguage:"5. زبان", grpNavigationExperience:"6. نیویگیشن",
      bismillahSize:"بسم اللہ سائز", bismillahSizeDesc:"بسم اللہ کو بڑا دکھائیں۔", bismillahColor:"بسم اللہ رنگ", bismillahColorDesc:"گہرا زیتونی / سنہری رنگ۔", smartSentenceFlow:"سمارٹ جملہ بہاؤ", smartSentenceFlowDesc:"عربی لائن بریک بہتر بنائیں۔", waqfPauseSigns:"وقف اور توقف علامات", waqfPauseSignsDesc:"مناسب وقف اور توقف دکھائیں۔", showTranslitShort:"تلفظ", showTranslationShort:"ترجمہ", showUrduShort:"اردو ترجمہ", contentCatsDesc:"حج اور عمرہ کو نقل کے بغیر سیکشن اور ٹیگ کے طور پر شامل کیا گیا۔", manageTags:"ٹیگز سنبھالیں", cityLocation:"شہر / مقام", connectionStatus:"کنیکشن حالت", highContrastMode:"ہائی کنٹراسٹ", highContrastModeDesc:"مطالعہ آسان بنائیں۔", scriptUthmani:"عثمانی", scriptIndopak:"ہند و پاک", optLight:"لائٹ", optDarkAmbient:"آورا", optSepia:"سیپیا", swipeNavigation:"سوائپ نیویگیشن", swipeNavigationDesc:"بائیں / دائیں چلائیں۔", showTagsOnDisplay:"ٹیگز دکھائیں", showTagsOnDisplayDesc:"پڑھائی کارڈ پر زمرہ ٹیگز دکھائیں۔", pageProgressIndicator:"صفحہ پیشرفت", pageProgressIndicatorDesc:"مطالعہ پیشرفت دکھائیں۔", optArabic:"عربی",
      vQuran:"قرآن", vHadith:"حدیث — حوالہ درج", vCompilation:"روایتی — غیر مصدقہ", searchDuas:"نام سے دعا تلاش کریں…",
      prayer_Fajr:"فجر", prayer_Dhuhr:"ظہر", prayer_Asr:"عصر", prayer_Maghrib:"مغرب", prayer_Isha:"عشاء"
    }
  };

  I18N.ar = Object.assign({}, I18N.en, {
    mixedFlow:"تدفق مختلط", whatToRead:"ماذا تقرأ", singleCategory:"قسم واحد", browseSection:"التصفح حسب القسم",
    category:"القسم", section:"القسم", settings:"الإعدادات", saveApply:"حفظ وتطبيق", close:"إغلاق",
    prev:"السابق", next:"التالي", menu:"القائمة", auto:"تلقائي", reference:"المرجع", online:"متصل", approximate:"تقريبي", unavailable:"غير متاح",
    grpReadingDisplay:"1. القراءة والعرض", grpAppearance:"2. المظهر", grpContentCategories:"3. المحتوى والأقسام", grpPrayerBar:"4. شريط الصلاة", grpLanguage:"5. اللغة", grpNavigationExperience:"6. التنقل والتجربة",
    arabicTextSize:"حجم النص العربي", bismillahSize:"حجم البسملة", bismillahColor:"لون البسملة", smartSentenceFlow:"تدفق الجمل الذكي", waqfPauseSigns:"علامات الوقف والتوقف", showTranslitShort:"النطق اللاتيني", showTranslationShort:"الترجمة",
    theme:"النمط", optLight:"فاتح", optDarkAmbient:"داكن هادئ", optSepia:"سيبيا", scriptUthmani:"عثماني", scriptIndopak:"هند باك", highContrastMode:"تباين عالٍ",
    language:"اللغة", optEnglish:"English", optUrdu:"اردو", optArabic:"العربية", prayerRibbon:"شريط الصلاة", cityLocation:"المدينة / الموقع", connectionStatus:"حالة الاتصال",
    autoRotation:"التدوير التلقائي", swipeNavigation:"التنقل بالسحب", showTagsOnDisplay:"إظهار الوسوم", showTagsOnDisplayDesc:"إظهار وسوم القسم على البطاقة.", pageProgressIndicator:"مؤشر التقدم", manageTags:"إدارة الوسوم", contentCatsDesc:"تمت إضافة الحج والعمرة كقسم ووسم دون تكرار الأدعية.",
    prayer_Fajr:"الفجر", prayer_Dhuhr:"الظهر", prayer_Asr:"العصر", prayer_Maghrib:"المغرب", prayer_Isha:"العشاء"
  });

  var CATEGORY_UR = {
    "Azkar":"اذکار", "Dua":"دعا", "Kalima":"کلمہ", "Quranic Duas":"قرآنی دعائیں", "Daily Life Duas":"روزمرہ دعائیں",
    "Morning Azkar":"صبح کے اذکار", "Evening Azkar":"شام کے اذکار", "Before Salah":"نماز سے پہلے", "Inside Salah":"نماز کے اندر",
    "After Salah Azkar":"نماز کے بعد اذکار", "Before Sleep Azkar":"سونے سے پہلے اذکار", "Protection and Ruqyah":"حفاظت اور رقیہ",
    "Istighfar":"استغفار", "Salawat":"درود و سلام", "Hajj & Umrah":"حج اور عمرہ"
  };
  var TYPE_UR = { "Dua":"دعا", "Azkar":"ذکر", "Kalima":"کلمہ", "Istighfar":"استغفار", "Salawat":"درود", "Guidance":"رہنمائی" };
  var CATEGORY_AR = { "Azkar":"الأذكار", "Dua":"الدعاء", "Kalima":"الكلمات", "Quranic Duas":"أدعية قرآنية", "Daily Life Duas":"أدعية يومية", "Morning Azkar":"أذكار الصباح", "Evening Azkar":"أذكار المساء", "After Salah Azkar":"أذكار بعد الصلاة", "Before Sleep Azkar":"أذكار النوم", "Protection and Ruqyah":"الوقاية والرقية", "Istighfar":"الاستغفار", "Salawat":"الصلاة على النبي", "Hajj & Umrah":"الحج والعمرة", "Guidance":"إرشاد" };
  var TYPE_AR = { "Dua":"دعاء", "Azkar":"ذكر", "Kalima":"كلمة", "Istighfar":"استغفار", "Salawat":"صلاة", "Guidance":"إرشاد" };
  var TITLE_UR = {};
  function localizeCategory(v) { return state.settings.lang === "ur" ? (CATEGORY_UR[v] || TYPE_UR[v] || v || "") : (state.settings.lang === "ar" ? (CATEGORY_AR[v] || TYPE_AR[v] || v || "") : (v || "")); }
  function localizeType(v) { return state.settings.lang === "ur" ? (TYPE_UR[v] || CATEGORY_UR[v] || v || "") : (state.settings.lang === "ar" ? (TYPE_AR[v] || CATEGORY_AR[v] || v || "") : (v || "")); }
  function localizeSectionMeta(meta) {
    if (!meta) return "";
    if (state.settings.lang === "ur") return meta.label_ur || CATEGORY_UR[meta.label] || meta.label || meta.key || "";
    return meta.label || meta.key || "";
  }
  function rawLocalizedTitle(it) { return state.settings.lang === "ur" ? (it.title_ur || TITLE_UR[it.title] || it.title || "") : (it.title || ""); }
  function safeDisplayTitle(it, rawTitle) {
    var title = String(rawTitle || "").replace(/[_\-]{2,}/g, " ").replace(/\s+/g, " ").trim();
    var bad = !title || /(?:^|\b)(?:hajj_umrah|dua_|azkar_|zikr_|dhikr_|section_|content_|item_)/i.test(title) || /_[a-z0-9]+/i.test(title) || /[a-f0-9]{8,}/i.test(title) || title.length > (IS_TV ? 54 : 80);
    var generic = /^(dua|du'a|duas|azkar|adhkar|zikr|dhikr|supplication|prayer|general)$/i.test(title);
    if (bad || generic) {
      var cat = it && (it.category || it.main_category || it.type);
      return cat ? localizeCategory(cat) : "";
    }
    return title;
  }
  function localizeTitle(it) { return safeDisplayTitle(it, rawLocalizedTitle(it)); }
  function localizePrayerName(name) { return t("prayer_" + name) || name; }

  function t(k) {
    var L = I18N[state.settings.lang] || I18N.en;
    return (k in L) ? L[k] : (k in I18N.en ? I18N.en[k] : k);
  }
  function applyLang() {
    var rtl = state.settings.lang === "ur" || state.settings.lang === "ar";
    document.documentElement.setAttribute("lang", state.settings.lang || "en");
    document.body.setAttribute("data-lang", state.settings.lang);
    document.body.dir = rtl ? "rtl" : "ltr";
    $$("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    $$("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"))); });
    $$("[data-i18n-ph]").forEach(function (el) { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
  }

  var state = {
    content: null, sections: null,
    canonicalItems: [],          // one unique dua/zikr record only
    sectionItems: [],            // virtual display records created from sectionRefs
    allItems: [],
    buckets: { Azkar: [], Dua: [], Kalima: [], "Hajj & Umrah": [] },
    playlist: [], index: 0,
    view: { mode: "mixed", category: "Azkar", section: null }, // mode: mixed|category|section
    settings: load(), draft: null, autoTimer: null,
    pendingScrollTop: 0, scrollTimer: null,
    tvSettingsNav: null,
    autoPaused: false,
    tvPopoutDismissedItemId: null
  };

  function load() {
    var repaired = false;
    try {
      var stored = localStorage.getItem(LS);
      var raw = stored ? JSON.parse(stored) : {};
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) { raw = {}; repaired = true; }
      var s = normalizeSettings(raw);
      if (IS_TV) {
        var rawAr = Number(raw.arScale);
        var needsVisualReset = raw.tvVisualRevision !== "I-36-tv-visual-proof-layout-closure";
        // Rev I-36: keep valid saved user size, but default optional reading layers OFF so the TV starts clean.
        if (!isFinite(rawAr) || rawAr > 1.45 || rawAr < 0.7) { s.arScale = 0.7; repaired = true; }
        if (!raw.bismillahSize || raw.bismillahSize === "large" || raw.bismillahSize === "xl") { s.bismillahSize = "small"; repaired = true; }
        if (!Object.prototype.hasOwnProperty.call(raw, "interval") || [15,30,45,60].indexOf(Number(raw.interval)) < 0) { s.interval = 30; repaired = true; }
        if (needsVisualReset) {
          s.showTranslit = false;
          s.showEnglish = false;
          s.showUrdu = false;
          s.showTranslation = false;
          s.showTitle = false;
          repaired = true;
        }
        if (s.theme !== "dark-ambient" && s.theme !== "elder-light") { s.theme = "dark-ambient"; s.highContrast = false; repaired = true; }
        s.smartSentenceFlow = true;
        s.arabicFont = "scheherazade";
        s.tvVisualRevision = "I-36-tv-visual-proof-layout-closure";
        // Existing saved manual/off preference remains honored; fresh TV launch starts auto rotation.
        if (!Object.prototype.hasOwnProperty.call(raw, "autoRotate")) { s.autoRotate = true; repaired = true; }
      }
      // Backward compatibility with older versions that used one translation switch.
      if (!("showEnglish" in raw) && ("showTranslation" in raw)) { s.showEnglish = !!raw.showTranslation; repaired = true; }
      if (!("showUrdu" in raw)) { s.showUrdu = DEFAULTS.showUrdu; repaired = true; }
      if (!("showSource" in raw)) { s.showSource = DEFAULTS.showSource; repaired = true; }
      if (!("showTitle" in raw)) { s.showTitle = IS_TV ? false : DEFAULTS.showTitle; repaired = true; }
      if (!("showArabic" in raw)) { s.showArabic = true; repaired = true; }
      if (!("showPauseMarks" in raw)) { s.showPauseMarks = true; repaired = true; }
      if (IS_TV && raw.tvVisualRevision !== "I-36-tv-visual-proof-layout-closure") {
        s.showTranslit = false;
        s.showEnglish = false;
        s.showUrdu = false;
        s.showTitle = false;
      }
      s.showTranslation = !!s.showEnglish;
      s = normalizeSettings(s);
      if (repaired) localStorage.setItem(LS, JSON.stringify(s));
      return s;
    } catch (e) {
      var safe = normalizeSettings(DEFAULTS);
      if (IS_TV) { safe.arScale = 0.7; safe.bismillahSize = "small"; safe.interval = 30; safe.autoRotate = true; safe.theme = "dark-ambient"; safe.highContrast = false; safe.smartSentenceFlow = true; safe.showTranslit = false; safe.showEnglish = false; safe.showUrdu = false; safe.showTranslation = false; safe.showTitle = false; safe.tvVisualRevision = "I-36-tv-visual-proof-layout-closure"; }
      try { localStorage.setItem(LS, JSON.stringify(safe)); } catch (e2) {}
      return safe;
    }
  }
  function save() { try { state.settings = normalizeSettings(state.settings); localStorage.setItem(LS, JSON.stringify(state.settings)); } catch (e) {} }
  function savePos() {
    try {
      var sc = $("#readerScroll");
      var cur = state.playlist[state.index] || null;
      localStorage.setItem(LS_POS, JSON.stringify({
        view: state.view,
        index: state.index,
        itemId: cur ? (cur.display_id || cur.id) : null,
        scrollTop: sc ? sc.scrollTop : 0
      }));
    } catch (e) {}
  }

  /* ---- boot -------------------------------------------------------------- */
  function boot() {
    ensureSettings();
    if (IS_TV) {
      document.body.classList.add("tv");
      if (!state.settings.deviceProfile || state.settings.deviceProfile === "auto") state.settings.deviceProfile = "tv";
      mountTvPrayerRibbon();
    }
    Promise.all([
      fetch("content/content.json").then(function (r) { return r.json(); }),
      fetch("content/sections.json").then(function (r) { return r.json(); })
    ]).then(function (res) {
      state.content = res[0];
      state.sections = res[1];
      indexContent();
      applyBodyFlags();
      applyTheme(state.settings.theme);
      applyLang();
      buildViewList();
      buildSettings();
      bindGlobal();
      restorePosition();
      rebuildPlaylist(true);
      setupPrayer();
      refreshConnDot();
      window.__azkarReady = true;
      setTimeout(function () { var s = $("#splash"); s.classList.add("gone"); setTimeout(function () { s.remove(); }, 500); }, 1700);
    }).catch(function (err) {
      var s = $("#splash"); if (s) s.innerHTML = '<div style="color:var(--muted);font-size:14px;padding:24px;text-align:center">Unable to load content.<br>' + (err && err.message || "") + '</div>';
    });
  }

  function getSectionRefs(it) {
    if (Array.isArray(it.sectionRefs) && it.sectionRefs.length) return it.sectionRefs;
    return [{
      section: it.section,
      category: it.category,
      type: it.type,
      main_category: it.main_category,
      title: it.title,
      source: it.source,
      repeat: it.repeat,
      order: it.order,
      priority: it.priority
    }];
  }

  function displayRecord(it, ref) {
    var out = Object.assign({}, it);
    out.canonical_id = it.id;
    out.display_id = it.id + "@" + (ref.section || it.section);
    out.section = ref.section || it.section;
    out.category = ref.category || it.category;
    out.type = ref.type || it.type;
    out.main_category = ref.main_category || it.main_category;
    out.title = ref.title || it.title;
    out.source = ref.source || it.source;
    out.repeat = ("repeat" in ref) ? ref.repeat : it.repeat;
    out.order = (typeof ref.order === "number") ? ref.order : it.order;
    out.priority = (typeof ref.priority === "number") ? ref.priority : it.priority;
    return out;
  }

  function indexContent() {
    var secOrder = {};
    (state.sections.sections || []).forEach(function (s, i) { secOrder[s.key] = i; });

    state.canonicalItems = (state.content.items || []).slice().sort(function (a, b) {
      var ar = getSectionRefs(a)[0] || {}, br = getSectionRefs(b)[0] || {};
      var as = (typeof secOrder[ar.section || a.section] === "number") ? secOrder[ar.section || a.section] : 999999;
      var bs = (typeof secOrder[br.section || b.section] === "number") ? secOrder[br.section || b.section] : 999999;
      if (as !== bs) return as - bs;
      return byDisplayOrder(displayRecord(a, ar), displayRecord(b, br));
    });

    state.sectionItems = [];
    state.canonicalItems.forEach(function (it) {
      getSectionRefs(it).forEach(function (ref) { state.sectionItems.push(displayRecord(it, ref)); });
    });
    state.sectionItems.sort(function (a, b) {
      var as = (typeof secOrder[a.section] === "number") ? secOrder[a.section] : 999999;
      var bs = (typeof secOrder[b.section] === "number") ? secOrder[b.section] : 999999;
      if (as !== bs) return as - bs;
      return byDisplayOrder(a, b);
    });

    state.allItems = state.canonicalItems;
    state.buckets = {}; CATS.forEach(function (c) { state.buckets[c] = []; });
    state.canonicalItems.forEach(function (it) {
      var c = it.main_category;
      if (CATS.indexOf(c) < 0) c = (it.type === "Kalima") ? "Kalima" : (it.type === "Dua" ? "Dua" : (hasTagOrRef(it, "Hajj & Umrah") ? "Hajj & Umrah" : "Azkar"));
      if (!state.buckets[c]) state.buckets[c] = [];
      state.buckets[c].push(it);
    });
  }

  /* ---- body flags (theme-independent classes) ---------------------------- */
  function applyBodyFlags() {
    ensureSettings();
    document.body.classList.toggle("easy", !!state.settings.easyView);
    document.body.classList.toggle("no-copy", !state.settings.showCopy || IS_TV);
    document.body.classList.toggle("no-share", !state.settings.showShare || IS_TV);
    document.body.classList.toggle("hide-progress", state.settings.showProgress === false);
    document.body.classList.toggle("show-tags", !!state.settings.showTags);
    document.body.classList.toggle("tv-accent-gold", state.settings.themeAccent === "gold");
    document.body.classList.toggle("tv-accent-green", state.settings.themeAccent === "green");
    document.body.classList.toggle("tv-accent-olive", state.settings.themeAccent !== "gold" && state.settings.themeAccent !== "green");
    var prayerDetail = state.settings.prayerHeaderDetail || DEFAULTS.prayerHeaderDetail;
    document.body.setAttribute("data-tv-prayer-detail", prayerDetail);
    document.body.classList.toggle("tv-prayer-hidden", state.settings.showRibbon === false || (IS_TV && prayerDetail === "off"));
    document.body.classList.toggle("profile-tv", (state.settings.deviceProfile || (IS_TV ? "tv" : "auto")) === "tv");
    document.body.classList.toggle("profile-tablet", state.settings.deviceProfile === "tablet");
    document.body.classList.toggle("profile-mobile", state.settings.deviceProfile === "mobile");
  }

  function applyTheme(id) { document.body.setAttribute("data-theme", id); }

  // Rev I-6: TV only. Move the prayer ribbon into the header flex row so it
  // cannot overlap A-/A+/theme/settings controls on real Android TV panels.
  function mountTvPrayerRibbon() {
    if (!IS_TV) return;
    var top = $(".topbar"), ribbon = $("#prayerRibbon"), arSize = $("#arSize");
    if (top && ribbon && ribbon.parentElement !== top) {
      top.insertBefore(ribbon, arSize || $("#contrastBtn") || $("#openSettings") || null);
    }
  }

  function normToken(v) { return String(v || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9؀-ۿ]+/g, "_").replace(/^_+|_+$/g, ""); }
  function hasTagOrRef(it, cat) {
    var want = normToken(cat), tags = it && it.tags || [], refs = it && it.sectionRefs || [];
    if (normToken(it.category) === want || normToken(it.main_category) === want || normToken(it.section) === want || (cat === "Hajj & Umrah" && it.section === "hajj_umrah")) return true;
    for (var i = 0; i < tags.length; i++) if (normToken(tags[i]) === want || (cat === "Hajj & Umrah" && normToken(tags[i]) === "hajj_umrah")) return true;
    for (var r = 0; r < refs.length; r++) {
      if (normToken(refs[r].category) === want || normToken(refs[r].main_category) === want || (cat === "Hajj & Umrah" && refs[r].section === "hajj_umrah")) return true;
    }
    return false;
  }
  function categoryPlaylist(cat) {
    if (cat === "Hajj & Umrah") return state.sectionItems.filter(function (it) { return it.section === "hajj_umrah" || hasTagOrRef(it, cat); }).sort(byDisplayOrder);
    var base = (state.buckets[cat] || []).slice();
    var seen = {}; base.forEach(function (it) { seen[it.id] = true; });
    state.canonicalItems.forEach(function (it) { if (!seen[it.id] && hasTagOrRef(it, cat)) { base.push(it); seen[it.id] = true; } });
    return base.sort(byDisplayOrder);
  }

  /* ---- playlist (mixed / category / section) ----------------------------- */
  function rebuildPlaylist(keepIndex) {
    var v = state.view, pl;
    if (v.mode === "mixed") pl = buildMixed(state.buckets);
    else if (v.mode === "category") pl = categoryPlaylist(v.category);
    else pl = state.sectionItems.filter(function (it) { return it.section === v.section; }).sort(byDisplayOrder);
    state.emptyMessage = "";
    if (!pl.length) {
      state.emptyMessage = v.mode === "section" ? t("noSectionContent") : t("noViewContent");
      state.playlist = []; state.index = 0;
      updateViewLabel(); markViewList(); render(); savePos();
      return;
    }
    state.playlist = pl;
    if (!keepIndex || state.index >= pl.length || state.index < 0) state.index = 0;
    updateViewLabel();
    markViewList();
    render();
    savePos();
  }

  function viewLabel() {
    var v = state.view;
    if (v.mode === "mixed") return t("mixedFlow");
    if (v.mode === "category") return localizeCategory(v.category);
    var meta = (state.sections.sections || []).filter(function (s) { return s.key === v.section; })[0];
    return meta ? localizeSectionMeta(meta) : v.section;
  }
  function updateViewLabel() {
    $("#curView").textContent = viewLabel();
    var eb = $("#viewEyebrow");
    if (eb) eb.textContent = state.view.mode === "category" ? t("category") : t("section");
  }

  /* ---- view picker list -------------------------------------------------- */
  function buildViewList() {
    var wrap = $("#secList"); wrap.innerHTML = "";

    // Mixed flow (primary, default)
    var mix = document.createElement("button");
    mix.className = "sec-item primary"; mix.setAttribute("data-view", "mixed");
    mix.innerHTML = '<span class="sec-name">' + esc(t("mixedFlow")) + '<div class="sec-sub">' + esc(t("mixedSub")) + '</div></span><span class="sec-count">' + state.canonicalItems.length + '</span>';
    mix.addEventListener("click", function () { setView({ mode: "mixed" }); closeSheets(); });
    wrap.appendChild(mix);

    // Categories
    var ch = document.createElement("div"); ch.className = "sec-head"; ch.textContent = t("singleCategory"); wrap.appendChild(ch);
    CATS.forEach(function (c) {
      var n = categoryPlaylist(c).length; if (!n) return;
      var b = document.createElement("button");
      b.className = "sec-item"; b.setAttribute("data-view", "category:" + c);
      b.innerHTML = '<span class="sec-name">' + esc(localizeCategory(c)) + '</span><span class="sec-count">' + n + '</span>';
      b.addEventListener("click", function () { setView({ mode: "category", category: c }); closeSheets(); });
      wrap.appendChild(b);
    });

    // Sections (fine-grained browse)
    var sh = document.createElement("div"); sh.className = "sec-head"; sh.textContent = t("browseSection"); wrap.appendChild(sh);
    (state.sections.sections || []).forEach(function (s) {
      if (!s.count) return;
      var b = document.createElement("button");
      b.className = "sec-item"; b.setAttribute("data-view", "section:" + s.key);
      b.innerHTML = '<span class="sec-name">' + esc(localizeSectionMeta(s)) + '</span><span class="sec-count">' + s.count + '</span>';
      b.addEventListener("click", function () { setView({ mode: "section", section: s.key }); closeSheets(); });
      wrap.appendChild(b);
    });
  }
  function markViewList() {
    var v = state.view;
    var token = v.mode === "mixed" ? "mixed" : v.mode === "category" ? ("category:" + v.category) : ("section:" + v.section);
    $$(".sec-item").forEach(function (el) { el.classList.toggle("active", el.getAttribute("data-view") === token); });
  }
  function setView(v) {
    state.view = { mode: v.mode, category: v.category || state.view.category, section: v.section || state.view.section };
    state.settings.flowMode = (v.mode === "mixed") ? "mixed" : state.settings.flowMode;
    rebuildPlaylist(false);
  }

  /* ---- Qur'an Waqf / Rumuz al-Waqf rendering ----------------------------- */
  var WAQF_SIGNS = ["۝", "۩", "۞", "؞"];
  var WAQF_TOKEN_RE = /(^|[\s\u00a0،؛:؛\(\[\{])((?:قلى)|(?:صلى)|(?:لا)|[مجطزصقسع])(?=$|[\s\u00a0،؛:؛\.\)\]\}])/g;
  function hasWaqfSigns(text) {
    text = String(text || "");
    return /[۝۩۞؞]/.test(text) || WAQF_TOKEN_RE.test(text);
  }
  function isQuranicItem(it) {
    var src = String((it && it.source) || "").toLowerCase();
    var ver = String((it && it.verification) || "").toLowerCase();
    var tags = (it && it.tags || []).join(" ").toLowerCase();
    return ver === "quran" || src.indexOf("quran") >= 0 || tags.indexOf("quran") >= 0;
  }
  // Priority 6: suppress the card Bismillah row only when the item authentically
  // opens with the Basmalah, or is explicitly flagged, so it is never duplicated.
  var BASMALAH_NORM = "بسماللهالرحمنالرحيم";
  function normalizeArabic(s) {
    return String(s || "")
      .replace(/[\u064B-\u0652\u0670\u0653-\u065F\u06D6-\u06ED\u200C\u200D\u00A0]/g, "")
      .replace(/[\u0671\u0623\u0625\u0622]/g, "\u0627")
      .replace(/\s+/g, "");
  }
  function suppressCardBismillah(it) {
    return !!(it && it.hide_card_bismillah === true);
  }
  function escHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function cleanArabicParagraph(text) {
    text = String(text || "").replace(/[\u00a0\u2000-\u200b\u2028\u2029]+/g, " ");
    if (!IS_TV && state.settings.smartSentenceFlow === false) return text.trim();
    return text.replace(/\s*[\r\n]+\s*/g, " ").replace(/[ \t]{2,}/g, " ").trim();
  }
  function renderArabicWithWaqf(text, showMarks) {
    text = cleanArabicParagraph(text);
    if (!showMarks) return escHtml(stripWaqfForDisplay(text));
    var html = escHtml(text);
    html = html.replace(WAQF_TOKEN_RE, function (m, pre, sign) {
      return pre + '<span class="waqf-mark" title="Qur’an pause mark">\u2060' + sign + '</span>';
    });
    html = html.replace(/([۝۩۞؞])/g, '<span class="waqf-mark ayah" title="Qur’an pause mark">\u2060$1</span>');
    return html;
  }
  function renderArabicReading(text) {
    text = cleanArabicParagraph(text);
    var html = escHtml(text);
    if (state.settings.showPauseMarks === false) return html;
    return html.replace(/([،؛۔])/g, '<span class="pause-symbol" aria-hidden="true">$1</span>');
  }
  function renderTajweedFallback(text) {
    text = cleanArabicParagraph(text);
    var q = "قطبجد";
    var out = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i), nx = text.charAt(i + 1), nx2 = text.charAt(i + 2);
      var safe = escHtml(ch);
      if ("ۚۖۗۙۛۜۘ۞۩۝؞".indexOf(ch) >= 0) out += '<span class="waqf-mark ayah">' + safe + '</span>';
      else if (ch === "ٓ" || ch === "ٰ" || ("اوىي".indexOf(ch) >= 0 && i > 0)) out += '<span class="tw-madd">' + safe + '</span>';
      else if ((ch === "ن" || ch === "م") && (nx === "ّ" || nx2 === "ّ")) out += '<span class="tw-ghunnah">' + safe + '</span>';
      else if (q.indexOf(ch) >= 0 && nx === "ْ") out += '<span class="tw-qalqalah">' + safe + '</span>';
      else out += safe;
    }
    return out;
  }

  function stripWaqfForDisplay(text) {
    // Display-only hiding. The source database string remains unchanged.
    var out = String(text || "").replace(/[۝۩۞؞]/g, "");
    out = out.replace(WAQF_TOKEN_RE, function (m, pre) { return pre; });
    return out.replace(/\s{2,}/g, " ").trim();
  }
  function waqfLegendHtml() {
    return '<div class="waqf-legend" dir="ltr">' +
      '<div><b>۝</b><span>End of Ayah</span></div>' +
      '<div><b>م</b><span>Must stop</span></div>' +
      '<div><b>لا</b><span>Do not stop</span></div>' +
      '<div><b>ج</b><span>Stop or continue allowed</span></div>' +
      '<div><b>قلى</b><span>Better to stop</span></div>' +
      '<div><b>صلى</b><span>Better to continue</span></div>' +
      '<div><b>س</b><span>Brief pause without breath</span></div>' +
      '<div><b>؞ ؞</b><span>Stop at one of the paired places</span></div>' +
      '<div><b>۩</b><span>Sajdah Tilawah</span></div>' +
      '</div>';
  }

  /* ---- rendering --------------------------------------------------------- */
  function tvArabicFloor(mode) {
    if (!IS_TV) return 0;
    return ({ short: 52, normal: 46, long: 34, very_long: 30 })[mode] || 42;
  }

function autoSize(mode, scale) {
  ensureSettings();
  scale = Number(scale); if (!isFinite(scale)) scale = DEFAULTS.arScale;
  var base;
  if (IS_TV) {
    // Rev I-21: TV-safe baseline with final visual-quality pop-out containment; fit uses available space first, then shrinks only to safe floors.
    base = { short: 62, normal: 56, long: 48, very_long: 42 }[mode] || 52;
  } else {
    base = { short: 46, normal: 36, long: 30, very_long: 25 }[mode] || 34;
  }
  var w = window.innerWidth, h = window.innerHeight, minDim = Math.min(w, h);
  if (!IS_TV) {
    if (minDim >= 820) base += 8;
    else if (minDim >= 680) base += 4;
  }
  if (h < 460) base = Math.round(base * 0.72);
  else if (h < 560) base = Math.round(base * 0.85);
  if (state.settings.easyView) base = Math.round(base * 1.12);
  if (!IS_TV && state.settings.arabicScript === "indopak") base = Math.round(base * 1.06);
  var out = Math.round(base * scale);
  if (IS_TV) out = Math.max(tvArabicFloor(mode), out);
  return out;
}


  function tvIsPopoutMode(mode) {
    return IS_TV && (mode === "long" || mode === "very_long");
  }

  function stripHtmlForLength(v) {
    return String(v || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  function tvShouldStartPopout(it) {
    if (!IS_TV || !it) return false;
    var mode = it.size_mode || "normal";
    if (tvIsPopoutMode(mode)) return true;
    var ar = cleanArabicParagraph(stripHtmlForLength(it.arabic || ""));
    var tl = stripHtmlForLength(it.transliteration || "");
    var en = stripHtmlForLength(it.translation || "");
    var ur = stripHtmlForLength(it.translation_ur || "");
    var total = ar.length + tl.length + en.length + ur.length;
    return ar.length > 170 || (ar.length > 120 && total > 520) || total > 760;
  }

  function applyTvReadingMode(it) {
    var reader = $("#reader");
    if (!reader) return false;
    if (!IS_TV || !it) {
      document.body.classList.remove("tv-reading-popout", "tv-reader-can-scroll", "tv-popout-translations-two-col");
      reader.classList.remove("popout", "can-scroll");
      reader.setAttribute("data-popout", "false");
      return false;
    }
    var mode = it.size_mode || "normal";
    var itemKey = currentItemKey(it);
    var popout = tvShouldStartPopout(it) && state.tvPopoutDismissedItemId !== itemKey;
    document.body.classList.toggle("tv-reading-popout", popout);
    reader.classList.toggle("popout", popout);
    reader.setAttribute("data-popout", popout ? "true" : "false");
    return popout;
  }

  function tvFitMinimums(mode) {
    return {
      ar: ({ short: 52, normal: 46, long: 34, very_long: 30 })[mode] || 42,
      tl: 18,
      tr: 18,
      lhMin: mode === "very_long" ? 1.42 : (mode === "long" ? 1.46 : 1.50),
      gapMin: mode === "very_long" ? 0.58 : (mode === "long" ? 0.64 : 0.75)
    };
  }

  function setImportantStyle(el, prop, value) {
    if (!el) return;
    if (IS_TV) el.style.setProperty(prop, value, "important");
    else el.style.setProperty(prop, value);
  }

  function updateTvScrollState(sc) {
    var reader = $("#reader");
    var overflow = !!(sc && sc.scrollHeight > sc.clientHeight + 24);
    if (reader) reader.classList.toggle("can-scroll", overflow);
    document.body.classList.toggle("tv-reader-can-scroll", overflow);
    return overflow;
  }

  function render() {
    ensureSettings();
    var it = state.playlist[state.index];
    if (!it) { renderEmptyState(); return; }
    var s = state.settings, reader = $("#reader");
    reader.setAttribute("data-size", it.size_mode);
    applyTvReadingMode(it);
    var sc0 = $("#readerScroll");
    if (sc0) sc0.scrollTop = Math.max(0, state.pendingScrollTop || 0);

    var ar = autoSize(it.size_mode, s.arScale);
    reader.style.setProperty("--ar-size", ar + "px");
    // Nastaliq needs a much taller line box than Naskh.
    reader.style.setProperty("--ar-lh", IS_TV ? "1.58" : (s.arabicScript === "indopak" ? "1.72" : "1.34"));
    var tvAdd = IS_TV ? 4 : 0;
    var tl0 = Math.round(((it.size_mode === "short" ? 18 : 16) + tvAdd) * s.tlScale);
    var tr0 = Math.round(((it.size_mode === "short" ? 19 : 17) + tvAdd) * s.trScale);
    reader.style.setProperty("--tl-size", tl0 + "px");
    reader.style.setProperty("--tr-size", tr0 + "px");

    var arEl = $("#mArabic");
    var bism = $("#mBismillah");
    if (bism) bism.classList.toggle("hidden", suppressCardBismillah(it));
    arEl.setAttribute("data-script", s.arabicScript);
    arEl.setAttribute("data-weight", s.arabicWeight || "thick");
    arEl.style.fontFamily = IS_TV ? AR_FONTS.scheherazade : ((s.arabicScript === "indopak") ? AR_FONTS.nastaliq : (AR_FONTS[s.arabicFont] || AR_FONTS.scheherazade));
    var bis = $("#mBismillah"); if (bis) { bis.setAttribute("data-bismillah-size", s.bismillahSize || "small"); bis.setAttribute("data-bismillah-color", s.bismillahColor || "olive"); }
    // Tajweed colouring. Qur'anic items use bundled, reviewed markup; all other
    // content uses the rule-based fallback highlighter. Source Arabic is never altered.
    if (s.showArabic === false) { arEl.innerHTML = ""; arEl.classList.add("hidden"); arEl.classList.remove("tajweed-active"); }
    else {
      arEl.classList.remove("hidden");
      var useTajweed = !!s.tajweed;
      arEl.classList.toggle("tajweed-active", useTajweed);
      if (useTajweed && it.tajweed_html) arEl.innerHTML = it.tajweed_html;
      else if (useTajweed) arEl.innerHTML = renderTajweedFallback(it.arabic);
      else if (isQuranicItem(it)) arEl.innerHTML = renderArabicWithWaqf(it.arabic, s.showPauseMarks !== false);
      else arEl.innerHTML = renderArabicReading(it.arabic);
    }

    $("#mCategory").textContent = localizeCategory(it.category);
    $("#mType").textContent = localizeType(it.type);
    var titleTxt = localizeTitle(it);
    $("#mTitle").textContent = titleTxt;
    $("#mTitle").classList.toggle("hidden", !titleTxt || s.showTitle === false);
    $("#mFlowTag").textContent = (state.view.mode === "mixed") ? localizeCategory(it.main_category || "") : "";

    // Visibility is independent: Arabic, transliteration, English, Urdu and reference.
    setLine("#mTranslit", it.transliteration, s.showTranslit);
    var trEl = $("#mTranslit"); if (trEl) trEl.setAttribute("dir", "ltr");
    setLine("#mTranslation", it.translation, s.showEnglish !== false);
    var tnEl = $("#mTranslation"); if (tnEl) { tnEl.setAttribute("dir", "ltr"); tnEl.classList.remove("ur-text"); }
    setLine("#mUrdu", it.translation_ur, s.showUrdu !== false);
    var urEl = $("#mUrdu"); if (urEl) { urEl.setAttribute("dir", "rtl"); urEl.classList.add("ur-text"); }
    var side = $("#reader .side-zone");
    var twoTranslations = IS_TV && !!it.translation && !!it.translation_ur && s.showEnglish !== false && s.showUrdu !== false;
    if (side) side.classList.toggle("two-translation", twoTranslations);
    document.body.classList.toggle("tv-popout-translations-two-col", !!(twoTranslations && document.body.classList.contains("tv-reading-popout")));
    $("#mSource").textContent = it.source || "";
    $("#mSource").setAttribute("dir", "ltr");
    $("#mSource").parentElement.classList.toggle("hidden", !s.showSource || !it.source);

    var rep = $("#mRepeat"), r = parseRepeat(it.repeat);
    if (r && r > 1) { rep.textContent = "\u00d7" + r; rep.classList.remove("hidden"); }
    else rep.classList.add("hidden");

    var v = $("#mVerify");
    v.className = "verify " + it.verification;
    $("#mVerifyText").textContent = ({ quran: t("vQuran"), hadith: t("vHadith"), compilation: t("vCompilation") })[it.verification] || t("vHadith");
    var pct = state.playlist.length > 1 ? (state.index / (state.playlist.length - 1)) * 100 : 100;
    $("#progressFill").style.width = pct + "%";
    $("#counterText").textContent = (state.index + 1) + " / " + state.playlist.length;

    var runTvFit = function () {
      fitContent(arEl, ar, tl0, tr0);
      if (IS_TV && !anySheetOpen()) setTvReaderFocus();
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { requestAnimationFrame(runTvFit); }, function () { requestAnimationFrame(runTvFit); });
    } else {
      requestAnimationFrame(runTvFit);
    }
    savePos();
  }


  function renderEmptyState() {
    var reader = $("#reader");
    if (reader) reader.setAttribute("data-size", "normal");
    if (IS_TV) applyTvReadingMode(null);
    var arEl = $("#mArabic");
    if (arEl) {
      arEl.classList.remove("hidden", "tajweed-active");
      arEl.textContent = state.emptyMessage || "No content available.";
      arEl.style.fontSize = "32px";
    }
    setLine("#mTranslit", "", false);
    setLine("#mTranslation", "", false);
    setLine("#mUrdu", "", false);
    setLine("#mSource", "", false);
    $("#mCategory").textContent = "Content";
    $("#mType").textContent = "Unavailable";
    $("#mTitle").textContent = "Section content unavailable";
    $("#mVerifyText").textContent = "Review data";
    $("#progressFill").style.width = "0%";
    $("#counterText").textContent = "No items available";
  }

  // Dynamic fit. Always: shrink Arabic so it never overflows the card width
  // (no clipping / one-word-per-line). On TV with "Fit full content" (default,
  // and always in Easy View): also shrink the whole card — Arabic first, then
  // transliteration + translation — until the entire dua fits one screen with
  // no vertical scrolling, down to a sensible minimum readable size.
function fitContent(arEl, arStart, tlStart, trStart) {
  var reader = $("#reader"), sc = $("#readerScroll");
  if (!reader || !sc || !arEl) return;
  var mode = reader.getAttribute("data-size") || "normal";
  var isPopout = IS_TV && document.body.classList.contains("tv-reading-popout");
  var min = tvFitMinimums(mode);
  if (isPopout && mode === "long") min.ar = Math.max(34, min.ar);
  if (isPopout && mode === "very_long") min.ar = Math.max(30, min.ar);
  var size = Math.max(min.ar, Math.round(arStart || autoSize(mode, state.settings.arScale)));
  var tl = Math.max(min.tl, Math.round(tlStart || 20));
  var tr = Math.max(min.tr, Math.round(trStart || 21));
  var baseLh = IS_TV ? (isPopout ? 1.56 : 1.58) : (state.settings.arabicScript === "indopak" ? 1.72 : (isPopout ? 1.32 : 1.42));
  var lh = baseLh;
  var gapScale = 1;
  var guard = 0;

  // Rev I-36: stabilize width before measuring so Arabic wraps naturally before shrink logic runs.
  setImportantStyle(arEl, "width", "100%");
  setImportantStyle(arEl, "max-width", "100%");
  setImportantStyle(arEl, "align-self", "stretch");
  setImportantStyle(arEl, "box-sizing", "border-box");

  setImportantStyle(arEl, "font-size", size + "px");
  setImportantStyle(arEl, "line-height", String(lh));
  reader.style.setProperty("--ar-size", size + "px");
  reader.style.setProperty("--tl-size", tl + "px");
  reader.style.setProperty("--tr-size", tr + "px");
  reader.style.setProperty("--ar-lh", String(lh));
  reader.style.setProperty("--tv-fit-gap-scale", String(gapScale));

  // Width protection first: keep natural Arabic flow; never use word splitting.
  var widthGuardLimit = isPopout ? 110 : ((mode === "long" || mode === "very_long") ? 120 : 64);
  while (arEl.scrollWidth > arEl.clientWidth + 1 && size > min.ar && guard < widthGuardLimit) {
    size -= 1;
    setImportantStyle(arEl, "font-size", size + "px");
    reader.style.setProperty("--ar-size", size + "px");
    guard++;
  }

  var allowFullFit = IS_TV
    ? (state.settings.tvFit !== false && (mode === "short" || mode === "normal" || mode === "long" || mode === "very_long" || isPopout))
    : !(mode === "long" || mode === "very_long");

  function over() { return sc.scrollHeight > sc.clientHeight + 24; }

  // Pop-out mode is allowed to use stronger fitting before fallback scroll.
  if (allowFullFit) {
    var limit = isPopout ? 360 : 240;
    var g = 0;
    while (over() && size > min.ar && g < limit) {
      size -= 1;
      setImportantStyle(arEl, "font-size", size + "px");
      reader.style.setProperty("--ar-size", size + "px");
      g++;
    }
    while (over() && lh > min.lhMin && g < limit) {
      lh = Math.max(min.lhMin, Math.round((lh - (isPopout ? 0.025 : 0.02)) * 1000) / 1000);
      setImportantStyle(arEl, "line-height", String(lh));
      reader.style.setProperty("--ar-lh", String(lh));
      g++;
    }
    while (over() && (tl > min.tl || tr > min.tr) && g < limit) {
      if (tl > min.tl) tl -= 1;
      if (tr > min.tr) tr -= 1;
      reader.style.setProperty("--tl-size", tl + "px");
      reader.style.setProperty("--tr-size", tr + "px");
      g++;
    }
    while (over() && gapScale > min.gapMin && g < limit) {
      gapScale = Math.max(min.gapMin, Math.round((gapScale - (isPopout ? 0.06 : 0.05)) * 100) / 100);
      reader.style.setProperty("--tv-fit-gap-scale", String(gapScale));
      g++;
    }
  }

  var overflow = updateTvScrollState(sc);
  if (IS_TV && overflow && !isPopout) {
    var cur = state.playlist[state.index];
    if (cur && state.tvPopoutDismissedItemId !== currentItemKey(cur)) {
      document.body.classList.add("tv-reading-popout");
      reader.classList.add("popout");
      reader.setAttribute("data-popout", "true");
      requestAnimationFrame(function () { fitContent(arEl, arStart, tlStart, trStart); });
      return;
    }
  }
  if (!overflow) sc.scrollTop = 0;
  else sc.scrollTop = Math.max(0, state.pendingScrollTop || sc.scrollTop || 0);
  state.pendingScrollTop = 0;
}

  function formatInlineText(text) {
    return escHtml(text).replace(/ﷺ/g, '<span class="salawat-symbol">ﷺ</span>');
  }

  function setLine(sel, text, show) {
    var el = $(sel);
    if (!el) return;
    if (show && text) { el.innerHTML = formatInlineText(text); el.classList.remove("hidden"); }
    else { el.innerHTML = ""; el.classList.add("hidden"); }
  }

  function go(delta) {
    if (!state.playlist.length) return;
    var ni = (state.index + delta + state.playlist.length) % state.playlist.length;
    if (ni === state.index) return;
    savePos();
    state.tvPopoutDismissedItemId = null;
    state.index = ni;
    state.pendingScrollTop = 0;
    render();
    savePos();
  }

  function currentItemKey(it) {
    it = it || state.playlist[state.index];
    return it ? String(it.display_id || it.id || it.title || state.index) : String(state.index || 0);
  }

  function updatePauseIndicator() {
    var paused = !!state.autoPaused && !!state.settings.autoRotate;
    document.body.classList.toggle("tv-auto-paused", paused);
    var p = $("#pauseIndicator");
    if (p) {
      p.textContent = paused ? (state.settings.lang === "ur" ? "وقفہ" : "Paused") : "";
      p.classList.toggle("show", paused);
      p.setAttribute("aria-hidden", paused ? "false" : "true");
    }
    var flag = $("#autoFlag");
    if (flag) {
      // Rev I-36: keep only one pause indicator on TV. The counter flag keeps mode status,
      // while #pauseIndicator is the single visible paused badge.
      flag.classList.remove("paused");
      flag.classList.toggle("on", !!state.settings.autoRotate && !paused);
      flag.textContent = state.settings.autoRotate ? "AUTO" : "MANUAL";
    }
  }

  function toggleAutoPause() {
    ensureSettings();
    if (!state.settings.autoRotate) {
      state.autoPaused = false;
      clearTimeout(state.autoTimer);
      state.autoTimer = null;
      updatePauseIndicator();
      if (!IS_TV) toast(state.settings.lang === "ur" ? "خودکار تبدیلی بند ہے" : "Auto-rotate is off");
      return true;
    }
    state.autoPaused = !state.autoPaused;
    if (state.autoPaused) { clearTimeout(state.autoTimer); state.autoTimer = null; }
    else scheduleNext();
    updatePauseIndicator();
    // Rev I-36: TV shows the persistent pause badge only; toast is kept for touch layouts.
    if (!IS_TV) toast(state.autoPaused ? (state.settings.lang === "ur" ? "وقفہ" : "Paused") : (state.settings.lang === "ur" ? "دوبارہ شروع" : "Resumed"));
    return true;
  }

  function exitTvPopout() {
    if (!IS_TV || !document.body.classList.contains("tv-reading-popout")) return false;
    var reader = $("#reader");
    state.tvPopoutDismissedItemId = currentItemKey();
    document.body.classList.remove("tv-reading-popout", "tv-reader-can-scroll");
    if (reader) { reader.classList.remove("popout", "can-scroll"); reader.setAttribute("data-popout", "false"); }
    setTvReaderFocus();
    return true;
  }

  function reopenTvPopoutIfDismissed() {
    var it = state.playlist[state.index];
    if (!IS_TV || !it || !tvShouldStartPopout(it)) return false;
    if (state.tvPopoutDismissedItemId !== currentItemKey(it)) return false;
    state.tvPopoutDismissedItemId = null;
    var opened = applyTvReadingMode(it);
    requestAnimationFrame(function () {
      var arEl = $("#mArabic");
      if (arEl) fitContent(arEl, autoSize(it.size_mode, state.settings.arScale),
        Math.round(((it.size_mode === "short" ? 18 : 16) + 4) * state.settings.tlScale),
        Math.round(((it.size_mode === "short" ? 19 : 17) + 4) * state.settings.trScale));
      setTvReaderFocus();
    });
    return opened;
  }

  /* ---- auto rotation ----------------------------------------------------- */
  function autoIntervalMs() {
    var allowed = IS_TV ? [15, 30, 45, 60] : null;
    var sec = Number(state.settings.interval);
    if (!isFinite(sec)) sec = DEFAULTS.interval;
    if (allowed && allowed.indexOf(sec) < 0) sec = DEFAULTS.interval;
    return Math.max(IS_TV ? 15 : 5, sec) * 1000;
  }

  function scheduleNext() {
    clearTimeout(state.autoTimer);
    state.autoTimer = null;
    if (!state.settings.autoRotate || state.autoPaused) { updatePauseIndicator(); return; }
    state.autoTimer = setTimeout(function () {
      if (!state.settings.autoRotate || state.autoPaused) { updatePauseIndicator(); return; }
      go(1);
      scheduleNext();
    }, autoIntervalMs());
    updatePauseIndicator();
  }

  function setAuto(on) {
    state.settings.autoRotate = !!on;
    if (!on) state.autoPaused = false;
    scheduleNext();
  }
  function pokeAuto() {
    if (state.settings.autoRotate && !state.autoPaused) scheduleNext();
  }

  // Scroll the reader by dy. Uses smooth scrollTo where supported and falls
  // back to a plain scrollTop assignment on older WebView builds (where the
  // options-dictionary form of scrollBy/scrollTo is unavailable and throws).
  function scrollReader(dy) {
    var sc = $("#readerScroll");
    var target = Math.max(0, sc.scrollTop + dy);
    try {
      if (typeof sc.scrollTo === "function") { sc.scrollTo({ top: target, behavior: "smooth" }); return; }
    } catch (e) { /* fall through */ }
    sc.scrollTop = target;
  }

  /* ---- copy + share (phone/tablet share; hidden on TV) -------------------- */
  function buildShareText(it) {
    var parts = [];
    var title = localizeTitle(it); if (title) parts.push(title);
    if (it.arabic) parts.push(it.arabic);
    if (state.settings.showTranslit !== false && it.transliteration) parts.push(it.transliteration);
    if (state.settings.showEnglish !== false && it.translation) parts.push(it.translation);
    if (state.settings.showUrdu !== false && it.translation_ur) parts.push(it.translation_ur);
    if (it.source) parts.push(t("reference") + ": " + it.source);
    parts.push("Dua & Zikr");
    return parts.join("\n\n");
  }
  function copyCurrent() {
    var it = state.playlist[state.index]; if (!it) return;
    var text = buildShareText(it);
    var done = function () { toast(t("copied")); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
    } else legacyCopy(text, done);
  }
  function shareCurrent() {
    if (IS_TV) return;
    var it = state.playlist[state.index]; if (!it) return;
    var text = buildShareText(it);
    shareCardPng(it, function (file, dataUrl) {
      // Share the image only. The card PNG already contains every required line
      // (Bismillah, title, Arabic, transliteration, English, Urdu, source, app name),
      // so no separate text is attached. `text` is kept solely as a fallback for
      // the rare case where no image can be produced.
      try {
        if (dataUrl && window.AzkarShare && typeof window.AzkarShare.sharePng === "function") {
          window.AzkarShare.sharePng(dataUrl, text);
          return;
        }
      } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        navigator.share({ files: [file] }).catch(function () { shareTextFallback(text); });
      } else shareTextFallback(text);
    });
  }
  function shareTextFallback(text) {
    try {
      if (window.AzkarShare && typeof window.AzkarShare.shareText === "function") { window.AzkarShare.shareText(text); return; }
    } catch (e) {}
    legacyCopy(text, function () { toast(t("shareTextCopied")); });
  }
  function shareCardPng(it, cb) {
    try {
      var ratio = Math.min(2, window.devicePixelRatio || 1);
      var css = getComputedStyle(document.body);
      var bg = css.getPropertyValue("--surface").trim() || "#ffffff";
      var bg2 = css.getPropertyValue("--surface-2").trim() || bg;
      var fg = css.getPropertyValue("--arabic").trim() || "#111111";
      var muted = css.getPropertyValue("--translation").trim() || "#333333";
      var accent = css.getPropertyValue("--accent").trim() || "#b18431";
      var w = 1080, pad = 76, maxW = w - pad * 2;
      var probe = document.createElement("canvas").getContext("2d");
      var blocks = [];
      function addBlock(text, font, lh, color, align, rtl, topGap, maxLines) {
        text = String(text || "").replace(/\s+/g, " ").trim();
        if (!text) return;
        probe.font = font;
        blocks.push({ text:text, font:font, lh:lh, color:color, align:align || "center", rtl:!!rtl, topGap:topGap || 0, lines:wrapLines(probe, text, maxW, maxLines || 999) });
      }
      addBlock("Dua & Zikr", "700 44px sans-serif", 58, accent, "center", false, 0, 1);
      addBlock("بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ", "600 44px serif", 64, accent, "center", true, 16, 1);
      addBlock(localizeTitle(it), "700 34px sans-serif", 48, fg, "center", state.settings.lang === "ur", 20, 3);
      addBlock(stripWaqfForDisplay(it.arabic || ""), "700 56px serif", 82, fg, "center", true, 40, 999);
      if (state.settings.showTranslit !== false) addBlock(it.transliteration || "", "500 32px serif", 46, muted, "center", false, 34, 999);
      if (state.settings.showEnglish !== false) addBlock(it.translation || "", "500 32px sans-serif", 46, muted, "center", false, 26, 999);
      if (state.settings.showUrdu !== false && it.translation_ur) addBlock(it.translation_ur, "500 34px serif", 58, muted, "center", true, 28, 999);
      addBlock((it.source ? t("reference") + ": " + it.source : ""), "700 25px sans-serif", 36, accent, "center", false, 34, 3);
      var h = pad + 28;
      blocks.forEach(function (b) { h += b.topGap + Math.max(b.lh, b.lines.length * b.lh); });
      h += pad;
      h = Math.max(1440, Math.min(3400, Math.ceil(h)));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
      var ctx = canvas.getContext("2d"); ctx.scale(ratio, ratio);
      ctx.fillStyle = bg; roundRect(ctx, 0, 0, w, h, 34); ctx.fill();
      ctx.fillStyle = bg2; roundRect(ctx, 30, 30, w - 60, h - 60, 30); ctx.fill();
      var y = pad;
      blocks.forEach(function (b) {
        y += b.topGap;
        ctx.font = b.font; ctx.fillStyle = b.color; ctx.textAlign = b.align; ctx.direction = b.rtl ? "rtl" : "ltr";
        b.lines.forEach(function (line) { ctx.fillText(line, w / 2, y); y += b.lh; });
      });
      ctx.direction = "ltr";
      var dataUrl = "";
      try { dataUrl = canvas.toDataURL("image/png"); } catch (e) { dataUrl = ""; }
      canvas.toBlob(function (blob) {
        var file = null;
        if (blob) { try { file = new File([blob], "dua-zikr-card.png", { type: "image/png" }); } catch (e) {} }
        cb(file, dataUrl);
      }, "image/png", 0.95);
    } catch (e) { cb(null, ""); }
  }
  function wrapLines(ctx, text, maxW, maxLines) {
    var words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
    var line = "", lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = words[i];
        if (lines.length >= maxLines) break;
      } else line = test;
    }
    if (line && lines.length < maxLines) lines.push(line);
    return lines;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function legacyCopy(text, cb) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta); cb();
    } catch (e) { toast(t("shareUnavailable")); }
  }

  /* ---- gestures + keys (touch + D-pad) ----------------------------------- */
  function bindGlobal() {
    $("#prevBtn").addEventListener("click", function () { go(-1); pokeAuto(); });
    $("#nextBtn").addEventListener("click", function () { go(1); pokeAuto(); });
    $("#copyBtn").addEventListener("click", copyCurrent);
    var sh = $("#shareBtn"); if (sh) sh.addEventListener("click", shareCurrent);
    function stepArabic(d) {
      ensureSettings();
      var vMin = IS_TV ? 0.7 : 0.7;
      var vMax = IS_TV ? 1.4 : 2.0;
      var v = Math.min(vMax, Math.max(vMin, Math.round((state.settings.arScale + d) * 100) / 100));
      if (IS_TV) state.settings.tvVisualRevision = "I-36-tv-visual-proof-layout-closure";
      state.settings.arScale = v;
      if (state.draft) state.draft.arScale = v;
      save();
      applyBodyFlags();
      if (IS_TV) applyTvLivePreviewValues(state.settings);
      else render();
      if (IS_TV && $("#settingsSheet.open")) syncSettingsUI();
      tvToast((state.settings.lang === "ur" ? "عربی سائز " : "Arabic size ") + Math.round(v * 100) + "%");
    }
    var aDec = $("#arDec"); if (aDec) aDec.addEventListener("click", function () { stepArabic(-0.1); });
    var aInc = $("#arInc"); if (aInc) aInc.addEventListener("click", function () { stepArabic(0.1); });
    $("#contrastBtn").addEventListener("click", function () {
      ensureSettings();
      if (IS_TV) {
        var nextTheme = state.settings.theme === "elder-light" ? "dark-ambient" : "elder-light";
        state.settings.theme = nextTheme;
        state.settings.highContrast = false;
        if (state.draft) { state.draft.theme = nextTheme; state.draft.highContrast = false; }
        applyTheme(nextTheme); applyBodyFlags(); render(); save();
        if ($("#settingsSheet.open")) syncSettingsUI();
        tvToast(nextTheme === "elder-light" ? "Light theme" : "Dark theme");
        return;
      }
      if (state.settings.theme !== "high-contrast") {
        state.prevTheme = state.settings.theme;
        state.settings.theme = "high-contrast";
      } else {
        state.settings.theme = state.prevTheme || "dark-ambient";
      }
      applyTheme(state.settings.theme); save();
      toast(state.settings.theme === "high-contrast" ? (state.settings.lang === "ur" ? "ہائی کنٹراسٹ آن" : "High contrast on") : (state.settings.lang === "ur" ? "ہائی کنٹراسٹ آف" : "High contrast off"));
    });

    document.addEventListener("keydown", onKey);

    // horizontal swipe on the main reading stage; vertical reserved for scrolling
    var sx = 0, sy = 0, t0 = 0, longTimer = null, moved = false, touchActive = false;
    var reader = $("#reader");
    var gestureTarget = $(".stage") || reader;
    gestureTarget.addEventListener("touchstart", function (e) {
      touchActive = false;
      if (e.target.closest && e.target.closest("button, input, select, textarea, .sheet")) return;
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY; t0 = Date.now(); moved = false; touchActive = true;
      longTimer = setTimeout(function () {
        if (touchActive && !moved) { setAuto(!state.settings.autoRotate); toast(state.settings.autoRotate ? (state.settings.lang === "ur" ? "خودکار تبدیلی آن" : "Auto-rotation on") : (state.settings.lang === "ur" ? "خودکار تبدیلی بند" : "Auto-rotation paused")); save(); }
      }, 620);
    }, { passive: true });
    gestureTarget.addEventListener("touchmove", function (e) {
      if (!touchActive) return;
      var t = e.touches[0];
      if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) { moved = true; clearTimeout(longTimer); }
    }, { passive: true });
    gestureTarget.addEventListener("touchend", function (e) {
      if (!touchActive) return;
      touchActive = false;
      clearTimeout(longTimer);
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - t0;
      if (state.settings.swipeNav !== false && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 700) {
        if (dx < 0) go(1); else go(-1); pokeAuto();
      }
    }, { passive: true });

    $("#viewPick").addEventListener("click", function () {
      var sb = $("#secSearch"); if (sb) { sb.value = ""; renderSearch(""); }
      openSheet("#sectionSheet");
    });
    var secSearch = $("#secSearch");
    if (secSearch) secSearch.addEventListener("input", function () { renderSearch(this.value); });

    $("#openSettings").addEventListener("click", openSettings);
    var mb = $("#menuBtn"); if (mb) mb.addEventListener("click", openSettings);
    $("#scrim").addEventListener("click", closeSheets);
    $$("[data-close]").forEach(function (b) { b.addEventListener("click", closeSheets); });
    $("#applyBtn").addEventListener("click", applySettings);

    window.addEventListener("resize", function () { render(); });
    window.addEventListener("orientationchange", function () { setTimeout(render, 120); });
    window.addEventListener("online", refreshConnDot);
    window.addEventListener("offline", refreshConnDot);
    var scroller = $("#readerScroll");
    if (scroller) scroller.addEventListener("scroll", function () {
      clearTimeout(state.scrollTimer);
      state.scrollTimer = setTimeout(savePos, 120);
    }, { passive: true });

    if (IS_TV) setTvReaderFocus();
  }

  // ----- TV / D-pad focus model -----------------------------------------
  // Zones, top to bottom: 0 top bar | 1 prayer ribbon | 2 reader | 3 footer.
  var READER_ZONE = 2;
  function elVisible(el) { return el && el.offsetParent !== null && !el.classList.contains("hidden"); }
  function zoneEls(z) {
    var list;
    if (z === 0) list = [$("#viewPick"), $("#arDec"), $("#arInc"), $("#contrastBtn"), $("#openSettings")].filter(function (el) { return el && el.offsetParent !== null; });
    else if (z === 1) list = [$("#prayerRibbon")];
    else if (z === 3) list = [$("#menuBtn"), $("#prevBtn"), $("#nextBtn")];
    else list = [];
    return list.filter(elVisible);
  }
  function validZones() {
    var z = [];
    if (zoneEls(0).length) z.push(0);
    if (zoneEls(1).length) z.push(1);
    z.push(READER_ZONE);
    if (zoneEls(3).length) z.push(3);
    return z;
  }
  function clearChromeFocus() {
    $$(".tv-focus, .tv-main-focus").forEach(function (el) { el.classList.remove("tv-focus", "tv-main-focus"); });
  }
  function focusZone(z, col) {
    if (!state.nav) state.nav = { zone: READER_ZONE, col: 0 };
    clearChromeFocus();
    if (z === READER_ZONE) { state.nav.zone = READER_ZONE; state.nav.col = 0; var r = $("#reader"); if (r) { r.classList.add("tv-focus"); try { r.focus({ preventScroll: true }); } catch (e) { try { r.focus(); } catch (e2) {} } } return; }
    var list = zoneEls(z);
    if (!list.length) { focusZone(READER_ZONE, 0); return; }
    col = Math.max(0, Math.min(col == null ? state.nav.col : col, list.length - 1));
    state.nav.zone = z; state.nav.col = col;
    var el = list[col]; el.classList.add("tv-focus");
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
  }
  function tvHeaderDefaultCol() {
    var list = zoneEls(0), settings = $("#openSettings"), i = list.indexOf(settings);
    return i >= 0 ? i : Math.max(0, list.length - 1);
  }

  function tvTopControls() {
    return zoneEls(0);
  }

  function clearTvMainFocus() {
    $$(".tv-main-focus, .tv-focus").forEach(function (el) {
      el.classList.remove("tv-main-focus", "tv-focus");
    });
  }

  function setTvTopFocus(index) {
    var list = tvTopControls();
    if (!list.length) return false;
    index = Math.max(0, Math.min(index == null ? tvHeaderDefaultCol() : index, list.length - 1));
    state.tvMainArea = "top";
    state.tvTopIndex = index;
    state.nav = { zone: 0, col: index };
    clearTvMainFocus();
    clearTvSettingsFocus();
    var el = list[index];
    el.classList.add("tv-focus", "tv-main-focus");
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
    return true;
  }

  function setTvReaderFocus() {
    state.tvMainArea = "reader";
    state.nav = { zone: READER_ZONE, col: 0 };
    clearTvMainFocus();
    clearTvSettingsFocus();
    var r = $("#reader");
    if (r) {
      r.classList.add("tv-focus", "tv-main-focus");
      try { r.focus({ preventScroll: true }); } catch (e) { try { r.focus(); } catch (e2) {} }
    }
    return true;
  }

  function tvActivateTopControl() {
    var list = tvTopControls();
    if (!list.length) return false;
    var idx = Math.max(0, Math.min(state.tvTopIndex == null ? tvHeaderDefaultCol() : state.tvTopIndex, list.length - 1));
    return tvDirectControl(list[idx], 0);
  }

  // Rev I-6: when Android TV WebView gives native focus to a button, align the
  // internal remote model to that focused element before handling Enter/OK.
  function syncNavFromActiveElement() {
    if (!IS_TV) return;
    var ae = document.activeElement;
    if (!ae || ae === document.body) return;
    var zones = [0, 1, 3];
    for (var zi = 0; zi < zones.length; zi++) {
      var z = zones[zi], list = zoneEls(z), idx = list.indexOf(ae);
      if (idx >= 0) { state.nav = { zone: z, col: idx }; clearChromeFocus(); ae.classList.add("tv-focus"); return; }
    }
  }
  function stepZone(dir) {
    var zs = validZones(), i = zs.indexOf(state.nav ? state.nav.zone : READER_ZONE);
    if (i < 0) i = zs.indexOf(READER_ZONE);
    var ni = Math.max(0, Math.min(i + dir, zs.length - 1));
    if (ni !== i) focusZone(zs[ni], state.nav ? state.nav.col : 0);
  }
  function readerCanScroll(dir) {
    var sc = $("#readerScroll"); if (!sc) return false;
    return dir < 0 ? sc.scrollTop > 4 : sc.scrollTop < (sc.scrollHeight - sc.clientHeight - 4);
  }

  /* ---- TV Settings deterministic focus walker ------------------------------ */
  function normalizeTvKey(key) {
    var k = String(key || "");
    if (k === "DPAD_UP") return "ArrowUp";
    if (k === "DPAD_DOWN") return "ArrowDown";
    if (k === "DPAD_LEFT") return "ArrowLeft";
    if (k === "DPAD_RIGHT") return "ArrowRight";
    if (k === "DPAD_CENTER" || k === "OK" || k === "NumpadEnter") return "Enter";
    if (k === "Back" || k === "GoBack" || k === "BrowserBack") return "Escape";
    if (k === "Spacebar") return " ";
    if (k === "Menu" || k === "Settings") return "Settings";
    return k;
  }

  function clearTvSettingsFocus() {
    $$(".tv-row-focus, .tv-control-focus").forEach(function (el) {
      el.classList.remove("tv-row-focus", "tv-control-focus");
      if (el.hasAttribute("data-tv-tab-managed")) el.setAttribute("tabindex", "-1");
    });
  }

  function tvVisible(el) {
    if (!el || el.disabled || el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    var node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      if (node.hidden || node.getAttribute("aria-hidden") === "true") return false;
      var st = window.getComputedStyle ? getComputedStyle(node) : null;
      if (st && (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0)) return false;
      node = node.parentElement;
    }
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 1, height: 1 };
    if ((r.width <= 0 || r.height <= 0) && !el.classList.contains("tv-toggle")) return false;
    return el.offsetParent !== null || el === document.activeElement;
  }

  function tvSettingEntryFromRow(row) {
    var controls = [];
    var kind = "info";
    var stepper = row.querySelector(".tv-stepper");
    var seg = row.querySelector(".tv-seg");
    var cycle = row.querySelector(".tv-cycle");
    var toggle = row.querySelector(".tv-toggle");
    var action = row.querySelector("button.tv-info-action");

    if (stepper) {
      kind = "stepper";
      controls = Array.prototype.slice.call(stepper.querySelectorAll("button")).filter(tvVisible);
    } else if (seg) {
      kind = "seg";
      controls = Array.prototype.slice.call(seg.querySelectorAll("button")).filter(tvVisible);
    } else if (cycle) {
      kind = "cycle";
      controls = [cycle].filter(tvVisible);
    } else if (toggle) {
      kind = "toggle";
      controls = [toggle].filter(tvVisible);
    } else if (action) {
      kind = "action";
      controls = [action].filter(tvVisible);
    }

    return { row: row, controls: controls, kind: kind };
  }

  function tvSettingsRows() {
    if (!IS_TV) return [];
    var sh = $("#settingsSheet.open");
    if (!sh) return [];
    var out = [];
    // Rev I-31: TV D-pad navigation starts inside actionable settings rows and never defaults to the close button.
    // The close button remains clickable for pointer users; Back/Settings closes the panel on TV.
    $$("#settingsBody .tv-set-row").forEach(function (row) {
      if (!tvVisible(row)) return;
      out.push(tvSettingEntryFromRow(row));
    });

    var apply = $("#settingsSheet .btn-apply");
    if (tvVisible(apply)) out.push({ row: apply, controls: [apply], kind: "apply" });

    out.forEach(function (entry, idx) {
      entry.index = idx;
      if (entry.row) {
        entry.row.setAttribute("tabindex", "-1");
        entry.row.setAttribute("data-tv-tab-managed", "1");
        entry.row.setAttribute("data-tv-focus-kind", entry.kind);
      }
      (entry.controls || []).forEach(function (c) {
        c.setAttribute("tabindex", "-1");
        c.setAttribute("data-tv-tab-managed", "1");
      });
    });
    return out;
  }

  function activeControlIndex(entry) {
    if (!entry || !entry.controls || !entry.controls.length) return 0;
    if (entry.kind === "stepper") return Math.min(state.tvSettingsNav && state.tvSettingsNav.option != null ? state.tvSettingsNav.option : 1, entry.controls.length - 1);
    var active = -1;
    entry.controls.forEach(function (c, i) {
      if (c.classList.contains("active") || c.classList.contains("on") || c.getAttribute("aria-pressed") === "true") active = i;
    });
    return active >= 0 ? active : 0;
  }

  function setTvSettingsFocus(rowIndex, optionIndex, scroll) {
    var rows = tvSettingsRows();
    if (!rows.length) return false;
    rowIndex = Math.max(0, Math.min(rowIndex == null ? 0 : rowIndex, rows.length - 1));
    var entry = rows[rowIndex];
    var controls = entry.controls || [];
    if (optionIndex == null) optionIndex = activeControlIndex(entry);
    optionIndex = controls.length ? Math.max(0, Math.min(optionIndex, controls.length - 1)) : 0;
    state.tvSettingsNav = { row: rowIndex, option: optionIndex };
    state.tvSettingsIndex = rowIndex;
    document.body.setAttribute("data-tv-settings-focus", String(rowIndex));

    clearChromeFocus();
    clearTvSettingsFocus();
    if (entry.row) entry.row.classList.add("tv-row-focus");

    var target = controls[optionIndex] || entry.row;
    if (target) {
      target.classList.add("tv-control-focus");
      target.setAttribute("data-tv-focus-kind", entry.kind || "control");
      target.setAttribute("data-tv-active-control", "true");
      try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (e2) {} }
    }
    if (scroll !== false && entry.row) {
      try { entry.row.scrollIntoView({ block: "center", inline: "nearest" }); }
      catch (e3) { try { entry.row.scrollIntoView(false); } catch (e4) {} }
    }
    return true;
  }

  function initTvSettingsFocus(preferDefault) {
    var rows = tvSettingsRows();
    if (!rows.length) return false;
    var row = 0, option = 0;
    if (preferDefault) {
      for (var i = 0; i < rows.length; i++) {
        var j = rows[i].controls.indexOf($("#settingsSheet .tv-default-focus"));
        if (j >= 0) { row = i; option = j; break; }
      }
    } else if (state.tvSettingsNav) {
      row = state.tvSettingsNav.row;
      option = state.tvSettingsNav.option;
    }
    var focused = setTvSettingsFocus(row, option, true);
    if (!focused && rows.length) focused = setTvSettingsFocus(0, activeControlIndex(rows[0]), true);
    return focused;
  }

  function refreshTvSettingsFocus() {
    if (!IS_TV || !$("#settingsSheet.open")) return;
    var row = state.tvSettingsNav ? state.tvSettingsNav.row : 0;
    var option = state.tvSettingsNav ? state.tvSettingsNav.option : null;
    setTvSettingsFocus(row, option, false);
  }

  function tvClampNumber(v, min, max, fallback) {
    v = Number(v);
    if (!isFinite(v)) v = fallback;
    return Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  }

  function tvSettingCommitOptions(key) {
    var noRender = { arScale: true, tlScale: true, trScale: true, theme: true, themeAccent: true, bismillahSize: true, showRibbon: true, prayerHeaderDetail: true, showProgress: true, showTags: true, autoRotate: true, interval: true };
    var rebuild = key === "deviceProfile" || key === "arabicScript";
    return { rebuild: rebuild, render: !noRender[key] };
  }

  function tvSetDraftValue(key, value, keepFocusOption) {
    if (!IS_TV || !key) return false;
    var draft = ensureDraft();
    draft[key] = value;
    if (key === "theme") draft.highContrast = value === "high-contrast";
    if (key === "showEnglish") draft.showTranslation = !!draft.showEnglish;
    if (key === "themeAccent" && value === "green") draft.bismillahColor = "olive";
    var opts = tvSettingCommitOptions(key);
    commitTvDraftLive(opts.rebuild, opts.render);
    syncSettingsUI();
    if (keepFocusOption != null && state.tvSettingsNav) state.tvSettingsNav.option = keepFocusOption;
    refreshTvSettingsFocus();
    return true;
  }

  function tvStepSetting(key, dir, step, min, max) {
    if (!IS_TV || !key) return false;
    step = Number(step); if (!isFinite(step) || step <= 0) step = 0.1;
    min = Number(min); if (!isFinite(min)) min = key === "arScale" ? 0.7 : 0.7;
    max = Number(max); if (!isFinite(max)) max = key === "arScale" ? 1.4 : 1.9;
    var draft = ensureDraft();
    var current = Number(draft[key]);
    if (!isFinite(current)) current = DEFAULTS[key] || (key === "arScale" ? 0.7 : 1);
    return tvSetDraftValue(key, tvClampNumber(current + (dir * step), min, max, current));
  }

  function tvSetSegControl(control) {
    var seg = control && control.closest ? control.closest(".tv-seg") : null;
    if (!seg) return false;
    var key = seg.getAttribute("data-seg");
    var raw = control.getAttribute("data-val");
    var val;
    try { val = JSON.parse(raw); } catch (e) { val = raw; }
    var buttons = Array.prototype.slice.call(seg.querySelectorAll("button"));
    var idx = buttons.indexOf(control);
    return tvSetDraftValue(key, val, idx >= 0 ? idx : null);
  }

  function tvSetToggleControl(control, forced) {
    var key = control && control.getAttribute ? control.getAttribute("data-tv-toggle") : "";
    if (!key) return false;
    var draft = ensureDraft();
    var val = forced == null ? !draft[key] : !!forced;
    return tvSetDraftValue(key, val, 0);
  }

  function tvSetStepperControl(control, dirOverride) {
    var st = control && control.closest ? control.closest(".tv-stepper") : null;
    if (!st) return false;
    var key = st.getAttribute("data-stepper");
    var dir = dirOverride || Number(control.getAttribute("data-step-dir"));
    if (!isFinite(dir) || dir === 0) dir = 1;
    return tvStepSetting(key, dir > 0 ? 1 : -1, st.getAttribute("data-step"), st.getAttribute("data-min"), st.getAttribute("data-max"));
  }

  function tvMainArabicStep(dir) {
    if (!IS_TV) return false;
    ensureSettings();
    var current = Number(state.settings.arScale);
    if (!isFinite(current)) current = 0.7;
    var v = tvClampNumber(current + (dir * 0.1), 0.7, 1.4, 0.7);
    state.settings.arScale = v;
    state.settings.tvVisualRevision = "I-36-tv-visual-proof-layout-closure";
    if (state.draft) state.draft.arScale = v;
    save();
    applyBodyFlags();
    applyTvLivePreviewValues(state.settings);
    if ($("#settingsSheet.open")) syncSettingsUI();
    tvToast("Arabic size " + Math.round(v * 100) + "%");
    return true;
  }

  function tvCycleThemeDirect() {
    if (!IS_TV) return false;
    ensureSettings();
    var next = "dark-ambient";
    state.settings.theme = next;
    state.settings.highContrast = false;
    state.settings.tvVisualRevision = "I-36-tv-visual-proof-layout-closure";
    if (state.draft) { state.draft.theme = next; state.draft.highContrast = false; }
    save();
    applyTheme(next);
    applyBodyFlags();
    applyTvLivePreviewValues(state.settings);
    if ($("#settingsSheet.open")) syncSettingsUI();
    tvToast("Dark theme");
    return true;
  }

  function tvDirectControl(el, dir) {
    if (!IS_TV || !el) return false;
    if (el.hasAttribute && el.hasAttribute("data-close")) { closeSheets(); return true; }
    if (el.id === "applyBtn" || el.classList.contains("btn-apply")) { applySettings(); return true; }
    if (el.id === "arDec") return tvMainArabicStep(-1);
    if (el.id === "arInc") return tvMainArabicStep(1);
    if (el.id === "contrastBtn") return tvCycleThemeDirect();
    if (el.id === "openSettings" || el.id === "menuBtn") { openSettings(); return true; }
    if (el.id === "prevBtn") { go(-1); pokeAuto(); return true; }
    if (el.id === "nextBtn") { go(1); pokeAuto(); return true; }
    if (el.id === "viewPick") { var sb = $("#secSearch"); if (sb) { sb.value = ""; renderSearch(""); } openSheet("#sectionSheet"); return true; }
    if (el.classList && el.classList.contains("tv-toggle")) return tvSetToggleControl(el, dir == null || dir === 0 ? null : dir > 0);
    if (el.classList && el.classList.contains("tv-cycle")) { tvCycleChoice(el, dir || 1); return true; }
    if (el.closest && el.closest(".tv-stepper")) return tvSetStepperControl(el, dir);
    if (el.closest && el.closest(".tv-seg")) return tvSetSegControl(el);
    return false;
  }

  function tvClick(el) {
    if (tvDirectControl(el, 0)) return true;
    if (el && typeof el.click === "function") { el.click(); return true; }
    return false;
  }

  function tvSettingsChangeSeg(entry, dir) {
    var controls = entry.controls || [];
    if (!controls.length) return false;
    var cur = activeControlIndex(entry);
    var next = Math.max(0, Math.min(cur + dir, controls.length - 1));
    if (next === cur && controls.length > 1) next = dir > 0 ? controls.length - 1 : 0;
    setTvSettingsFocus(state.tvSettingsNav.row, next, true);
    return tvClick(controls[next]);
  }

  function tvSettingsActivate(entry, dir) {
    if (!entry) return false;
    var controls = entry.controls || [];
    var option = state.tvSettingsNav ? state.tvSettingsNav.option : activeControlIndex(entry);

    if (entry.kind === "back") { closeSheets(); return true; }
    if (entry.kind === "apply") return tvClick(controls[0]);
    if (entry.kind === "info") { toast("Information only"); return true; }

    if (entry.kind === "stepper") {
      var stepTarget = dir < 0 ? controls[0] : (dir > 0 ? controls[Math.min(1, controls.length - 1)] : controls[option] || controls[Math.min(1, controls.length - 1)]);
      if (dir < 0) setTvSettingsFocus(state.tvSettingsNav.row, 0, true);
      if (dir > 0) setTvSettingsFocus(state.tvSettingsNav.row, Math.min(1, controls.length - 1), true);
      return tvClick(stepTarget || controls[option]);
    }

    if (entry.kind === "cycle") {
      tvCycleChoice(controls[0], dir || 1);
      return true;
    }

    if (entry.kind === "toggle") {
      var control = controls[0];
      if (!control) return false;
      if (dir < 0 || dir > 0) {
        var key = control.getAttribute("data-tv-toggle");
        var draft = ensureDraft();
        if (key) {
          draft[key] = dir > 0;
          if (key === "showEnglish") draft.showTranslation = !!draft.showEnglish;
          commitTvDraftLive(false);
          syncSettingsUI();
          refreshTvSettingsFocus();
          return true;
        }
      }
      return tvClick(control);
    }

    if (entry.kind === "seg") {
      if (dir < 0 || dir > 0) return tvSettingsChangeSeg(entry, dir);
      return tvClick(controls[option] || controls[activeControlIndex(entry)]);
    }

    return tvClick(controls[option]);
  }

  function tvHandleSettingChange(target, dir) {
    if (!IS_TV || !target) return false;
    var entry = target;
    if (!entry.kind) {
      var rows = tvSettingsRows();
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].row === target || (rows[i].controls || []).indexOf(target) >= 0 || (target.closest && rows[i].row === target.closest(".tv-set-row"))) {
          entry = rows[i];
          if (state.tvSettingsNav) state.tvSettingsNav.row = i;
          state.tvSettingsIndex = i;
          break;
        }
      }
    }
    return tvSettingsActivate(entry, dir || 0);
  }

  function tvSettingsKey(key) {
    if (!$("#settingsSheet.open")) return false;

    key = normalizeTvKey(key && key.key ? key.key : key);

    var entries = tvSettingsRows();
    if (!entries.length) return true;
    if (!state.tvSettingsNav) initTvSettingsFocus(true);

    var current = state.tvSettingsNav && state.tvSettingsNav.row != null ? state.tvSettingsNav.row : (state.tvSettingsIndex || 0);
    if (current < 0 || current >= entries.length) current = 0;
    state.tvSettingsIndex = current;
    state.tvSettingsNav = state.tvSettingsNav || { row: current, option: activeControlIndex(entries[current]) };
    state.tvSettingsNav.row = current;

    // TV defensive repair: if Android WebView drops DOM focus, restore the deterministic TV focus.
    if (!document.activeElement || !document.activeElement.closest || !document.activeElement.closest('#settingsSheet')) {
      setTvSettingsFocus(current, state.tvSettingsNav.option, false);
    }

    switch (key) {
        case "ArrowDown":
            state.tvSettingsIndex = Math.min(current + 1, entries.length - 1);
            return setTvSettingsFocus(state.tvSettingsIndex, null, true);
        case "ArrowUp":
            state.tvSettingsIndex = Math.max(current - 1, 0);
            return setTvSettingsFocus(state.tvSettingsIndex, null, true);
        case "ArrowRight":
        case "ArrowLeft":
            return !!tvHandleSettingChange(entries[current], key === "ArrowRight" ? 1 : -1);
        case "Enter":
        case " ":
            return !!tvHandleSettingChange(entries[current], 0);
        case "Escape":
        case "Settings":
            closeSheets();
            return true;
        default:
            return true;
    }
}

  function tvSectionItems() {
    var sh = $("#sectionSheet.open");
    if (!IS_TV || !sh) return [];
    return Array.prototype.slice.call(sh.querySelectorAll(".sec-item"))
      .filter(function (el) { return tvVisible(el); });
  }
  function setTvSectionFocus(index, scroll) {
    var items = tvSectionItems();
    if (!items.length) return false;
    index = Math.max(0, Math.min(index == null ? 0 : index, items.length - 1));
    state.tvSectionIndex = index;
    clearChromeFocus();
    clearTvSettingsFocus();
    var el = items[index];
    el.classList.add("tv-focus");
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
    if (scroll !== false) {
      try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); }
      catch (e3) { try { el.scrollIntoView(false); } catch (e4) {} }
    }
    return true;
  }
  function initTvSectionFocus() {
    var items = tvSectionItems();
    if (!items.length) return false;
    var active = items.findIndex(function (el) { return el.classList.contains("active"); });
    return setTvSectionFocus(active >= 0 ? active : 0, true);
  }
  function tvActivateSectionItem(el) {
    if (!el) return false;
    var token = el.getAttribute("data-view");
    if (token === "mixed") { setView({ mode: "mixed" }); closeSheets(); return true; }
    if (token && token.indexOf("category:") === 0) { setView({ mode: "category", category: token.slice(9) }); closeSheets(); return true; }
    if (token && token.indexOf("section:") === 0) { setView({ mode: "section", section: token.slice(8) }); closeSheets(); return true; }
    var itemId = el.getAttribute("data-item-id");
    if (itemId) { goToItem(itemId); closeSheets(); return true; }
    return tvClick(el);
  }
  function tvSectionKey(keyOrEvent) {
    var key = normalizeTvKey(keyOrEvent && keyOrEvent.key ? keyOrEvent.key : keyOrEvent);
    var evt = keyOrEvent && keyOrEvent.preventDefault ? keyOrEvent : null;
    var items = tvSectionItems();
    if (!items.length) { if (key === "Escape") closeSheets(); if (evt) evt.preventDefault(); return true; }
    if (state.tvSectionIndex == null) initTvSectionFocus();
    var idx = Math.max(0, Math.min(state.tvSectionIndex || 0, items.length - 1));
    var handled = true;
    if (key === "ArrowDown") setTvSectionFocus(idx + 1, true);
    else if (key === "ArrowUp") setTvSectionFocus(idx - 1, true);
    else if (key === "ArrowRight") setTvSectionFocus(idx + 1, true);
    else if (key === "ArrowLeft") setTvSectionFocus(idx - 1, true);
    else if (key === "Enter" || key === " ") tvActivateSectionItem(items[idx]);
    else if (key === "Escape") closeSheets();
    else handled = false;
    if (handled && evt) evt.preventDefault();
    return handled;
  }

  /* ---- in-sheet D-pad focus (so every settings control is remote-reachable) */
  function sheetFocusables() {
    var sh = $(".sheet.open"); if (!sh) return [];
    return Array.prototype.slice.call(sh.querySelectorAll("button, select, input[type=checkbox], input[type=radio]"))
      .filter(function (el) {
        if (el.disabled || el.hidden || el.getAttribute("aria-hidden") === "true") return false;
        var host = el.closest(".tv-set-row, .tv-seg, .tv-stepper, .set-row, .theme-card, .settings-cat-chip, .sec-item, .seg, .sheet-foot, .sheet-head, .set-group") || el;
        return host.offsetParent !== null;   // visible by layout (switch inputs are 0-size)
      });
  }
  function sheetRing(el) {
    $$(".tv-focus").forEach(function (x) { x.classList.remove("tv-focus"); });
    var row = el.closest(".tv-set-row, .tv-seg button, .tv-stepper button, .set-row, .theme-card, .settings-cat-chip, .sec-item, .seg button, .sheet-foot button, .sheet-head button");
    (row || el).classList.add("tv-focus");
  }
  function sheetMove(dir) {
    var els = sheetFocusables(); if (!els.length) return;
    var cur = els.indexOf(document.activeElement);
    cur = cur < 0 ? 0 : Math.max(0, Math.min(els.length - 1, cur + dir));
    var el = els[cur];
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
    try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { try { el.scrollIntoView(false); } catch (e2) {} }
    sheetRing(el);
  }
  function sheetKey(e) {
    switch (e.key) {
      case "ArrowDown": case "ArrowRight": sheetMove(1); e.preventDefault(); break;
      case "ArrowUp": case "ArrowLeft": sheetMove(-1); e.preventDefault(); break;
      case "Enter": case " ": case "Spacebar":
        if (document.activeElement && typeof document.activeElement.click === "function") document.activeElement.click();
        e.preventDefault(); break;
      default: break;
    }
  }

  function onKey(e) {
    if (IS_TV) {
      var k = normalizeTvKey(e && e.key);
      if (tvMainKey(k)) {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        return;
      }
    }

    if (anySheetOpen()) {
      if (e.key === "Escape" || e.key === "GoBack" || e.key === "BrowserBack") { closeSheets(); e.preventDefault(); return; }
      sheetKey(e);
      return;
    }
    if (!state.nav) state.nav = { zone: READER_ZONE, col: 0 };
    var zone = state.nav.zone, sc = $("#readerScroll");
    switch (e.key) {
      case "ArrowUp":
        if (zone === READER_ZONE && readerCanScroll(-1)) scrollReader(-Math.round(sc.clientHeight * 0.5));
        else stepZone(-1);
        e.preventDefault(); break;
      case "ArrowDown":
        if (zone === READER_ZONE && readerCanScroll(1)) scrollReader(Math.round(sc.clientHeight * 0.5));
        else stepZone(1);
        e.preventDefault(); break;
      case "ArrowLeft":
        if (zone === READER_ZONE) { go(-1); pokeAuto(); } else focusZone(zone, state.nav.col - 1);
        e.preventDefault(); break;
      case "ArrowRight":
        if (zone === READER_ZONE) { go(1); pokeAuto(); } else focusZone(zone, state.nav.col + 1);
        e.preventDefault(); break;
      case "Enter": case " ": case "Spacebar":
        if (zone === READER_ZONE) {
          setAuto(!state.settings.autoRotate);
          toast(state.settings.autoRotate ? (state.settings.lang === "ur" ? "خودکار تبدیلی آن" : "Auto-rotation on") : (state.settings.lang === "ur" ? "خودکار تبدیلی بند" : "Auto-rotation paused")); save();
        } else if (zone === 1) { /* ribbon is informational; OK does nothing */ }
        else {
          var list = zoneEls(zone), el = list[state.nav.col];
          if (el && typeof el.click === "function") el.click();
        }
        e.preventDefault(); break;
      case "Escape": case "GoBack": case "BrowserBack":
        if (zone !== READER_ZONE) { focusZone(READER_ZONE, 0); e.preventDefault(); }
        break;
      default: break;
    }
  }

  /* ---- sheets ------------------------------------------------------------ */
  function focusTvSettingsDefaultControl() {
    if (!IS_TV || !$("#settingsSheet.open")) return false;
    return initTvSettingsFocus(true);
  }

  function forceTvSettingsInitialFocus() {
    if (!IS_TV || !$("#settingsSheet.open")) return false;
    state.tvSettingsNav = null;
    state.tvSettingsIndex = 0;
    var ok = focusTvSettingsDefaultControl();
    // Android TV WebView may repaint the side panel after the open transform;
    // repeat deterministically so the close button or reader never keeps focus.
    requestAnimationFrame(function () {
      if ($("#settingsSheet.open")) focusTvSettingsDefaultControl();
    });
    setTimeout(function () {
      if ($("#settingsSheet.open")) {
        var active = document.activeElement;
        var inside = !!(active && active.closest && active.closest("#settingsSheet"));
        var close = !!(active && active.hasAttribute && active.hasAttribute("data-close"));
        var managed = !!(active && active.getAttribute && active.getAttribute("data-tv-active-control") === "true");
        if (!inside || close || !managed) focusTvSettingsDefaultControl();
      }
    }, 90);
    setTimeout(function () {
      if ($("#settingsSheet.open")) focusTvSettingsDefaultControl();
    }, 180);
    return ok;
  }

  function openSheet(sel) {
    $("#scrim").classList.add("open"); $(sel).classList.add("open");
    if (IS_TV) {
      requestAnimationFrame(function () {
        if (sel === "#settingsSheet") { forceTvSettingsInitialFocus(); return; }
        if (sel === "#sectionSheet") { initTvSectionFocus(); return; }
        var els = sheetFocusables();
        var f = $(sel + " .sec-item.active") || $(sel + " .tv-default-focus") || els[0];
        if (f) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } sheetRing(f); }
      });
    }
  }
  function anySheetOpen() { return $(".sheet.open") != null; }
  function closeSheets() {
    $("#scrim").classList.remove("open");
    $$(".sheet").forEach(function (s) { s.classList.remove("open"); });
    state.nav = { zone: READER_ZONE, col: 0 };
    state.tvSettingsNav = null;
    document.body.removeAttribute("data-tv-settings-focus");
    state.tvSectionIndex = null;
    if (typeof clearChromeFocus === "function") clearChromeFocus();
    clearTvSettingsFocus();
    if (IS_TV) setTvReaderFocus();
  }
  function openSettings() { ensureSettings(); state.draft = normalizeSettings(state.settings); buildSettings(); syncSettingsUI(); openSheet("#settingsSheet"); }

  /* ---- search any du'a by name and jump straight to it ------------------- */
  function goToItem(id) {
    var i, it = null;
    for (i = 0; i < state.sectionItems.length; i++) {
      if (state.sectionItems[i].id === id || state.sectionItems[i].canonical_id === id || state.sectionItems[i].display_id === id) { it = state.sectionItems[i]; break; }
    }
    if (!it) return;
    state.view = { mode: "section", section: it.section, category: state.view.category };
    state.playlist = state.sectionItems.filter(function (x) { return x.section === it.section; }).sort(byDisplayOrder);
    state.index = 0;
    for (i = 0; i < state.playlist.length; i++) { if (state.playlist[i].display_id === it.display_id) { state.index = i; break; } }
    state.pendingScrollTop = 0;
    updateViewLabel(); markViewList(); render(); savePos();
    closeSheets();
  }

  function renderSearch(q) {
    q = (q || "").trim().toLowerCase();
    var res = $("#secResults"), list = $("#secList");
    if (!res || !list) return;
    if (!q) { res.hidden = true; res.innerHTML = ""; list.hidden = false; return; }
    list.hidden = true; res.hidden = false; res.innerHTML = "";
    var matches = [], i;
    for (i = 0; i < state.canonicalItems.length; i++) {
      var it = state.canonicalItems[i];
      var hay = ((it.title || "") + " " + (it.title_ur || "") + " " + (it.category || "") +
                 " " + (it.transliteration || "")).toLowerCase();
      if (hay.indexOf(q) >= 0) matches.push(it);
      if (matches.length >= 50) break;
    }
    if (!matches.length) {
      res.innerHTML = '<div class="sec-empty">' + esc(t("noMatchingDuas")) + '</div>'; return;
    }
    matches.forEach(function (it) {
      var b = document.createElement("button");
      b.className = "sec-item";
      b.setAttribute("data-item-id", it.id || "");
      b.innerHTML = '<span class="sec-name">' + esc(localizeTitle(it)) +
        '<div class="sec-sub">' + esc(localizeCategory(it.category)) + '</div></span>';
      b.addEventListener("click", function () { goToItem(it.id); });
      res.appendChild(b);
    });
  }


  /* ---- settings UI: Display / Content / Navigation / Prayer / About ------ */
  function buildSettings() {
    ensureSettings();
    if (IS_TV) { buildTvSettings(); return; }
    var body = $("#settingsBody"); body.innerHTML = "";

    // 1. READING & DISPLAY
    var read = group(t("grpReadingDisplay"));
    read.appendChild(toggleRow(t("showTagsOnDisplay"), t("showTagsOnDisplayDesc"), "showTags"));
    read.appendChild(stepperRow(t("arabicTextSize"), t("arabicTextSizeDesc"), "arScale"));
    read.appendChild(segRow(t("bismillahSize"), t("bismillahSizeDesc"), "bismillahSize", [["Normal", "normal"], ["Large", "large"], ["XL", "xl"]]));
    read.appendChild(segRow(t("bismillahColor"), t("bismillahColorDesc"), "bismillahColor", [["Olive", "olive"], ["Gold", "gold"], ["Dark", "dark"]]));
    read.appendChild(toggleRow(t("smartSentenceFlow"), t("smartSentenceFlowDesc"), "smartSentenceFlow"));
    read.appendChild(toggleRow(t("waqfPauseSigns"), t("waqfPauseSignsDesc"), "showPauseMarks"));
    read.appendChild(toggleRow(t("tajweed"), t("tajweedDesc"), "tajweed"));
    read.appendChild(toggleRow(t("showWaqfLegend"), t("showWaqfLegendDesc"), "showWaqfLegend"));
    if ((state.draft || state.settings).showWaqfLegend) {
      var legRow = document.createElement("div");
      legRow.className = "set-row waqf-legend-row";
      legRow.style.flexDirection = "column"; legRow.style.alignItems = "stretch";
      legRow.innerHTML = waqfLegendHtml();
      read.appendChild(legRow);
    }
    read.appendChild(toggleRow(t("showTranslitShort"), t("showTranslitDesc"), "showTranslit"));
    read.appendChild(toggleRow(t("showTranslationShort"), t("showEnglishDesc"), "showEnglish"));
    read.appendChild(toggleRow(t("showUrduShort"), t("showUrduDesc"), "showUrdu"));
    body.appendChild(read);

    // 2. APPEARANCE
    var app = group(t("grpAppearance"));
    var tg = document.createElement("div"); tg.className = "theme-grid premium-themes";
    THEMES.filter(function (th) { return th.id !== "high-contrast"; }).forEach(function (theme) {
      var c = document.createElement("button"); c.className = "theme-card"; c.type = "button"; c.setAttribute("data-theme-id", theme.id);
      var tk = "theme_" + theme.id.replace(/-/g, "_");
      c.innerHTML = '<div class="swatch"><div class="a" style="background:' + theme.a + '"></div><div class="b" style="background:' + theme.b + '"></div></div><div class="tname">' + esc(t(tk) || theme.name) + '</div>';
      c.addEventListener("click", function () { var draft = ensureDraft(); draft.theme = theme.id; draft.highContrast = false; applyTheme(theme.id); markThemes(); syncSettingsUI(); });
      tg.appendChild(c);
    });
    app.appendChild(rowCustom(t("theme"), t("themeDesc"), tg, true));
    app.appendChild(segRow(t("arabicTypeface"), t("arabicTypefaceDesc"), "arabicScript", [[t("scriptUthmani"), "uthmani"], [t("scriptIndopak"), "indopak"]]));
    app.appendChild(toggleRow(t("highContrastMode"), t("highContrastModeDesc"), "highContrast"));
    body.appendChild(app);

    // 4. PRAYER BAR
    var pr = group(t("grpPrayerBar"));
    pr.appendChild(toggleRow(t("prayerRibbon"), t("prayerRibbonDesc"), "showRibbon"));
    var locNote = document.createElement("div"); locNote.className = "loc-note"; locNote.textContent = cityLabel((state.draft && state.draft.city) || state.settings.city || "auto");
    pr.appendChild(rowCustom(t("cityLocation"), t("locationDesc"), locNote, false));
    var isOnline = navigator.onLine;
    var conn = document.createElement("div"); conn.className = "loc-note conn-note";
    conn.innerHTML = '<span class="conn-dot2 ' + (isOnline ? "is-online" : "is-offline") + '"></span>' + esc(isOnline ? t("online") : t("lastSaved"));
    pr.appendChild(rowCustom(t("connectionStatus"), "", conn, false));
    body.appendChild(pr);

    // 5. LANGUAGE
    var lang = group(t("grpLanguage"));
    lang.appendChild(segRow(t("language"), t("languageDesc"), "lang", [[t("optEnglish"), "en"], [t("optArabic"), "ar"], [t("optUrdu"), "ur"]]));
    body.appendChild(lang);

    // 6. NAVIGATION & EXPERIENCE
    var nav = group(t("grpNavigationExperience"));
    nav.appendChild(toggleRow(t("autoRotation"), t("autoRotationDesc"), "autoRotate"));
    nav.appendChild(toggleRow(t("swipeNavigation"), t("swipeNavigationDesc"), "swipeNav"));
    nav.appendChild(toggleRow(t("pageProgressIndicator"), t("pageProgressIndicatorDesc"), "showProgress"));
    nav.appendChild(segRow(t("rotationInterval"), t("rotationIntervalDesc"), "interval", [["15s", 15], ["25s", 25], ["40s", 40], ["60s", 60]]));
    body.appendChild(nav);

    // 7. ABOUT (always last)
    var about = group(t("grpAbout"));
    var aboutBtn = document.createElement("button"); aboutBtn.type = "button"; aboutBtn.className = "btn-about"; aboutBtn.textContent = t("openAbout");
    aboutBtn.addEventListener("click", function () { window.location.href = "about.html"; });
    about.appendChild(aboutBtn);
    body.appendChild(about);
  }


  function buildTvSettings() {
    ensureSettings();
    var body = $("#settingsBody"); body.innerHTML = ""; body.classList.add("tv-settings-list");
    var d = state.draft || state.settings;
    tvSetHeader("Reading, prayer ribbon, display, and device preferences");

    body.appendChild(tvStepperRow("Arabic text size", "A− / A+ changes Arabic size live.", "arScale", 0.1, 0.7, 1.4, true));
    body.appendChild(tvStepperRow("Transliteration size", "Adjust transliteration size.", "tlScale", 0.1, 0.7, 1.9, false));
    body.appendChild(tvStepperRow("Translation size", "Adjust English/Urdu translation size.", "trScale", 0.1, 0.7, 1.9, false));
    body.appendChild(tvSectionHeader("Reading"));
    body.appendChild(tvSegRow("Bismillah size", "Choose the display size for Bismillah.", "bismillahSize", [["Small", "small"], ["Med", "medium"], ["Large", "large"], ["XL", "xl"]], "بسم"));
    body.appendChild(tvSegRow("Arabic script", "Choose Uthmani or Indo-Pak Arabic style for TV reading.", "arabicScript", [["Uthmani", "uthmani"], ["Indo-Pak", "indopak"]], "ش"));
    body.appendChild(tvToggleRow("Show transliteration", "Show or hide Latin transliteration.", "showTranslit", "Aa"));
    body.appendChild(tvToggleRow("Show English translation", "Show or hide English translation.", "showEnglish", "EN"));
    body.appendChild(tvToggleRow("Show item name", "Show or hide the item name/title above Arabic text.", "showTitle", "T"));
    body.appendChild(tvToggleRow("Show Urdu translation", "Show or hide Urdu translation.", "showUrdu", "Ur"));

    body.appendChild(tvSectionHeader("Appearance"));
    body.appendChild(tvSegRow("Theme", "Choose a clean Light or Dark appearance.", "theme", [["Dark", "dark-ambient"], ["Light", "elder-light"]], "◑"));
    body.appendChild(tvToggleRow("Tajweed colouring", "Colour-codes Qur'anic items by recitation rule.", "tajweed", "ت"));
    body.appendChild(tvToggleRow("Show tags on card", "Show or hide category tags on the reading card.", "showTags", "⌑"));
    body.appendChild(tvToggleRow("Show reference", "Show or hide source/reference at the bottom.", "showSource", "▤"));
    body.appendChild(tvToggleRow("Show waqf legend", "Show or hide compact Waqf guide in Settings.", "showWaqfLegend", "؟"));
    body.appendChild(tvToggleRow("Page progress indicator", "Show or hide the bottom progress bar and counter.", "showProgress", "#"));

    body.appendChild(tvSectionHeader("Prayer"));
    body.appendChild(tvToggleRow("Prayer ribbon", "Show or hide the merged next-prayer header immediately.", "showRibbon", "▰"));
    body.appendChild(tvSegRow("Prayer header detail", "TV-only control for how much Salah/status data appears in the top header.", "prayerHeaderDetail", [["Off", "off"], ["Min", "minimal"], ["Std", "standard"], ["Full", "full"]], "☾"));
    body.appendChild(tvCycleRow("Manual city override", "Use Left / Right to select a reliable city for prayer times.", "city", [["Auto", "auto"], ["Riyadh", "riyadh"], ["Jeddah", "jeddah"], ["Makkah", "makkah"], ["Madinah", "madinah"], ["Dammam", "dammam"]], "⌖"));
    body.appendChild(tvInfoRow("Connection & prayer time source", (navigator.onLine ? "Connected" : "Offline") + " · Aladhan / local fallback", navigator.onLine ? "● Connected" : "● Last saved", "⌁"));

    body.appendChild(tvSectionHeader("Reading behaviour"));
    body.appendChild(tvToggleRow("Fit full content on one screen", "On keeps short duas fully visible; Off allows larger scrollable text.", "tvFit", "▣"));
    body.appendChild(tvToggleRow("Show waqf/pause marks", "Show waqf and pause indicators where appropriate.", "showPauseMarks", "Ⅱ"));
    body.appendChild(tvToggleRow("Auto rotation", "Automatically move to the next card.", "autoRotate", "▶"));
    body.appendChild(tvSegRow("Display duration", "Auto-rotation timing per card.", "interval", [["15 sec", 15], ["30 sec", 30], ["45 sec", 45], ["60 sec", 60]], "⏱"));
    if (!d.deviceProfile || d.deviceProfile === "auto") d.deviceProfile = "tv";
    syncSettingsUI();
    if (IS_TV && $("#settingsSheet.open")) initTvSettingsFocus(false);
  }

  function tvSetHeader(subtitle) {
    var h = $("#settingsSheet .sheet-head h2");
    if (h) h.setAttribute("data-tv-subtitle", subtitle);
  }

  function tvSectionHeader(title) {
    var h = document.createElement("div");
    h.className = "tv-settings-section";
    h.textContent = title || "";
    return h;
  }

  function tvRowShell(name, desc, iconText) {
    var r = document.createElement("div"); r.className = "tv-set-row";
    var ic = document.createElement("div"); ic.className = "tv-set-icon"; ic.textContent = iconText || "•";
    var lab = document.createElement("div"); lab.className = "tv-set-label";
    lab.innerHTML = '<div class="tv-set-name">' + esc(name) + '</div>' + (desc ? '<div class="tv-set-desc">' + esc(desc) + '</div>' : "");
    var ctrl = document.createElement("div"); ctrl.className = "tv-set-control";
    r.appendChild(ic); r.appendChild(lab); r.appendChild(ctrl);
    return { row:r, control:ctrl };
  }

function applyTvLivePreviewValues(model) {
  if (!IS_TV || !model) return;
  model = normalizeSettings(model);
  var reader = $("#reader");
  var it = state.playlist[state.index];
  if (reader && it) {
    var ar = autoSize(it.size_mode, model.arScale);
    var tl = Math.round(((it.size_mode === "short" ? 18 : 16) + 4) * model.tlScale);
    var tr = Math.round(((it.size_mode === "short" ? 19 : 17) + 4) * model.trScale);
    reader.style.setProperty("--ar-size", ar + "px");
    reader.style.setProperty("--tl-size", tl + "px");
    reader.style.setProperty("--tr-size", tr + "px");
    reader.style.setProperty("--ar-lh", IS_TV ? "1.58" : (model.arabicScript === "indopak" ? "1.72" : "1.34"));

    var arEl = $("#mArabic");
    if (arEl) {
      arEl.style.setProperty("font-size", ar + "px", "important");
      arEl.style.setProperty("line-height", IS_TV ? "1.58" : (model.arabicScript === "indopak" ? "1.72" : "1.34"), "important");
      arEl.style.fontFamily = IS_TV ? AR_FONTS.scheherazade : ((model.arabicScript === "indopak") ? AR_FONTS.nastaliq : (AR_FONTS[model.arabicFont] || AR_FONTS.scheherazade));
    }

    var tlEl = $("#mTranslit");
    if (tlEl) {
      tlEl.style.setProperty("font-size", tl + "px", "important");
    }
    ["#mTranslation", "#mEnglish", "#mUrdu"].forEach(function (sel) {
      var trEl = $(sel);
      if (trEl) trEl.style.setProperty("font-size", tr + "px", "important");
    });
  }
  var bism = $("#mBismillah");
  if (bism) {
    bism.setAttribute("data-bismillah-size", model.bismillahSize || "small");
    bism.setAttribute("data-bismillah-color", model.bismillahColor || model.themeAccent || "olive");
  }
  var ribbon = $("#prayerRibbon");
  var prayerDetail = model.prayerHeaderDetail || DEFAULTS.prayerHeaderDetail;
  document.body.setAttribute("data-tv-prayer-detail", prayerDetail);
  if (ribbon) ribbon.classList.toggle("hide", model.showRibbon === false || (IS_TV && prayerDetail === "off"));
  document.body.classList.toggle("tv-prayer-hidden", model.showRibbon === false || (IS_TV && prayerDetail === "off"));
  document.body.classList.toggle("hide-progress", model.showProgress === false);
  document.body.classList.toggle("show-tags", !!model.showTags);
  var titleEl = $("#mTitle");
  if (titleEl) titleEl.classList.toggle("hidden", model.showTitle === false || !titleEl.textContent);
  document.body.classList.toggle("tv-accent-gold", model.themeAccent === "gold");
  document.body.classList.toggle("tv-accent-green", model.themeAccent === "green");
  document.body.classList.toggle("tv-accent-olive", model.themeAccent !== "gold" && model.themeAccent !== "green");
  applyTheme(model.theme);
  if (IS_TV) {
    requestAnimationFrame(function () {
      var arEl = $("#mArabic"), it2 = state.playlist[state.index], reader2 = $("#reader");
      if (arEl && it2 && reader2) {
        fitContent(arEl, autoSize(it2.size_mode, model.arScale),
          Math.round(((it2.size_mode === "short" ? 18 : 16) + 4) * model.tlScale),
          Math.round(((it2.size_mode === "short" ? 19 : 17) + 4) * model.trScale));
      }
    });
  }
}

function commitTvDraftLive(rebuildView, renderView) {
  if (!IS_TV || !state.draft) return;
  var keepNav = state.tvSettingsNav ? { row: state.tvSettingsNav.row, option: state.tvSettingsNav.option } : null;
  state.draft = normalizeSettings(state.draft);
  state.draft.showTranslation = !!state.draft.showEnglish;
  if (!state.draft.deviceProfile || state.draft.deviceProfile === "auto") state.draft.deviceProfile = "tv";
  state.draft.tvVisualRevision = "I-36-tv-visual-proof-layout-closure";
  if (state.draft.highContrast) state.draft.theme = "high-contrast";

  state.settings = Object.assign({}, state.draft);
  save();
  applyBodyFlags();
  applyTheme(state.settings.theme);
  applyTvLivePreviewValues(state.settings);

  if (rebuildView) buildViewList();
  updateViewLabel();
  setAuto(!!state.settings.autoRotate);
  setupPrayer();
  if (renderView !== false) render();
  if (keepNav) state.tvSettingsNav = keepNav;
  requestAnimationFrame(function () {
    applyTvLivePreviewValues(state.settings);
    syncSettingsUI();
    if (keepNav) setTvSettingsFocus(keepNav.row, keepNav.option, false);
  });
}

  function tvToggleRow(name, desc, key, iconText) {
    var sh = tvRowShell(name, desc, iconText);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tv-toggle";
    b.setAttribute("data-tv-toggle", key);

    b.onclick = function () {
      var draft = ensureDraft();
      draft[key] = !draft[key];
      if (key === "showEnglish") draft.showTranslation = !!draft.showEnglish;

      // Immediate TV live update for all visual toggles.
      applyTvLivePreviewValues(normalizeSettings(draft));
      commitTvDraftLive(key === "showProgress", false);
      if (key === "showWaqfLegend") buildTvSettings();
      syncSettingsUI();
      refreshTvSettingsFocus();
    };

    sh.control.appendChild(b);
    return sh.row;
}

  function tvInfoRow(name, desc, value, iconText) {
    var sh = tvRowShell(name, desc, iconText);
    var v = document.createElement("span"); v.className = "tv-info-value"; v.textContent = value || "";
    sh.control.appendChild(v); return sh.row;
  }

  function tvSegRow(name, desc, key, opts, iconText) {
  var sh = tvRowShell(name, desc, iconText);
  var seg = document.createElement("div"); seg.className = "tv-seg"; seg.setAttribute("data-seg", key);
  opts.forEach(function (o) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = o[0];
    b.setAttribute("data-val", JSON.stringify(o[1]));
    b.setAttribute("data-tv-option-label", o[0]);
    if (key === "themeAccent") b.setAttribute("data-accent", o[1]);
    b.addEventListener("click", function () {
      var draft = ensureDraft();
      draft[key] = o[1];
      if (key === "theme") draft.highContrast = o[1] === "high-contrast";
      // TV visual segments apply instantly without re-render flicker.
      var liveOnly = key === "theme" || key === "themeAccent" || key === "bismillahSize";
      commitTvDraftLive(key === "deviceProfile" || key === "arabicScript", !liveOnly);
      syncSettingsUI();
      refreshTvSettingsFocus();
    });
    seg.appendChild(b);
  });
  sh.control.appendChild(seg); return sh.row;
}

  function tvCycleRow(name, desc, key, opts, iconText) {
    var sh = tvRowShell(name, desc, iconText);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tv-cycle";
    b.setAttribute("data-tv-cycle", key);
    b.setAttribute("aria-label", name);
    b._tvOptions = opts.slice();
    b.innerHTML = '<span class="tv-cycle-arrow">‹</span><span class="tv-cycle-value" data-cycle-val="' + esc(key) + '"></span><span class="tv-cycle-arrow">›</span>';
    b.addEventListener("click", function () { tvCycleChoice(b, 1); });
    sh.control.appendChild(b);
    return sh.row;
  }

  function tvCycleChoice(btn, dir) {
    if (!btn) return;
    var draft = ensureDraft();
    var key = btn.getAttribute("data-tv-cycle");
    var opts = btn._tvOptions || [];
    if (!key || !opts.length) return;
    var cur = draft[key], idx = 0;
    for (var i = 0; i < opts.length; i++) { if (opts[i][1] === cur) { idx = i; break; } }
    idx = (idx + dir + opts.length) % opts.length;
    draft[key] = opts[idx][1];
    commitTvDraftLive(false);
    syncSettingsUI();
    refreshTvSettingsFocus();
  }

  function setupPrayerPreviewCity(city) {
    if (!city || city === "auto") return;
    var saved = state.settings;
    state.settings = Object.assign({}, state.settings, { city: city });
    setupPrayer();
    state.settings = saved;
  }

  function tvStepperRow(name, desc, key, step, min, max, defaultFocus) {
    var sh = tvRowShell(name, desc, "Aَ");
    var st = document.createElement("div");
    st.className = "tv-stepper";
    st.setAttribute("data-stepper", key);
    st.setAttribute("data-step", String(step));
    st.setAttribute("data-min", String(min));
    st.setAttribute("data-max", String(max));

    var minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "A−";
    minus.setAttribute("aria-label", name + " smaller");
    minus.setAttribute("data-step-dir", "-1");

    var val = document.createElement("span");
    val.className = "tv-step-val val";
    val.setAttribute("data-val", key);

    var plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "A+";
    plus.setAttribute("aria-label", name + " larger");
    plus.setAttribute("data-step-dir", "1");
    if (defaultFocus) plus.classList.add("tv-default-focus");

    function clamp(v) {
      return Math.min(max, Math.max(min, Math.round(v * 100) / 100));
    }

    function applyStep(dir) {
      var draft = ensureDraft();
      var current = Number(draft[key]);
      if (!isFinite(current)) current = DEFAULTS[key] || (key === "arScale" ? 0.7 : 1.0);
      draft[key] = clamp(current + (dir * step));

      // Immediate TV live preview before saving/re-rendering.
      applyTvLivePreviewValues(normalizeSettings(draft));
      commitTvDraftLive(false, false);
      syncSettingsUI();
      refreshTvSettingsFocus();
    }

    minus.addEventListener("click", function () { applyStep(-1); });
    plus.addEventListener("click", function () { applyStep(1); });

    st.appendChild(minus);
    st.appendChild(val);
    st.appendChild(plus);
    sh.control.appendChild(st);
    return sh.row;
}

  function group(title) {
    var g = document.createElement("div"); g.className = "set-group";
    var h = document.createElement("div"); h.className = "grp-title"; h.textContent = title;
    g.appendChild(h); return g;
  }
  function rowCustom(name, desc, control, stacked) {
    var r = document.createElement("div"); r.className = "set-row";
    if (stacked) { r.style.flexDirection = "column"; r.style.alignItems = "stretch"; }
    var lab = document.createElement("div"); lab.className = "label";
    lab.innerHTML = '<div class="name">' + esc(name) + '</div>' + (desc ? '<div class="desc">' + esc(desc) + '</div>' : "");
    r.appendChild(lab);
    if (stacked) control.style.marginTop = "12px";
    r.appendChild(control); return r;
  }
  function toggleRow(name, desc, key) {
    var sw = document.createElement("label"); sw.className = "switch";
    var inp = document.createElement("input"); inp.type = "checkbox"; inp.setAttribute("data-key", key);
    var tr = document.createElement("span"); tr.className = "track";
    inp.addEventListener("change", function () {
      var draft = ensureDraft();
      draft[key] = inp.checked;
      if (key === "showEnglish") draft.showTranslation = inp.checked;
      if (key === "showWaqfLegend") { buildSettings(); syncSettingsUI(); return; }
      if (key === "easyView") { document.body.classList.toggle("easy", inp.checked); previewFonts(); }
      if (key === "showArabic" || key === "showTranslit" || key === "showEnglish" || key === "showUrdu" || key === "showSource" || key === "showTitle" || key === "showPauseMarks" || key === "tajweed" || key === "smartSentenceFlow" || key === "showProgress") previewFonts();
      if (key === "highContrast") { applyTheme(inp.checked ? "high-contrast" : (draft.theme || "elder-light")); }
    });
    sw.appendChild(inp); sw.appendChild(tr);
    return rowCustom(name, desc, sw, false);
  }
  function segRow(name, desc, key, opts) {
    var seg = document.createElement("div"); seg.className = "seg"; seg.setAttribute("data-seg", key);
    opts.forEach(function (o) {
      var b = document.createElement("button"); b.textContent = o[0]; b.setAttribute("data-val", JSON.stringify(o[1]));
      b.addEventListener("click", function () {
        var draft = ensureDraft();
        draft[key] = o[1];
        $$("button", seg).forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        if (key === "arabicScript" || key === "arabicWeight" || key === "lang" || key === "bismillahSize" || key === "bismillahColor") { if (key === "lang") { var savedLang = state.settings.lang; state.settings.lang = draft.lang; applyLang(); state.settings.lang = savedLang; } previewFonts(); }
      });
      seg.appendChild(b);
    });
    return rowCustom(name, desc, seg, false);
  }
  function stepperRow(name, desc, key) {
    var st = document.createElement("div"); st.className = "stepper";
    var minus = document.createElement("button"); minus.textContent = "−"; minus.setAttribute("aria-label", name + " smaller");
    var val = document.createElement("span"); val.className = "val"; val.setAttribute("data-val", key);
    var plus = document.createElement("button"); plus.textContent = "+"; plus.setAttribute("aria-label", name + " larger");
    function clamp(v) { return Math.min(2.0, Math.max(0.7, Math.round(v * 100) / 100)); }
    minus.addEventListener("click", function () { var draft = ensureDraft(); draft[key] = clamp(draft[key] - 0.1); val.textContent = pct(draft[key]); previewFonts(); });
    plus.addEventListener("click", function () { var draft = ensureDraft(); draft[key] = clamp(draft[key] + 0.1); val.textContent = pct(draft[key]); previewFonts(); });
    st.appendChild(minus); st.appendChild(val); st.appendChild(plus);
    return rowCustom(name, desc, st, false);
  }
  function pct(v) { return Math.round(v * 100) + "%"; }
  function selectRow(name, desc, key, opts) {
    var sel = document.createElement("select"); sel.className = "set-select"; sel.setAttribute("data-key", key);
    opts.forEach(function (o) {
      var op = document.createElement("option"); op.value = o[1]; op.textContent = o[0]; sel.appendChild(op);
    });
    sel.value = (state.draft && state.draft[key]) || (state.settings && state.settings[key]) || (opts[0] && opts[0][1]);
    sel.addEventListener("change", function () { var draft = ensureDraft(); draft[key] = sel.value; previewFonts(); });
    return rowCustom(name, desc, sel, false);
  }
  function settingsModel() {
    return state.draft ? normalizeSettings(state.draft) : ensureSettings();
  }
  function previewFonts() {
    if (!state.draft) return;
    state.draft = normalizeSettings(state.draft);
    var saved = state.settings;
    state.settings = state.draft;
    render();
    state.settings = saved;
  }

  function syncSettingsUI() {
    ensureSettings();
    var model = settingsModel();
    markThemes();
    $$("input[type=checkbox][data-key]").forEach(function (i) { i.checked = !!model[i.getAttribute("data-key")]; });
    $$("select[data-key]").forEach(function (s) { s.value = model[s.getAttribute("data-key")]; });
    $$(".seg[data-seg]").forEach(function (seg) {
      var key = seg.getAttribute("data-seg");
      $$("button", seg).forEach(function (b) {
        var active = JSON.stringify(model[key]) === b.getAttribute("data-val");
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
    });
    $$(".val[data-val]").forEach(function (v) {
      var key = v.getAttribute("data-val");
      v.textContent = pct(model[key]);
      v.setAttribute("aria-label", key + " " + pct(model[key]));
    });
    $$(".tv-toggle[data-tv-toggle]").forEach(function (b) {
      var key = b.getAttribute("data-tv-toggle"), on = !!model[key];
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
      b.textContent = on ? "On" : "Off";
    });
    $$(".tv-seg[data-seg]").forEach(function (seg) {
      var key = seg.getAttribute("data-seg");
      $$("button", seg).forEach(function (b) {
        var active = JSON.stringify(model[key]) === b.getAttribute("data-val");
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
    });
    $$(".tv-cycle[data-tv-cycle]").forEach(function (btn) {
      var key = btn.getAttribute("data-tv-cycle"), opts = btn._tvOptions || [], val = model[key], label = "";
      for (var i = 0; i < opts.length; i++) { if (opts[i][1] === val) { label = opts[i][0]; break; } }
      if (key === "city") label = cityLabel(val || "auto");
      var v = btn.querySelector(".tv-cycle-value"); if (v) v.textContent = label || val || "—";
      btn.setAttribute("aria-label", key + ": " + (label || val || ""));
    });
    refreshTvSettingsFocus();
  }
  function markThemes() {
    var model = settingsModel();
    $$(".theme-card").forEach(function (c) { c.classList.toggle("active", c.getAttribute("data-theme-id") === model.theme); });
  }

  function applySettings() {
    ensureSettings();
    ensureDraft();
    var prevFlow = state.settings.flowMode;
    state.draft.showTranslation = !!state.draft.showEnglish;
    if (IS_TV && (!state.draft.deviceProfile || state.draft.deviceProfile === "auto")) state.draft.deviceProfile = "tv";
    if (IS_TV) state.draft.tvVisualRevision = "I-36-tv-visual-proof-layout-closure";
    state.settings = Object.assign({}, state.draft);
    if (state.settings.highContrast) state.settings.theme = "high-contrast";
    save();
    applyBodyFlags();
    applyTheme(state.settings.theme);
    applyLang();
    buildViewList();
    buildSettings();
    updateViewLabel();
    var detail = state.settings.prayerHeaderDetail || DEFAULTS.prayerHeaderDetail;
    $("#prayerRibbon").classList.toggle("hide", !state.settings.showRibbon || (IS_TV && detail === "off"));
    // Rev I-36: Save & Apply resumes auto-rotation when auto mode is enabled.
    // Clear any prior OK pause and restart the timer from the selected Display Duration.
    state.autoPaused = false;
    setAuto(state.settings.autoRotate);
    setupPrayer();
    // If default flow preference changed and we are in mixed/category, honour it.
    if (state.settings.flowMode !== prevFlow && state.view.mode !== "section") {
      state.view.mode = state.settings.flowMode === "mixed" ? "mixed" : "category";
    }
    rebuildPlaylist(true);
    closeSheets();
    toast(t("settingsSaved"));
  }

  /* ---- prayer ribbon (global, location-aware) ---------------------------- */
  // Calculation method per country (Aladhan IDs). Falls back to MWL (3).
  function methodForCountry(cc) {
    var M = { SA:4, AE:16, KW:9, QA:10, BH:8, OM:8, EG:5, TR:13, PK:1, IN:1, BD:1,
              ID:20, MY:17, SG:11, RU:14, FR:12, US:2, CA:2, GB:3, IR:7 };
    return M[(cc || "").toUpperCase()] || 3;
  }
  function loadLoc() { try { return JSON.parse(localStorage.getItem(LS_LOC) || "null"); } catch (e) { return null; } }
  function saveLoc(l) { try { localStorage.setItem(LS_LOC, JSON.stringify(l)); } catch (e) {} }
  function loadPrayerCache() { try { return JSON.parse(localStorage.getItem(LS_PRAYER) || "null"); } catch (e) { return null; } }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function savePrayerCache(city, timings, status, cityId) {
    try { localStorage.setItem(LS_PRAYER, JSON.stringify({ date: todayIso(), city: city || t("myLocation"), cityId: cityId || "auto", timings: timings, status: status || t("online") })); } catch (e) {}
  }
  function deg2rad(d) { return d * Math.PI / 180; }
  function rad2deg(r) { return r * 180 / Math.PI; }
  function dayOfYear(d) {
    var start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000);
  }
  function normMinutes(m) { m = Math.round(m); while (m < 0) m += 1440; while (m >= 1440) m -= 1440; return m; }
  function fmtMinutes(m) { m = normMinutes(m); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  function hourAngleMinutes(lat, decl, altitude) {
    var cosH = (Math.sin(deg2rad(altitude)) - Math.sin(deg2rad(lat)) * Math.sin(deg2rad(decl))) / (Math.cos(deg2rad(lat)) * Math.cos(deg2rad(decl)));
    cosH = Math.max(-1, Math.min(1, cosH));
    return rad2deg(Math.acos(cosH)) * 4;
  }
  function calculateCityPrayer(cityId, d) {
    var c = CITY_COORDS[cityId]; if (!c) return null;
    d = d || new Date();
    var n = dayOfYear(d);
    var gamma = 2 * Math.PI / 365 * (n - 1);
    var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    var decl = rad2deg(0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma));
    var noon = 720 - 4 * c.lng - eq + c.tz * 60;
    var sunsetDelta = hourAngleMinutes(c.lat, decl, -0.833);
    var fajrDelta = hourAngleMinutes(c.lat, decl, -18.5);
    var asrAlt = rad2deg(Math.atan(1 / (1 + Math.tan(deg2rad(Math.abs(c.lat - decl))))));
    var asrDelta = hourAngleMinutes(c.lat, decl, asrAlt);
    var maghrib = noon + sunsetDelta;
    return { Fajr:fmtMinutes(noon - fajrDelta), Dhuhr:fmtMinutes(noon + 2), Asr:fmtMinutes(noon + asrDelta), Maghrib:fmtMinutes(maghrib + 2), Isha:fmtMinutes(maghrib + 92) };
  }

  // Resolve a {lat,lng,city,country} globally: GPS first, then network/IP.
  // The native host requests OS permission only when WebView geolocation asks.
  function resolveLocation(cb) {
    var cached = loadLoc(), done = false;
    function finish(loc) { if (done) return; done = true; if (loc) saveLoc(loc); cb(loc || cached || null); }
    if (navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(
          function (pos) { finish({ lat: pos.coords.latitude, lng: pos.coords.longitude, city: (cached && cached.city) || "", country: (cached && cached.country) || "", src: "gps" }); },
          function () { ipLookup(finish, cached); },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
        );
      } catch (e) { ipLookup(finish, cached); }
    } else ipLookup(finish, cached);
    setTimeout(function () { if (!done) finish(cached); }, 9000);
  }

  function ipLookup(finish, cached) {
    if (!navigator.onLine) { finish(cached); return; }
    fetch("https://ipapi.co/json/").then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.latitude && j.longitude) finish({ lat: j.latitude, lng: j.longitude, city: j.city || j.region || "", country: j.country_code || j.country || "", src: "ip" });
      else finish(cached);
    }).catch(function () {
      fetch("https://ipwho.is/").then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.success && j.latitude) finish({ lat: j.latitude, lng: j.longitude, city: j.city || "", country: (j.country_code || ""), src: "ip" });
        else finish(cached);
      }).catch(function () { finish(cached); });
    });
  }

  function setupPrayer() {
    ensureSettings();
    var s = state.settings;
    var ribbon = $("#prayerRibbon");
    var prayerDetail = s.prayerHeaderDetail || DEFAULTS.prayerHeaderDetail;
    if (ribbon) {
      ribbon.classList.toggle("hide", !s.showRibbon || (IS_TV && prayerDetail === "off"));
      ribbon.setAttribute("data-detail", prayerDetail);
      ribbon.classList.toggle("manual-city", !!(IS_TV && s.city && s.city !== "auto"));
    }
    document.body.setAttribute("data-tv-prayer-detail", prayerDetail);
    if (!s.showRibbon || (IS_TV && prayerDetail === "off")) return;

    if (s.city && s.city !== "auto") {
      var cityId = s.city;
      var cityName = cityLabel(cityId) || t("selectedCity");
      var cityApiName = CITY_LABEL_EN[cityId] || cityName;
      $("#prayerCity").textContent = cityName;
      var localFallback = function () {
        var cache = loadPrayerCache();
        if (cache && cache.cityId === cityId && cache.date === todayIso() && cache.timings) { showPrayer(cache.timings, true, t("lastSaved")); return; }
        var calc = calculateCityPrayer(cityId, new Date());
        if (calc) { savePrayerCache(cityName, calc, t("approximate"), cityId); showPrayer(calc, true, t("approximate")); return; }
        showPrayer(APPROX[cityId], true, t("approximate"));
      };
      if (navigator.onLine) {
        var u = "https://api.aladhan.com/v1/timingsByCity?city=" + encodeURIComponent(cityApiName) + "&country=Saudi%20Arabia&method=4";
        fetch(u).then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.data && j.data.timings) { var tt = trim5(j.data.timings); savePrayerCache(cityName, tt, t("online"), cityId); showPrayer(tt, false, t("online")); }
          else localFallback();
        }).catch(localFallback);
      } else localFallback();
      return;
    }

    $("#prayerCity").textContent = t("locating");
    resolveLocation(function (loc) {
      var cache = loadPrayerCache();
      if (!loc) { showPrayerUnavailable(cache); return; }
      var city = loc.city || t("myLocation");
      $("#prayerCity").textContent = city;
      if (!navigator.onLine) { showPrayerUnavailable(cache, city); return; }
      var url = "https://api.aladhan.com/v1/timings?latitude=" + encodeURIComponent(loc.lat) + "&longitude=" + encodeURIComponent(loc.lng) + "&method=" + methodForCountry(loc.country);
      fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.data && j.data.timings) { var tt = trim5(j.data.timings); savePrayerCache(city, tt, t("online")); showPrayer(tt, false, t("online")); }
        else showPrayerUnavailable(cache, city);
      }).catch(function () { showPrayerUnavailable(cache, city); });
    });
  }
  function trim5(t) { return { Fajr: t.Fajr, Dhuhr: t.Dhuhr, Asr: t.Asr, Maghrib: t.Maghrib, Isha: t.Isha }; }
  function showPrayerUnavailable(cache, city) {
    if (cache && cache.timings && cache.date === todayIso()) { $("#prayerCity").textContent = cache.city || city || t("lastSaved"); showPrayer(cache.timings, true, t("lastSaved")); return; }
    $("#prayerNext").textContent = t("prayerUnavailable");
    $("#prayerCity").textContent = city || t("autoLocation");
    $("#prayerTime").textContent = "--:--";
    setConnDot("offline");
  }
  function showPrayer(timings, approx, statusText) {
    if (!timings) { showPrayerUnavailable(null); return; }
    var order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    var now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes(), next = null;
    for (var i = 0; i < order.length; i++) {
      var p = timings[order[i]]; if (!p) continue;
      var hm = p.split(":"), m = parseInt(hm[0], 10) * 60 + parseInt(hm[1], 10);
      if (m >= nowMin) { next = { name: order[i], time: p }; break; }
    }
    if (!next) next = { name: "Fajr", time: timings.Fajr || "--:--" };
    $("#prayerNext").textContent = localizePrayerName(next.name);
    $("#prayerTime").textContent = next.time;
    setConnDot(approx ? "approx" : (navigator.onLine ? "online" : "offline"));
  }
  function setConnDot(stateName) {
    var el = $("#prayerApprox"); if (!el) return;
    var label = stateName === "online" ? t("online") : (stateName === "approx" ? t("approximate") : t("lastSaved"));
    var detail = document.body.getAttribute("data-tv-prayer-detail") || (state.settings && state.settings.prayerHeaderDetail) || DEFAULTS.prayerHeaderDetail;
    el.textContent = IS_TV ? (detail === "full" ? label : "") : label;
    el.classList.toggle("conn-text", !!(IS_TV && detail === "full"));
    el.setAttribute("data-conn-state", stateName);
    el.classList.add("conn-dot");
    el.classList.toggle("is-online", stateName === "online");
    el.classList.toggle("is-offline", stateName === "offline");
    el.classList.toggle("is-approx", stateName === "approx");
    el.setAttribute("aria-label", label); el.setAttribute("title", label);
    el.style.display = IS_TV ? "inline-flex" : "inline-block";
  }
  // Live connection state: flip online/offline immediately, never overriding an
  // explicit "approximate location" state set by the prayer logic.
  function refreshConnDot() {
    var el = $("#prayerApprox"); if (!el) return;
    if (el.classList.contains("is-approx")) return;
    setConnDot(navigator.onLine ? "online" : "offline");
  }

  /* ---- restore position -------------------------------------------------- */
  function restorePosition() {
    ensureSettings();
    try {
      var p = JSON.parse(localStorage.getItem(LS_POS) || "null");
      if (p && p.view && p.view.mode) {
        state.view = p.view;
        state.index = p.index || 0;
        state.pendingScrollTop = Math.max(0, p.scrollTop || 0);
      } else {
        state.view.mode = state.settings.flowMode === "category" ? "category" : "mixed";
      }
    } catch (e) { state.view.mode = "mixed"; state.pendingScrollTop = 0; }
    var detail = state.settings.prayerHeaderDetail || DEFAULTS.prayerHeaderDetail;
    $("#prayerRibbon").classList.toggle("hide", !state.settings.showRibbon || (IS_TV && detail === "off"));
    setAuto(state.settings.autoRotate);
  }

  /* ---- utils ------------------------------------------------------------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  var toastTimer = null;
  function toast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  function tvToast(msg) {
    if (!IS_TV) { toast(msg); return; }
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show", "tv-toast");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show", "tv-toast"); }, 1250);
  }

  function tvMainKey(key) {
    if (!IS_TV) return false;
    key = normalizeTvKey(key);

    var allowed = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " ", "Escape", "Settings"];
    if (allowed.indexOf(key) === -1) return false;

    // Overlays always take priority.
    if ($("#settingsSheet.open")) return !!tvSettingsKey(key);
    if ($("#sectionSheet.open")) return !!tvSectionKey(key);
    if (anySheetOpen()) {
      if (key === "Escape" || key === "Settings") { closeSheets(); setTvReaderFocus(); return true; }
      return true;
    }

    if (key === "Settings") { openSettings(); return true; }

    var isPopout = document.body.classList.contains("tv-reading-popout");
    var sc = $("#readerScroll");

    // Pop-out has a locked remote model: Up/Down scroll, OK pause/resume,
    // Left/Right navigate, Back exits pop-out before app exit.
    if (isPopout) {
      if (key === "Escape") return exitTvPopout();
      if (key === "ArrowUp") {
        if (readerCanScroll(-1)) scrollReader(-Math.round((sc && sc.clientHeight || 500) * 0.56));
        return true;
      }
      if (key === "ArrowDown") {
        if (readerCanScroll(1)) scrollReader(Math.round((sc && sc.clientHeight || 500) * 0.56));
        return true;
      }
      if (key === "ArrowLeft") { state.tvPopoutDismissedItemId = null; go(-1); pokeAuto(); return true; }
      if (key === "ArrowRight") { state.tvPopoutDismissedItemId = null; go(1); pokeAuto(); return true; }
      if (key === "Enter" || key === " ") return toggleAutoPause();
      return true;
    }

    if (!state.tvMainArea) state.tvMainArea = "reader";

    if (key === "Escape") {
      if (state.tvMainArea === "top") return setTvReaderFocus();
      return false;
    }

    if (state.tvMainArea === "top") {
      if (key === "ArrowLeft")  return setTvTopFocus((state.tvTopIndex || 0) - 1);
      if (key === "ArrowRight") return setTvTopFocus((state.tvTopIndex || 0) + 1);
      if (key === "ArrowDown")  return setTvReaderFocus();
      if (key === "ArrowUp")    return setTvTopFocus(state.tvTopIndex || tvHeaderDefaultCol());
      if (key === "Enter" || key === " ") return tvActivateTopControl();
      return true;
    }

    // Reader area.
    if (key === "ArrowUp") {
      if (readerCanScroll(-1)) scrollReader(-Math.round((sc && sc.clientHeight || 500) * 0.55));
      else setTvTopFocus(tvHeaderDefaultCol());
      return true;
    }
    if (key === "ArrowDown") {
      if (readerCanScroll(1)) scrollReader(Math.round((sc && sc.clientHeight || 500) * 0.55));
      return true;
    }
    if (key === "ArrowLeft")  { state.tvPopoutDismissedItemId = null; go(-1); pokeAuto(); return true; }
    if (key === "ArrowRight") { state.tvPopoutDismissedItemId = null; go(1); pokeAuto(); return true; }
    if (key === "Enter" || key === " ") {
      if (reopenTvPopoutIfDismissed()) return true;
      return toggleAutoPause();
    }

    return false;
  }

  // Native TV key bridge used by Android WebView on real remote hardware.
  // Rev I-36: deterministic TV command router, not browser click simulation.
  window.__azkarTvKey = function (key) {
    if (!IS_TV) return false;
    try { return !!tvMainKey(key); } catch (e) { return false; }
  };

  // Native back button hook (closes an open sheet before exiting)
  window.onTvBack = function () {
    if ($("#settingsSheet.open")) { closeSheets(); setTvReaderFocus(); return true; }
    if (document.body.classList.contains("tv-reading-popout")) return exitTvPopout();
    if ($("#sectionSheet.open") || anySheetOpen()) { closeSheets(); setTvReaderFocus(); return true; }
    return false;
  };

  // Rev I-36: headless TV visual proof hook. Production UI is unchanged; this
  // controlled hook lets CI render known problem records with reading layers ON/OFF.
  function azkarProbeFindItem(query) {
    var q = normToken(query);
    var pool = (state.sectionItems || []).concat(state.canonicalItems || [], state.allItems || []);
    var seen = {}, best = null;
    for (var i = 0; i < pool.length; i++) {
      var it = pool[i];
      if (!it) continue;
      var key = it.display_id || it.id || (it.title + i);
      if (seen[key]) continue;
      seen[key] = true;
      var hay = normToken([it.display_id, it.id, it.title, it.title_ar, it.title_ur, it.category, it.type, it.source, it.arabic, it.transliteration, it.translation, it.translation_ur].join(" "));
      if (hay.indexOf(q) >= 0) return it;
      if (!best && q.split("_").filter(Boolean).every(function (part) { return hay.indexOf(part) >= 0; })) best = it;
    }
    return best;
  }

  window.__azkarProbe = {
    showItem: function (query, layerMode) {
      ensureSettings();
      var it = azkarProbeFindItem(query);
      if (!it) throw new Error("Probe item not found: " + query);
      var layers = layerMode || {};
      state.settings.showTranslit = !!layers.showTranslit;
      state.settings.showEnglish = !!layers.showEnglish;
      state.settings.showTranslation = !!state.settings.showEnglish;
      state.settings.showUrdu = !!layers.showUrdu;
      if (layers.theme) state.settings.theme = layers.theme;
      if (typeof layers.tajweed === "boolean") state.settings.tajweed = layers.tajweed;
      if (typeof layers.showTitle === "boolean") state.settings.showTitle = layers.showTitle;
      state.settings.tvVisualRevision = "I-36-tv-visual-proof-layout-closure";
      state.playlist = [it];
      state.index = 0;
      state.pendingScrollTop = 0;
      state.tvPopoutDismissedItemId = null;
      applyTheme(state.settings.theme);
      applyBodyFlags();
      render();
      return { id: it.display_id || it.id || "", title: it.title || it.title_ar || "", size: it.size_mode || "normal" };
    },
    setLayers: function (layerMode) {
      ensureSettings();
      layerMode = layerMode || {};
      state.settings.showTranslit = !!layerMode.showTranslit;
      state.settings.showEnglish = !!layerMode.showEnglish;
      state.settings.showTranslation = !!state.settings.showEnglish;
      state.settings.showUrdu = !!layerMode.showUrdu;
      render();
    },
    getState: function () { return state; }
  };

  // Exposed for lightweight logic tests (see tools/test_logic.py rationale).
  window.__azkar = { parseRepeat: parseRepeat, buildMixed: buildMixed, CATS: CATS, getSectionRefs: getSectionRefs, stripWaqfForDisplay: stripWaqfForDisplay, renderArabicWithWaqf: renderArabicWithWaqf, renderTajweedFallback: renderTajweedFallback, buildShareText: buildShareText, tvDirectControl: tvDirectControl, tvMainKey: tvMainKey, getState: function(){ return state; }, initTvSettingsFocus: initTvSettingsFocus, forceTvSettingsInitialFocus: forceTvSettingsInitialFocus };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
