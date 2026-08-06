(async function runV142Tests(globalScope) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  if (!isNode) while (!globalScope.__PORTAL_V141_TEST_RESULTS__) await new Promise((resolve) => setTimeout(resolve, 10));
  const Engine = isNode ? require("../js/options-engine.js") : globalScope.OptionsStrategyEngine;
  const Chart = isNode ? require("../js/options-chart.js") : globalScope.OptionsStrategyChart;
  let html = "", css = "", themeCss = "", app = "", chartSource = "";
  if (isNode) {
    const fs = require("node:fs"), path = require("node:path"), read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");
    html = read("../options-studio.html"); css = read("../css/options-studio.css"); themeCss = read("../css/style.css"); app = read("../js/options-studio.js"); chartSource = read("../js/options-chart.js");
  } else {
    [html, css, themeCss, app, chartSource] = await Promise.all(["../options-studio.html", "../css/options-studio.css", "../css/style.css", "../js/options-studio.js", "../js/options-chart.js"].map((url) => fetch(`${url}?t=${Date.now()}`).then((response) => response.text())));
  }
  const results = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const near = (actual, expected, tolerance = 1e-9) => assert(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
  const test = (number, name, callback) => { try { callback(); results.push({ number, name, passed: true }); } catch (error) { results.push({ number, name, passed: false, error: error.message }); } };
  const valuationDate = "2026-08-06", expiration = "2026-10-16";
  const leg = (overrides = {}) => Engine.normalizeLeg({ instrumentType: "option", optionType: "call", side: "long", quantity: 1, multiplier: 100, strike: 15.13, expiration, entryPrice: 0.3333, impliedVolatility: 0.31, commission: 1.27, ...overrides });
  const strategy = (symbol = "F", overrides = {}) => Engine.normalizeStrategy({ name: "Validation V1.4.2", symbol, underlyingPrice: 14.137, valuationDate, analysisDate: "2026-09-06", rangeMode: "custom", rangeMin: 10.1, rangeMax: 20.4, tableStep: 0.37, legs: [leg()], ...overrides });
  const ford = strategy(), analysis = Engine.analyze(ford), fullRows = Chart.buildTable(ford, analysis);
  const selected = Chart.selectRepresentativeRows(fullRows, { maxRows: 10, currentPrice: ford.underlyingPrice, breakEvens: analysis.breakEvens });
  const descending = Chart.sortRows(selected, "price", -1);

  test(262, "la section Projection utilise la couleur du thème sombre", () => assert(css.includes(".chart-panel { color: var(--text); }"), "Couleur de section absente"));
  test(263, "le titre Projection reste lisible", () => assert(css.includes(".chart-panel .eyebrow { color: var(--primary-strong); }"), "Titre Projection non thématisé"));
  test(264, "le texte Profit et perte reste lisible", () => assert(css.includes(".chart-panel .panel-heading h2") && css.includes("color: var(--text)"), "Sous-titre non thématisé"));
  test(265, "les titres des axes utilisent la couleur principale du texte", () => assert(css.includes(".studio-chart .axis-title { fill: var(--text)"), "Axes non corrigés"));
  test(266, "les nombres des axes héritent de la couleur du thème", () => assert(css.includes(".studio-chart text { fill: currentColor; }"), "Nombres des axes non corrigés"));
  test(267, "la légende utilise une couleur lisible", () => assert(css.includes(".studio-legend") && /\.studio-legend[^\n]+color: var\(--text\)/.test(css), "Légende non corrigée"));
  test(268, "l’info-bulle possède un fond et un texte thématisés", () => assert(/\.studio-chart-tooltip[^\n]+background: var\(--surface-2\)[^\n]+color: var\(--text\)/.test(css), "Info-bulle non corrigée"));
  test(269, "les seuils de rentabilité restent lisibles", () => assert(css.includes(".studio-chart .studio-be-label { fill: var(--positive)"), "Seuils non corrigés"));
  test(270, "les valeurs monétaires de l’info-bulle restent visibles", () => assert(app.includes("P/L échéance ${money(point.dataset.pl)}") && css.includes(".studio-chart-tooltip"), "Valeurs monétaires absentes"));
  test(271, "aucun texte SVG noir n’est codé en dur", () => assert(!/<text[^>]+(?:fill=["']?(?:#000(?:000)?|black))/i.test(chartSource) && !/\.studio-chart\s+text[^}]+fill:\s*(?:#000(?:000)?|black)/i.test(css), "Texte SVG noir détecté"));
  test(272, "le mode clair conserve ses variables de contraste", () => assert(themeCss.includes(':root[data-theme="light"]') && themeCss.includes("--chart-selected: #6f42c1"), "Mode clair incomplet"));
  test(273, "le graphique profit et perte reste fonctionnel", () => { const output = Chart.renderChart(ford); assert(output.includes("studio-curve expiration") && output.includes("studio-curve selected"), "Courbes absentes"); });
  test(274, "les calculs financiers restent inchangés", () => { near(analysis.initialCashFlow, Engine.strategyInitialCashFlow(ford)); near(analysis.currentPL, Engine.strategyPLAtDate(ford, 14.137, ford.analysisDate)); });
  test(275, "le tableau visible reste limité à dix lignes", () => assert(descending.length === 10, "Nombre de lignes incorrect"));
  test(276, "la première ligne contient le prix maximal", () => near(descending[0].price, Math.max(...selected.map((row) => row.price))));
  test(277, "la dernière ligne contient le prix minimal", () => near(descending.at(-1).price, Math.min(...selected.map((row) => row.price))));
  test(278, "l’ordre visible est strictement décroissant", () => assert(descending.every((row, index) => !index || row.price < descending[index - 1].price), "Tri décroissant invalide"));
  test(279, "le tableau visible ne contient aucun doublon", () => assert(new Set(descending.map((row) => row.price)).size === descending.length, "Doublon présent"));
  test(280, "le point voisin du prix actuel est conservé", () => assert(descending.some((row) => row.price === 14), "Prix actuel non représenté"));
  test(281, "le point voisin du seuil de rentabilité est conservé", () => assert(descending.some((row) => row.price === 15.5), "Seuil non représenté"));
  test(282, "Ford conserve son pas exact de 0,50", () => assert(fullRows.every((row, index) => !index || row.price - fullRows[index - 1].price === 0.5), "Pas Ford modifié"));
  test(283, "le prix réel Ford demeure non arrondi", () => near(analysis.strategy.underlyingPrice, 14.137));
  test(284, "un changement de plage conserve le tri décroissant", () => { const changed = Chart.sortRows(Chart.selectRepresentativeRows(Chart.buildTable(strategy("F", { rangeMin: 12, rangeMax: 18 })), { maxRows: 10, currentPrice: 14.137, breakEvens: [] }), "price", -1); assert(changed[0].price > changed.at(-1).price && app.includes('"rangeMode", "rangeMin", "rangeMax"'), "Tri de plage perdu"); });
  test(285, "un changement de stratégie rétablit le tri décroissant", () => assert(/function loadTemplate\(\)[\s\S]*?resetTableSort\(\)/.test(app), "Réinitialisation de stratégie absente"));
  test(286, "un changement de symbole conserve le tri décroissant", () => { const spy = Chart.sortRows(Chart.selectRepresentativeRows(Chart.buildTable(strategy("SPY")), { maxRows: 10, currentPrice: 14.137, breakEvens: [] }), "price", -1); assert(spy[0].price > spy.at(-1).price && app.includes('"symbol"'), "Tri de symbole perdu"); });
  test(287, "le tri manuel ascendant reste fonctionnel", () => { const ascending = Chart.sortRows(selected, "price", 1); assert(ascending[0].price < ascending.at(-1).price && app.includes("data-table-sort"), "Tri manuel perdu"); });
  test(288, "l’export CSV demeure complet", () => assert(Chart.tableToCsv(fullRows).split(/\r?\n/).length - 1 === fullRows.length && fullRows.length > 10, "CSV tronqué"));
  test(289, "le correctif ne contient aucune erreur JavaScript", () => { assert(Chart.sortRows && Engine.analyze, "Module incomplet"); if (isNode) { new Function(app); new Function(chartSource); } });
  test(290, "le mobile 390 × 844 conserve la protection de débordement", () => assert(css.includes("@media (max-width: 390px)") && css.includes("overflow-x: hidden"), "Protection mobile absente"));
  test(291, "les modes clair et sombre conservent des repères textuels", () => assert(themeCss.includes("color-scheme: dark") && themeCss.includes("color-scheme: light") && chartSource.includes("À l’échéance") && html.includes("Profit et perte"), "Thèmes ou repères incomplets"));

  const failed = results.filter((result) => !result.passed);
  const summary = { total: results.length, passed: results.length - failed.length, failed: failed.length, results };
  globalScope.__PORTAL_V142_TEST_RESULTS__ = summary;
  if (isNode) {
    results.forEach((result) => console.log(`${result.passed ? "OK" : "ECHEC"} ${result.number} ${result.name}${result.error ? ` — ${result.error}` : ""}`));
    console.log(`V1.4.2: ${summary.passed}/${summary.total}`);
    if (failed.length) process.exitCode = 1;
    module.exports = summary;
  } else {
    const groups = [globalScope.__PORTAL_TEST_RESULTS__, globalScope.__PORTAL_V11_TEST_RESULTS__, globalScope.__PORTAL_V111_TEST_RESULTS__, globalScope.__PORTAL_V12_TEST_RESULTS__, globalScope.__PORTAL_V121_TEST_RESULTS__, globalScope.__PORTAL_V13_TEST_RESULTS__, globalScope.__OPTIONS_STUDIO_TEST_RESULTS__, globalScope.__PORTAL_V141_TEST_RESULTS__, summary].filter(Boolean);
    const total = groups.reduce((count, group) => count + group.total, 0), passed = groups.reduce((count, group) => count + group.passed, 0), all = groups.flatMap((group) => group.results);
    const summaryElement = document.getElementById("testSummary"), body = document.getElementById("testResults");
    summaryElement.className = passed === total ? "summary passed" : "summary failed";
    summaryElement.textContent = `${passed}/${total} tests réussis`;
    body.innerHTML = all.map((result) => `<tr class="${result.passed ? "passed" : "failed"}"><td>${result.passed ? "RÉUSSI" : "ÉCHEC"}</td><td>${result.number || "—"} — ${result.name}</td><td>Réussite</td><td>${result.passed ? "Réussite" : result.error}</td></tr>`).join("");
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
