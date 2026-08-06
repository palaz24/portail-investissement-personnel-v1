(async function runV143Tests(globalScope) {
  "use strict";

  const isNode = typeof module !== "undefined" && module.exports;
  if (!isNode) while (!globalScope.__PORTAL_V142_TEST_RESULTS__) await new Promise((resolve) => setTimeout(resolve, 10));

  const Engine = isNode ? require("../js/options-engine.js") : globalScope.OptionsStrategyEngine;
  const Store = isNode ? require("../js/options-storage.js") : globalScope.OptionsStrategyStorage;
  const Chart = isNode ? require("../js/options-chart.js") : globalScope.OptionsStrategyChart;
  let html = "", css = "", themeCss = "", app = "", storageSource = "";
  if (isNode) {
    const fs = require("node:fs"), path = require("node:path"), read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");
    html = read("../options-studio.html");
    css = read("../css/options-studio.css");
    themeCss = read("../css/style.css");
    app = read("../js/options-studio.js");
    storageSource = read("../js/options-storage.js");
  } else {
    [html, css, themeCss, app, storageSource] = await Promise.all([
      "../options-studio.html", "../css/options-studio.css", "../css/style.css", "../js/options-studio.js", "../js/options-storage.js",
    ].map((url) => fetch(`${url}?t=${Date.now()}`).then((response) => response.text())));
  }

  const results = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const test = (number, name, callback) => { try { callback(); results.push({ number, name, passed: true }); } catch (error) { results.push({ number, name, passed: false, error: error.message }); } };
  const fixedDate = new Date("2026-08-06T16:30:00.000Z");
  const leg = Engine.normalizeLeg({
    id: "jambe-call-francaise", instrumentType: "option", optionType: "call", side: "long", quantity: 2,
    multiplier: 100, strike: 15.5, expiration: "2026-10-16", entryPrice: 0.375, currentMark: null,
    impliedVolatility: 0.315, commission: 1.25, label: "Appel protégé", notes: "note privée à ne jamais exporter",
  });
  const strategy = Engine.normalizeStrategy({
    id: "strategie-v1-4-3", name: "Stratégie été Ford", symbol: "F", securityName: "Ford Motor Company",
    underlyingPrice: 14.137, currency: "USD", valuationDate: "2026-08-06", analysisDate: "2026-09-06",
    riskFreeRate: 0.04125, dividendYield: 0.0225, impliedVolatility: 0.315, multiplier: 100,
    optionCommission: 0, stockCommission: 0, steps: 200, rangeMode: "custom", rangeMin: 10.5,
    rangeMax: 20.5, tableStep: 0.5, legs: [leg], updatedAt: "2026-08-06T16:00:00.000Z",
    accountNumber: "COMPTE-PRIVE", wealthsimpleId: "WS-PRIVE", apiKey: "JETON-PRIVE",
  });
  const artifact = Store.createExportArtifact(strategy, fixedDate);
  const parsed = JSON.parse(artifact.content);
  const imported = Store.importDocument(artifact.content);
  const publicExpected = Engine.normalizeStrategy({ ...strategy, legs: strategy.legs.map(({ notes, ...item }) => item) });
  const memoryStorage = () => { const data = {}; return { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value; }, removeItem: (key) => { delete data[key]; } }; };

  test(292, "le bouton Exporter JSON utilise le nouvel artefact sérialisé", () => assert(/#exportJson[\s\S]*?createExportArtifact\(strategy\)[\s\S]*?download\(artifact\.filename, artifact\.content, artifact\.type\)/.test(app), "Gestionnaire du bouton incomplet"));
  test(293, "le contenu exporté n’est jamais [object Object]", () => assert(artifact.content.trim() !== "[object Object]" && artifact.content.trim().startsWith("{"), "Conversion implicite détectée"));
  test(294, "JSON.parse accepte le contenu exporté", () => assert(parsed && typeof parsed === "object", "JSON invalide"));
  test(295, "le schéma officiel est conservé", () => assert(parsed.schema === "options-strategy-studio", "Schéma incorrect"));
  test(296, "la version du schéma est conservée", () => assert(parsed.version === 1, "Version incorrecte"));
  test(297, "exportedAt est une date ISO-8601", () => assert(parsed.exportedAt === fixedDate.toISOString() && !Number.isNaN(Date.parse(parsed.exportedAt)), "Date d’export invalide"));
  test(298, "strategy demeure un objet", () => assert(parsed.strategy && typeof parsed.strategy === "object" && !Array.isArray(parsed.strategy), "Stratégie absente"));
  test(299, "les jambes sont conservées", () => assert(parsed.strategy.legs.length === 1 && parsed.strategy.legs[0].id === leg.id, "Jambes perdues"));
  test(300, "les hypothèses publiques sont conservées", () => assert(parsed.strategy.riskFreeRate === 0.04125 && parsed.strategy.dividendYield === 0.0225 && parsed.strategy.impliedVolatility === 0.315, "Hypothèses perdues"));
  test(301, "les nombres restent des nombres", () => assert([parsed.strategy.underlyingPrice, parsed.strategy.legs[0].strike, parsed.strategy.legs[0].quantity].every((value) => typeof value === "number"), "Type numérique perdu"));
  test(302, "les valeurs nulles autorisées restent valides", () => assert(parsed.strategy.legs[0].currentMark === null, "Valeur nulle modifiée"));
  test(303, "les caractères français sont conservés", () => assert(parsed.strategy.name === "Stratégie été Ford" && parsed.strategy.legs[0].label === "Appel protégé", "Caractères français perdus"));
  test(304, "le fichier utilise l’extension JSON", () => assert(artifact.filename.endsWith(".json"), "Extension invalide"));
  test(305, "le type MIME est application/json", () => assert(artifact.type === "application/json" && app.includes("new Blob([content], { type })"), "Type MIME invalide"));
  test(306, "le nom du fichier est clair et nettoyé", () => { const name = Store.createExportFilename({ symbol: "F:/<é>*" }, fixedDate); assert(name === "options-strategy-F-E-2026-08-06.json" && !/[<>:"/\\|?*]/.test(name), `Nom invalide : ${name}`); });
  test(307, "l’export puis l’import restaurent la même stratégie publique", () => assert(imported.valid && JSON.stringify(imported.value) === JSON.stringify(publicExpected), "Boucle export-import différente"));
  test(308, "les données privées sont absentes", () => assert(!/note privée|COMPTE-PRIVE|WS-PRIVE|JETON-PRIVE|accountNumber|wealthsimpleId|apiKey|password|tax/i.test(artifact.content), "Donnée privée exportée"));
  test(309, "l’export CSV reste fonctionnel", () => { const csv = Chart.tableToCsv(Chart.buildTable(strategy)); assert(csv.startsWith("Cours,P/L échéance") && csv.split(/\r?\n/).length > 10, "CSV brisé"); });
  test(310, "le partage URL reste fonctionnel et privé", () => { const fragment = Store.createShareFragment(strategy); const result = Store.parseShareFragment(fragment); assert(result.valid && result.value.symbol === "F" && !fragment.includes("note privée"), "Partage invalide"); });
  test(311, "la sauvegarde locale reste fonctionnelle", () => { const storage = memoryStorage(); Store.saveStrategy(strategy, storage); assert(Store.load(storage).strategies[0].name === strategy.name, "Sauvegarde locale brisée"); });
  test(312, "l’export ne crée aucun appel réseau", () => assert(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(app + storageSource), "Appel réseau détecté"));
  test(313, "le correctif ne contient aucune erreur JavaScript", () => { assert(Store.createExportArtifact && Store.serializeExportDocument, "API d’export absente"); if (isNode) { new Function(app); new Function(storageSource); } });
  test(314, "le mode clair demeure conforme", () => assert(themeCss.includes(':root[data-theme="light"]') && html.includes('id="themeToggle"'), "Mode clair incomplet"));
  test(315, "le mode sombre demeure conforme", () => assert(themeCss.includes("color-scheme: dark") && css.includes(".chart-panel"), "Mode sombre incomplet"));
  test(316, "le mobile 390 × 844 demeure sans débordement", () => assert(css.includes("@media (max-width: 390px)") && css.includes("overflow-x: hidden") && css.includes("min-width: 0"), "Protection mobile absente"));

  const failed = results.filter((result) => !result.passed);
  const summary = { total: results.length, passed: results.length - failed.length, failed: failed.length, results };
  globalScope.__PORTAL_V143_TEST_RESULTS__ = summary;
  if (isNode) {
    results.forEach((result) => console.log(`${result.passed ? "OK" : "ECHEC"} ${result.number} ${result.name}${result.error ? ` — ${result.error}` : ""}`));
    console.log(`V1.4.3: ${summary.passed}/${summary.total}`);
    if (failed.length) process.exitCode = 1;
    module.exports = summary;
  } else {
    const groups = [
      globalScope.__PORTAL_TEST_RESULTS__, globalScope.__PORTAL_V11_TEST_RESULTS__, globalScope.__PORTAL_V111_TEST_RESULTS__,
      globalScope.__PORTAL_V12_TEST_RESULTS__, globalScope.__PORTAL_V121_TEST_RESULTS__, globalScope.__PORTAL_V13_TEST_RESULTS__,
      globalScope.__OPTIONS_STUDIO_TEST_RESULTS__, globalScope.__PORTAL_V141_TEST_RESULTS__, globalScope.__PORTAL_V142_TEST_RESULTS__, summary,
    ].filter(Boolean);
    const total = groups.reduce((count, group) => count + group.total, 0);
    const passed = groups.reduce((count, group) => count + group.passed, 0);
    const all = groups.flatMap((group) => group.results);
    const summaryElement = document.getElementById("testSummary"), body = document.getElementById("testResults");
    summaryElement.className = passed === total ? "summary passed" : "summary failed";
    summaryElement.textContent = `${passed}/${total} tests réussis`;
    body.innerHTML = all.map((result) => `<tr class="${result.passed ? "passed" : "failed"}"><td>${result.passed ? "RÉUSSI" : "ÉCHEC"}</td><td>${result.number || "—"} — ${result.name}</td><td>Réussite</td><td>${result.passed ? "Réussite" : result.error}</td></tr>`).join("");
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
