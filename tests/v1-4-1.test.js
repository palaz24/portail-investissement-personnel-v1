(async function runV141Tests(globalScope) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  if (!isNode) while (!globalScope.__OPTIONS_STUDIO_TEST_RESULTS__) await new Promise((resolve) => setTimeout(resolve, 10));
  const Engine = isNode ? require("../js/options-engine.js") : globalScope.OptionsStrategyEngine;
  const Chart = isNode ? require("../js/options-chart.js") : globalScope.OptionsStrategyChart;
  let html = "", css = "", app = "";
  if (isNode) {
    const fs = require("node:fs"), path = require("node:path"), read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");
    html = read("../options-studio.html"); css = read("../css/options-studio.css"); app = read("../js/options-studio.js");
  } else {
    [html, css, app] = await Promise.all(["../options-studio.html", "../css/options-studio.css", "../js/options-studio.js"].map((url) => fetch(`${url}?t=${Date.now()}`).then((response) => response.text())));
  }
  const results = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const near = (actual, expected, tolerance = 1e-9) => assert(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
  const test = (number, name, callback) => { try { callback(); results.push({ number, name, passed: true }); } catch (error) { results.push({ number, name, passed: false, error: error.message }); } };
  const valuationDate = "2026-08-04", expiration = "2026-10-16";
  const option = (overrides = {}) => Engine.normalizeLeg({ instrumentType: "option", optionType: "call", side: "long", quantity: 1, multiplier: 100, strike: 15.13, expiration, entryPrice: 0.3333, impliedVolatility: 0.31, commission: 1.27, ...overrides });
  const makeStrategy = (symbol = "F", overrides = {}) => Engine.normalizeStrategy({ name: "Validation V1.4.1", symbol, underlyingPrice: 14.137, valuationDate, analysisDate: "2026-09-04", rangeMode: "custom", rangeMin: 10.1, rangeMax: 20.4, tableStep: 0.37, legs: [option()], ...overrides });
  const isHalfDollar = (value) => Number.isInteger(value * 2);
  const fullRows = Chart.buildTable(makeStrategy());
  const analysis = Engine.analyze(makeStrategy());
  const visibleRows = Chart.selectRepresentativeRows(fullRows, { maxRows: 10, currentPrice: 14.137, breakEvens: analysis.breakEvens });

  test(227, "le symbole F active la règle Ford", () => near(Chart.getScenarioPriceStep("F", 1), 0.5));
  test(228, "le symbole f active aussi la règle Ford", () => near(Chart.getScenarioPriceStep("f", 1), 0.5));
  test(229, "le pas Ford vaut exactement 0,50", () => assert(Chart.getScenarioPriceStep("F", 9) === 0.5, "Pas Ford incorrect"));
  test(230, "les scénarios Ford avancent par 0,50", () => assert(fullRows.every((row, index) => !index || row.price - fullRows[index - 1].price === 0.5), "Pas irrégulier"));
  test(231, "la grille Ford ne contient aucun artefact flottant", () => assert(fullRows.every((row) => isHalfDollar(row.price)), "Artefact flottant"));
  test(232, "les prix de scénario sont affichés avec deux décimales", () => assert(Chart.renderChart(makeStrategy()).includes(">10.50<"), "Deux décimales absentes"));
  test(233, "le cours réel Ford demeure exact", () => near(Engine.analyze(makeStrategy()).strategy.underlyingPrice, 14.137));
  test(234, "les strikes demeurent exacts", () => near(Engine.analyze(makeStrategy()).strategy.legs[0].strike, 15.13));
  test(235, "les primes demeurent exactes", () => near(Engine.analyze(makeStrategy()).strategy.legs[0].entryPrice, 0.3333));
  test(236, "les données financières saisies ne sont pas réécrites", () => { const source = makeStrategy(); const before = JSON.stringify(source.legs); Chart.buildTable(source); assert(JSON.stringify(source.legs) === before, "Jambes modifiées"); });
  test(237, "les seuils de rentabilité demeurent exacts", () => near(Engine.analyze(makeStrategy()).breakEvens[0], 15.476, 1e-6));
  test(238, "SPY conserve son pas configuré", () => { near(Chart.getScenarioPriceStep("SPY", 0.5), 0.5); near(Chart.buildTable(makeStrategy("SPY", { tableStep: 0.5 }))[0].price, 10.1); });
  test(239, "QQQ conserve son pas configuré", () => near(Chart.getScenarioPriceStep("QQQ", 0.23), 0.23));
  test(240, "IWM conserve son pas configuré", () => near(Chart.getScenarioPriceStep("IWM", 0.61), 0.61));
  test(241, "un symbole personnalisé conserve son pas", () => near(Chart.getScenarioPriceStep("XYZ", 0.42), 0.42));
  test(242, "le graphique Ford utilise la grille de 0,50", () => assert(Chart.buildSeries(makeStrategy()).points.every((point) => isHalfDollar(point.price)), "Graphique hors grille"));
  test(243, "le tableau Ford utilise la grille de 0,50", () => assert(fullRows.every((row) => isHalfDollar(row.price)), "Tableau hors grille"));
  test(244, "le tableau visible contient au plus dix lignes", () => assert(visibleRows.length <= 10, "Plus de 10 lignes"));
  test(245, "le minimum est conservé", () => near(visibleRows[0].price, fullRows[0].price));
  test(246, "le maximum est conservé", () => near(visibleRows.at(-1).price, fullRows.at(-1).price));
  test(247, "un point près du cours actuel est conservé", () => assert(visibleRows.some((row) => row.price === 14), "Cours voisin absent"));
  test(248, "un point près du seuil est conservé", () => assert(visibleRows.some((row) => row.price === 15.5), "Seuil voisin absent"));
  test(249, "les points visibles sont uniques", () => assert(new Set(visibleRows.map((row) => row.price)).size === visibleRows.length, "Doublon visible"));
  test(250, "les points visibles sont croissants par défaut", () => assert(visibleRows.every((row, index) => !index || row.price > visibleRows[index - 1].price), "Tri incorrect"));
  test(251, "un changement de plage recalcule les points", () => assert(Chart.buildTable(makeStrategy("F", { rangeMin: 12, rangeMax: 13 })).length !== fullRows.length, "Plage non recalculée"));
  test(252, "un changement de symbole recalcule le pas", () => assert(Chart.buildTable(makeStrategy("SPY")).some((row) => !isHalfDollar(row.price)), "Symbole non recalculé"));
  test(253, "le CSV conserve plus de dix lignes", () => assert(Chart.tableToCsv(fullRows).split(/\r?\n/).length - 1 > 10, "CSV tronqué"));
  test(254, "le CSV Ford conserve la grille de 0,50", () => assert(Chart.tableToCsv(fullRows).split(/\r?\n/).slice(1).every((line) => isHalfDollar(Number(line.split(",")[0]))), "CSV hors grille"));
  test(255, "le graphique conserve les résultats calculés sans arrondi préalable", () => { const point = Chart.buildSeries(makeStrategy()).points[2]; near(point.expiration, Engine.expirationPL(makeStrategy(), point.price)); });
  test(256, "les métriques financières demeurent inchangées", () => { const current = Engine.analyze(makeStrategy()); near(current.initialCashFlow, Engine.strategyInitialCashFlow(current.strategy)); near(current.currentPL, Engine.strategyPLAtDate(current.strategy, 14.137, current.strategy.analysisDate)); });
  test(257, "la comparaison demeure disponible", () => assert(Chart.renderChart(makeStrategy(), { comparison: makeStrategy("SPY") }).includes("comparison"), "Comparaison absente"));
  test(258, "le mode clair demeure pris en charge", () => assert(app.includes('setTheme("light")') || app.includes('=== "light"'), "Mode clair absent"));
  test(259, "le mode sombre demeure pris en charge", () => assert(app.includes('"dark"'), "Mode sombre absent"));
  test(260, "le mobile protège le tableau contre le débordement", () => assert(css.includes("@media (max-width: 390px)") && html.includes('class="table-wrap"'), "Protection mobile absente"));
  test(261, "le correctif ne contient aucune erreur JavaScript", () => { assert(Engine.analyze && Chart.selectRepresentativeRows, "Module incomplet"); if (isNode) new Function(app); });

  const failed = results.filter((result) => !result.passed);
  const summary = { total: results.length, passed: results.length - failed.length, failed: failed.length, results };
  globalScope.__PORTAL_V141_TEST_RESULTS__ = summary;
  if (isNode) {
    results.forEach((result) => console.log(`${result.passed ? "OK" : "ECHEC"} ${result.number} ${result.name}${result.error ? ` — ${result.error}` : ""}`));
    console.log(`V1.4.1: ${summary.passed}/${summary.total}`);
    if (failed.length) process.exitCode = 1;
    module.exports = summary;
  } else {
    const groups = [globalScope.__PORTAL_TEST_RESULTS__, globalScope.__PORTAL_V11_TEST_RESULTS__, globalScope.__PORTAL_V111_TEST_RESULTS__, globalScope.__PORTAL_V12_TEST_RESULTS__, globalScope.__PORTAL_V121_TEST_RESULTS__, globalScope.__PORTAL_V13_TEST_RESULTS__, globalScope.__OPTIONS_STUDIO_TEST_RESULTS__, summary].filter(Boolean);
    const total = groups.reduce((count, group) => count + group.total, 0), passed = groups.reduce((count, group) => count + group.passed, 0), all = groups.flatMap((group) => group.results);
    const summaryElement = document.getElementById("testSummary"), body = document.getElementById("testResults");
    summaryElement.className = passed === total ? "summary passed" : "summary failed";
    summaryElement.textContent = `${passed}/${total} tests réussis`;
    body.innerHTML = all.map((result) => `<tr class="${result.passed ? "passed" : "failed"}"><td>${result.passed ? "RÉUSSI" : "ÉCHEC"}</td><td>${result.number || "—"} — ${result.name}</td><td>Réussite</td><td>${result.passed ? "Réussite" : result.error}</td></tr>`).join("");
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
