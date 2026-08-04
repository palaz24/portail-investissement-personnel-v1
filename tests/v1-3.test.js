(async function runPortalV13CompatibilityTests(globalScope) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  if (!isNode) while (!globalScope.__PORTAL_V121_TEST_RESULTS__) await new Promise((resolve) => setTimeout(resolve, 10));
  const Storage = isNode ? require("../js/storage.js") : globalScope.PortalStorage;
  const Backup = isNode ? require("../js/backup.js") : globalScope.PortalBackup;
  const Calc = isNode ? require("../js/calculations.js") : globalScope.PortalCalculations;
  let htmlSource = "", appSource = "", cssSource = "", calculationsSource = "", studioSource = "";
  if (isNode) {
    const fs = require("node:fs"), path = require("node:path");
    const read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");
    htmlSource = read("../index.html"); appSource = read("../js/app.js"); cssSource = read("../css/style.css"); calculationsSource = read("../js/calculations.js"); studioSource = read("../options-studio.html");
  } else {
    [htmlSource, appSource, cssSource, calculationsSource, studioSource] = await Promise.all(["../index.html", "../js/app.js", "../css/style.css", "../js/calculations.js", "../options-studio.html"].map((url) => fetch(`${url}?test=${Date.now()}`).then((response) => response.text())));
  }
  const results = [];
  function test(number, name, callback) { try { callback(); results.push({ number, name, passed: true }); } catch (error) { results.push({ number, name, passed: false, error: error.message }); } }
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const stateBase = () => ({ ...Storage.getEmptyData(), securities: [{ id: "SEC-F", symbol: "F", name: "Ford", type: "ACTION", currency: "USD", marginEligible: true, marginRequirement: .3, active: true }] });

  test(148, "la section Risque demeure absente visuellement", () => assert(!htmlSource.includes('id="securityRisk"') && !htmlSource.includes("Niveau de risque simple"), "Risque visible"));
  test(149, "les fonctions internes de risque demeurent", () => assert(calculationsSource.includes("riskLevel") && Calc.calculatePortfolio(stateBase()).securities[0].riskLevel, "Risque interne supprimé"));
  test(150, "priceHistory existe dans une base neuve", () => assert(JSON.stringify(Storage.getEmptyData().priceHistory) === "{}", "Collection absente"));
  test(151, "une ancienne collection priceHistory est acceptée", () => { const state = stateBase(); state.priceHistory = { F: [{ symbol: "F", price: 14, at: "2026-07-30T10:00:00Z", source: "Market Data", currency: "USD" }] }; assert(Backup.validatePayload(Backup.createPayload(state)).valid, "Sauvegarde refusée"); });
  test(152, "l’export et le réimport préservent priceHistory", () => { const state = stateBase(); state.priceHistory = { F: [{ symbol: "F", price: 14, at: "2026-07-30T10:00:00Z", source: "Market Data", currency: "USD" }] }; assert(Backup.validatePayload(Backup.createPayload(state)).value.priceHistory.F[0].price === 14, "Historique perdu"); });
  test(153, "la normalisation limite encore l’ancien historique", () => { const points = Array.from({ length: 5005 }, (_, i) => ({ symbol: "F", price: 10, at: new Date(Date.UTC(2020, 0, 1, 0, i * 15)).toISOString(), source: "Market Data", currency: "USD" })); assert(Storage.normalizePriceHistory({ F: points }).F.length === 5000, "Limite incorrecte"); });
  test(154, "une sauvegarde V1.2 sans priceHistory demeure compatible", () => { const state = stateBase(); delete state.priceHistory; assert(Backup.validatePayload(Backup.createPayload(state)).value.priceHistory, "Migration absente"); });
  test(155, "aucune interface priceHistory n’est visible", () => assert(!htmlSource.includes("Historique en cours de constitution"), "Historique visible"));
  test(156, "le graphique Cours et strikes est retiré", () => assert(!htmlSource.includes("Cours du titre et strikes actifs"), "Graphique 1 présent"));
  test(157, "le graphique Distance et strikes est retiré", () => assert(!htmlSource.includes("Distance entre le cours et les strikes"), "Graphique 2 présent"));
  test(158, "les anciens conteneurs et boutons sont retirés", () => assert(!/securityChartsRegion|toggleAllStrikes|securityPriceStrikeChart|securityDistanceChart/.test(htmlSource), "Conteneur résiduel"));
  test(159, "les anciens écouteurs de graphiques sont retirés", () => assert(!/PortalSecurityCharts|selectedChartOptionId|showAllStrikes|data-chart-option/.test(appSource), "Écouteur résiduel"));
  test(160, "l’ancien script de graphiques n’est plus chargé", () => assert(!htmlSource.includes("security-charts.js"), "Script encore chargé"));
  test(161, "le Studio contient son propre graphique", () => assert(studioSource.includes('id="strategyChart"') && studioSource.includes("Profit et perte"), "Graphique du Studio absent"));
  test(162, "le mode clair est conservé", () => assert(cssSource.includes(':root[data-theme="light"]'), "Mode clair absent"));
  test(163, "le mode sombre est conservé", () => assert(cssSource.includes("color-scheme: dark") && appSource.includes("THEME_STORAGE_KEY"), "Mode sombre absent"));
  test(164, "la fiche mobile n’a plus de zone graphique large", () => assert(!/price-strike-chart|distance-row|chart-scroll/.test(cssSource), "CSS graphique résiduel"));
  test(165, "la version 1.4.0 conserve les modules du portail", () => assert(Storage.APP_VERSION === "1.4.0" && appSource.includes("state.priceHistory = Storage.normalizePriceHistory"), "Compatibilité incomplète"));

  const failed = results.filter((result) => !result.passed); const summary = { total: results.length, passed: results.length - failed.length, failed: failed.length, results };
  globalScope.__PORTAL_V13_TEST_RESULTS__ = summary;
  if (isNode) { results.forEach((r) => console.log(`${r.passed ? "OK" : "ECHEC"} ${r.number} ${r.name}${r.error ? ` — ${r.error}` : ""}`)); console.log(`V1.3-compatibilité: ${summary.passed}/${summary.total}`); if (failed.length) process.exitCode = 1; module.exports = summary; }
})(typeof globalThis !== "undefined" ? globalThis : window);
