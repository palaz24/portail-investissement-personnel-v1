(async function runOptionsStudioTests(globalScope) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  if (!isNode) while (!globalScope.__PORTAL_V13_TEST_RESULTS__) await new Promise((resolve) => setTimeout(resolve, 10));
  const Engine = isNode ? require("../js/options-engine.js") : globalScope.OptionsStrategyEngine;
  const Store = isNode ? require("../js/options-storage.js") : globalScope.OptionsStrategyStorage;
  const Chart = isNode ? require("../js/options-chart.js") : globalScope.OptionsStrategyChart;
  let html = "", css = "", app = "", index = "", market = "";
  if (isNode) { const fs = require("node:fs"), path = require("node:path"), read = (f) => fs.readFileSync(path.join(__dirname, f), "utf8"); html = read("../options-studio.html"); css = read("../css/options-studio.css"); app = read("../js/options-studio.js"); index = read("../index.html"); market = read("../js/market-data.js"); }
  else [html, css, app, index, market] = await Promise.all(["../options-studio.html", "../css/options-studio.css", "../js/options-studio.js", "../index.html", "../js/market-data.js"].map((url) => fetch(`${url}?t=${Date.now()}`).then((r) => r.text())));
  const results = [];
  function test(number, name, callback) { try { callback(); results.push({ number, name, passed: true }); } catch (error) { results.push({ number, name, passed: false, error: error.message }); } }
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const near = (actual, expected, tolerance = .01) => assert(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
  const date = "2026-08-04", expiry = "2026-10-03";
  const leg = (o = {}) => Engine.normalizeLeg({ instrumentType: "option", optionType: "call", side: "long", quantity: 1, multiplier: 100, strike: 100, expiration: expiry, entryPrice: 5, impliedVolatility: .2, commission: 0, ...o });
  const strategy = (legs, o = {}) => Engine.normalizeStrategy({ name: "Test", symbol: "F", underlyingPrice: 100, valuationDate: date, analysisDate: "2026-09-03", riskFreeRate: .04, dividendYield: 0, impliedVolatility: .2, steps: 100, legs, ...o });
  const memoryStorage = () => { const data = {}; return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } }; };

  test(166, "les trois modules du Studio sont disponibles", () => assert(Engine.analyze && Store.importDocument && Chart.renderChart, "Module absent"));
  test(167, "vingt modèles sont fournis", () => assert(Engine.TEMPLATE_NAMES.length === 20, "Nombre de modèles incorrect"));
  test(168, "une jambe d’action est normalisée", () => assert(Engine.normalizeLeg({ instrumentType: "stock" }).instrumentType === "stock", "Action invalide"));
  test(169, "une jambe désactivée ne contribue pas", () => near(Engine.expirationPL(strategy([leg({ enabled: false })]), 120), 0));
  test(170, "le call long calcule son débit initial", () => near(Engine.strategyInitialCashFlow(strategy([leg()])), -500));
  test(171, "le call long calcule son profit à échéance", () => near(Engine.expirationPL(strategy([leg()]), 110), 500));
  test(172, "le put long calcule son profit à échéance", () => near(Engine.expirationPL(strategy([leg({ optionType: "put", strike: 100, entryPrice: 4 })]), 90), 600));
  test(173, "le put court calcule son profit à échéance", () => near(Engine.expirationPL(strategy([leg({ optionType: "put", side: "short", strike: 100, entryPrice: 4 })]), 90), -600));
  test(174, "les commissions réduisent le résultat", () => near(Engine.expirationPL(strategy([leg({ commission: 7 })]), 110), 493));
  test(175, "la quantité de contrats est respectée", () => near(Engine.expirationPL(strategy([leg({ quantity: 2 })]), 110), 1000));
  test(176, "le multiplicateur est respecté", () => near(Engine.expirationPL(strategy([leg({ multiplier: 10 })]), 110), 50));
  test(177, "l’action longue calcule son profit", () => near(Engine.expirationPL(strategy([Engine.normalizeLeg({ instrumentType: "stock", side: "long", quantity: 100, entryPrice: 100 })]), 110), 1000));
  test(178, "l’action courte calcule son profit", () => near(Engine.expirationPL(strategy([Engine.normalizeLeg({ instrumentType: "stock", side: "short", quantity: 100, entryPrice: 100 })]), 90), 1000));
  test(179, "un bull call spread a une perte bornée", () => { const a = Engine.analyze(strategy([leg({ strike: 100, entryPrice: 5 }), leg({ strike: 110, entryPrice: 2, side: "short" })])); near(a.maxLoss, -300); near(a.maxProfit, 700); near(a.breakEvens[0], 103, .03); });
  test(180, "un bear call spread a un crédit borné", () => { const a = Engine.analyze(strategy([leg({ strike: 100, entryPrice: 5, side: "short" }), leg({ strike: 110, entryPrice: 2 })])); near(a.maxProfit, 300); near(a.maxLoss, -700); near(a.breakEvens[0], 103, .03); });
  test(181, "un put garanti reconnaît le capital requis", () => { const a = Engine.analyze(strategy([leg({ optionType: "put", side: "short", entryPrice: 4 })])); near(a.capital.amount, 9600); assert(!a.capital.estimated, "Capital marqué estimatif"); });
  test(182, "un call couvert reconnaît les actions", () => { const s = strategy([Engine.normalizeLeg({ instrumentType: "stock", side: "long", quantity: 100, entryPrice: 100 }), leg({ side: "short", strike: 110, entryPrice: 3 })]); assert(Engine.analyze(s).capital.method === "Actions de couverture", "Couverture non reconnue"); });
  test(183, "un risque illimité est signalé", () => assert(Engine.analyze(strategy([leg({ side: "short" })])).maxLoss === -Infinity, "Risque non signalé"));
  test(184, "le prix binomial à l’échéance égale l’intrinsèque", () => near(Engine.americanOptionValue({ S: 110, K: 100, r: .04, q: 0, sigma: .2, T: 0, N: 100, optionType: "call" }), 10));
  test(185, "une volatilité nulle est gérée", () => assert(Number.isFinite(Engine.americanOptionValue({ S: 100, K: 100, r: .04, q: 0, sigma: 0, T: 1, N: 100, optionType: "call" })), "Résultat invalide"));
  test(186, "un cours nul est géré pour un put", () => near(Engine.americanOptionValue({ S: 0, K: 100, r: .04, q: 0, sigma: .2, T: 1, N: 100, optionType: "put" }), 100));
  test(187, "les paramètres binomiaux invalides sont refusés", () => { let thrown = false; try { Engine.americanOptionValue({ S: NaN, K: 100, r: .04, sigma: .2, T: 1, N: 100 }); } catch { thrown = true; } assert(thrown, "Aucune erreur"); });
  test(188, "un nombre de pas invalide est refusé", () => { let thrown = false; try { Engine.americanOptionValue({ S: 100, K: 100, r: .04, q: 0, sigma: .2, T: 1, N: 1 }); } catch { thrown = true; } assert(thrown, "Aucune erreur"); });
  test(189, "le modèle CRR converge pour un call européen équivalent", () => near(Engine.americanOptionValue({ S: 100, K: 100, r: .05, q: 0, sigma: .2, T: 1, N: 500, optionType: "call" }), 10.4506, .03));
  test(190, "la valeur sélectionnée est finie", () => assert(Number.isFinite(Engine.strategyPLAtDate(strategy([leg()]), 100, "2026-09-03")), "Projection invalide"));
  test(191, "delta est calculé", () => assert(Engine.strategyGreeks(strategy([leg()])).delta > 0, "Delta invalide"));
  test(192, "gamma est calculé", () => assert(Engine.strategyGreeks(strategy([leg()])).gamma > 0, "Gamma invalide"));
  test(193, "theta est calculé", () => assert(Number.isFinite(Engine.strategyGreeks(strategy([leg()])).theta), "Theta invalide"));
  test(194, "vega est calculé", () => assert(Engine.strategyGreeks(strategy([leg()])).vega > 0, "Vega invalide"));
  test(195, "rho est calculé", () => assert(Number.isFinite(Engine.strategyGreeks(strategy([leg()])).rho), "Rho invalide"));
  test(196, "les multiéchéances sont signalées", () => assert(Engine.analyze(strategy([leg(), leg({ expiration: "2027-01-15" })])).multiExpiration, "Avertissement absent"));
  test(197, "la plage automatique englobe le cours", () => { const r = Engine.analyze(strategy([leg()])).range; assert(r.min < 100 && r.max > 100, "Plage incorrecte"); });
  test(198, "la plage personnalisée est respectée", () => { const r = Engine.analyze(strategy([leg()], { rangeMode: "custom", rangeMin: 80, rangeMax: 120 })).range; assert(r.min === 80 && r.max === 120, "Plage incorrecte"); });
  test(199, "le tableau analytique est produit", () => assert(Chart.buildTable(strategy([leg()])).length > 10, "Tableau vide"));
  test(200, "le CSV possède ses colonnes", () => assert(Chart.tableToCsv(Chart.buildTable(strategy([leg()]))).startsWith("Cours,P/L échéance"), "CSV invalide"));
  test(201, "le graphique SVG possède un titre accessible", () => { const svg = Chart.renderChart(strategy([leg()])); assert(svg.includes("<title") && svg.includes('role="img"'), "Accessibilité absente"); });
  test(202, "le graphique affiche le cours actuel", () => assert(Chart.renderChart(strategy([leg()])).includes("Cours actuel"), "Cours absent"));
  test(203, "le graphique affiche les seuils de rentabilité", () => assert(Chart.renderChart(strategy([leg()])).includes("S.R."), "Seuil absent"));
  test(204, "une comparaison originale peut être superposée", () => assert(Chart.renderChart(strategy([leg()]), { comparison: strategy([leg({ strike: 105 })]) }).includes("Stratégie originale"), "Comparaison absente"));
  test(205, "l’export JSON est valide", () => assert(Store.importDocument(Store.exportDocument(strategy([leg()]))).valid, "Export invalide"));
  test(206, "l’import JSON refuse un mauvais schéma", () => assert(!Store.importDocument('{"schema":"autre","version":1,"strategy":{}}').valid, "Schéma accepté"));
  test(207, "l’import JSON refuse les propriétés dangereuses", () => assert(!Store.importDocument('{"schema":"options-strategy-studio","version":1,"strategy":{"constructor":{"x":1}}}').valid, "Propriété acceptée"));
  test(208, "la sauvegarde locale restaure une stratégie", () => { const storage = memoryStorage(); Store.saveStrategy(strategy([leg()]), storage); assert(Store.load(storage).strategies.length === 1, "Sauvegarde absente"); });
  test(209, "le lien partagé exclut les notes privées", () => { const s = strategy([leg({ notes: "secret", currentMark: 9 })]); const raw = Store.createShareFragment(s); assert(!raw.includes("secret") && Store.parseShareFragment(raw).value.legs[0].notes === "", "Donnée privée présente"); });
  test(210, "le lien partagé conserve les hypothèses publiques", () => assert(Store.parseShareFragment(Store.createShareFragment(strategy([leg()]))).value.symbol === "F", "Symbole perdu"));
  test(211, "l’interface est entièrement locale", () => assert(!/https?:\/\/|cdn|fetch\(/i.test(html + app), "Dépendance externe détectée"));
  test(212, "le Worker demeure absent du Studio", () => assert(!/workers\.dev|MARKETDATA_TOKEN|stocks\/candles/i.test(html + app + css), "Worker référencé"));
  test(213, "priceHistory n’est pas alimenté par les cotations", () => assert(!/appendRealPricePoint|PRICE_HISTORY_BUCKET_MS/.test(market), "Alimentation encore active"));
  test(214, "la navigation et le bouton F/SPY sont présents", () => assert(index.includes("Options Strategy Studio") && index.includes('id="analyzeStrategy"') && app.includes("SPY").valueOf(), "Accès incomplet"));
  test(215, "le mobile 390 px empêche le débordement de page", () => assert(css.includes("@media (max-width: 390px)") && css.includes("overflow-x: hidden") && css.includes("min-width: 0"), "Protection mobile absente"));
  test(216, "le scénario de référence du call long est exact", () => { const s = strategy([leg({ strike: 100, entryPrice: 5 })]); assert(JSON.stringify([90, 100, 105, 110].map((p) => Engine.expirationPL(s, p))) === JSON.stringify([-500, -500, 0, 500]), "Résultats inexacts"); });
  test(217, "le scénario de référence du put long est exact", () => { const s = strategy([leg({ optionType: "put", strike: 100, entryPrice: 4 })]); assert(JSON.stringify([90, 96, 100, 110].map((p) => Engine.expirationPL(s, p))) === JSON.stringify([600, 0, -400, -400]), "Résultats inexacts"); });
  test(218, "le scénario de référence du put court est exact", () => { const s = strategy([leg({ optionType: "put", side: "short", strike: 100, entryPrice: 4 })]); assert(JSON.stringify([90, 96, 100, 110].map((p) => Engine.expirationPL(s, p))) === JSON.stringify([-600, 0, 400, 400]), "Résultats inexacts"); });
  test(219, "le bull call spread de référence est exact", () => { const a = Engine.analyze(strategy([leg({ strike: 100, entryPrice: 6 }), leg({ strike: 110, entryPrice: 2, side: "short" })])); near(a.initialCashFlow, -400); near(a.maxLoss, -400); near(a.maxProfit, 600); near(a.breakEvens[0], 104, .03); });
  test(220, "le bear call spread de référence est exact", () => { const a = Engine.analyze(strategy([leg({ strike: 100, entryPrice: 6, side: "short" }), leg({ strike: 110, entryPrice: 2 })])); near(a.initialCashFlow, 400); near(a.maxProfit, 400); near(a.maxLoss, -600); near(a.breakEvens[0], 104, .03); });
  test(221, "le covered call de référence est exact", () => { const a = Engine.analyze(strategy([Engine.normalizeLeg({ instrumentType: "stock", side: "long", quantity: 100, entryPrice: 100 }), leg({ side: "short", strike: 110, entryPrice: 3 })])); near(a.maxProfit, 1300); near(a.maxLoss, -9700); near(a.breakEvens[0], 97, .03); });
  test(222, "l’iron condor possède un résultat borné", () => { const a = Engine.analyze(strategy([leg({ optionType: "put", strike: 90, entryPrice: 1, side: "long" }), leg({ optionType: "put", strike: 95, entryPrice: 2, side: "short" }), leg({ strike: 105, entryPrice: 2, side: "short" }), leg({ strike: 110, entryPrice: 1, side: "long" })])); assert(Number.isFinite(a.maxProfit) && Number.isFinite(a.maxLoss) && a.maxProfit > 0 && a.maxLoss < 0, "Iron condor invalide"); });
  test(223, "une date d’évaluation invalide est refusée", () => assert(!Engine.validateStrategy({ ...strategy([leg()]), valuationDate: "date-invalide" }).valid, "Date acceptée"));
  test(224, "NaN est refusé dans les hypothèses", () => assert(!Engine.validateStrategy({ ...strategy([leg()]), underlyingPrice: NaN }).valid, "NaN accepté"));
  test(225, "une valeur infinie est refusée", () => assert(!Engine.validateStrategy({ ...strategy([leg()]), riskFreeRate: Infinity }).valid, "Infini accepté"));
  test(226, "un taux négatif et un dividende sont pris en charge", () => assert(Number.isFinite(Engine.americanOptionValue({ S: 100, K: 100, r: -.01, q: .03, sigma: .2, T: 1, N: 200, optionType: "put" })), "Calcul invalide"));

  const failed = results.filter((r) => !r.passed); const summary = { total: results.length, passed: results.length - failed.length, failed: failed.length, results }; globalScope.__OPTIONS_STUDIO_TEST_RESULTS__ = summary;
  if (isNode) { results.forEach((r) => console.log(`${r.passed ? "OK" : "ECHEC"} ${r.number} ${r.name}${r.error ? ` — ${r.error}` : ""}`)); console.log(`Options Studio: ${summary.passed}/${summary.total}`); if (failed.length) process.exitCode = 1; module.exports = summary; }
  else {
    const groups = [globalScope.__PORTAL_TEST_RESULTS__, globalScope.__PORTAL_V11_TEST_RESULTS__, globalScope.__PORTAL_V111_TEST_RESULTS__, globalScope.__PORTAL_V12_TEST_RESULTS__, globalScope.__PORTAL_V121_TEST_RESULTS__, globalScope.__PORTAL_V13_TEST_RESULTS__, summary].filter(Boolean);
    const total = groups.reduce((n, g) => n + g.total, 0), passed = groups.reduce((n, g) => n + g.passed, 0), all = groups.flatMap((g) => g.results);
    const summaryElement = document.getElementById("testSummary"), body = document.getElementById("testResults"); summaryElement.className = passed === total ? "summary passed" : "summary failed"; summaryElement.textContent = `${passed}/${total} tests réussis`; body.innerHTML = all.map((r) => `<tr class="${r.passed ? "passed" : "failed"}"><td>${r.passed ? "RÉUSSI" : "ÉCHEC"}</td><td>${r.number || "—"} — ${r.name}</td><td>Réussite</td><td>${r.passed ? "Réussite" : r.error}</td></tr>`).join("");
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
