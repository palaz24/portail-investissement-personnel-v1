(async function runPortalV13Tests(globalScope) {
  "use strict";

  const isNode = typeof module !== "undefined" && module.exports;
  if (!isNode) {
    while (!globalScope.__PORTAL_V121_TEST_RESULTS__) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  const Storage = isNode ? require("../js/storage.js") : globalScope.PortalStorage;
  const Backup = isNode ? require("../js/backup.js") : globalScope.PortalBackup;
  const Market = isNode ? require("../js/market-data.js") : globalScope.PortalMarketData;
  const Charts = isNode ? require("../js/security-charts.js") : globalScope.PortalSecurityCharts;
  const Calc = isNode ? require("../js/calculations.js") : globalScope.PortalCalculations;

  let htmlSource = "";
  let appSource = "";
  let cssSource = "";
  let calculationsSource = "";
  if (isNode) {
    const fs = require("node:fs");
    const path = require("node:path");
    htmlSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
    appSource = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
    cssSource = fs.readFileSync(path.join(__dirname, "../css/style.css"), "utf8");
    calculationsSource = fs.readFileSync(path.join(__dirname, "../js/calculations.js"), "utf8");
  } else {
    [htmlSource, appSource, cssSource, calculationsSource] = await Promise.all([
      fetch(`../index.html?test=${Date.now()}`).then((response) => response.text()),
      fetch(`../js/app.js?test=${Date.now()}`).then((response) => response.text()),
      fetch(`../css/style.css?test=${Date.now()}`).then((response) => response.text()),
      fetch(`../js/calculations.js?test=${Date.now()}`).then((response) => response.text()),
    ]);
  }

  const results = [];
  function test(number, name, callback) {
    try {
      callback();
      results.push({ number, name, passed: true });
      console.log(`✅ Test ${number}: ${name}`);
    } catch (error) {
      results.push({ number, name, passed: false, error: error.message });
      console.error(`❌ Test ${number}: ${name} — ${error.message}`);
    }
  }
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }
  function equal(actual, expected, message) {
    assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)}`);
  }

  function stateBase() {
    return {
      ...Storage.getEmptyData(),
      securities: [{
        id: "SEC-F",
        symbol: "F",
        name: "Ford",
        type: "ACTION",
        currency: "USD",
        marginEligible: true,
        marginRequirement: 0.3,
        active: true,
      }],
      prices: { F: { price: 14, updatedAt: "2026-07-30T10:00:00.000Z", source: "Market Data" } },
    };
  }

  function option(overrides = {}) {
    return {
      id: "OPT-1",
      contractId: "OPT-1",
      symbol: "F",
      optionType: "PUT",
      side: "LONG",
      strike: 12,
      expiration: "2026-12-18",
      contractsOpen: 1,
      ...overrides,
    };
  }

  test(148, "la section Risque est retirée visuellement", () => {
    assert(!htmlSource.includes('id="securityRisk"'), "La section Risque est encore visible");
    assert(!htmlSource.includes("<h3>Niveau de risque simple</h3>"), "Le titre Risque est encore visible");
  });

  test(149, "les données et calculs internes de risque sont conservés", () => {
    assert(calculationsSource.includes("riskLevel"), "Le calcul de risque interne a été supprimé");
    assert(appSource.includes("derived.errors"), "Les alertes internes ont été supprimées");
    assert(Calc.calculatePortfolio(stateBase()).securities[0].riskLevel, "Le niveau de risque interne est absent");
  });

  test(150, "priceHistory est créé pour une nouvelle base", () => {
    equal(Storage.getEmptyData().priceHistory, {}, "priceHistory n'est pas initialisé");
  });

  test(151, "une vraie cotation est ajoutée à priceHistory", () => {
    const applied = Market.applyQuoteResponse(stateBase(), { openOptions: [] }, {
      retrievedAt: "2026-07-30T10:16:00.000Z",
      stocks: { F: { price: 14.25, updatedAt: "2026-07-30T10:16:00.000Z" } },
      options: {},
    });
    const point = applied.next.priceHistory.F[0];
    equal([point.symbol, point.price, point.source, point.currency], ["F", 14.25, "Market Data", "USD"], "La cotation réelle est incorrecte");
  });

  test(152, "les doublons d'une même période de 15 minutes sont bloqués", () => {
    let history = Market.appendRealPricePoint({}, { symbol: "F", price: 14, at: "2026-07-30T10:01:00Z", source: "Market Data", currency: "USD" });
    history = Market.appendRealPricePoint(history, { symbol: "F", price: 14.2, at: "2026-07-30T10:14:00Z", source: "Market Data", currency: "USD" });
    assert(history.F.length === 1 && history.F[0].price === 14.2, "Le doublon de 15 minutes n'a pas été remplacé");
  });

  test(153, "priceHistory est limité à 5 000 points par titre", () => {
    const points = [];
    for (let index = 0; index < 5005; index += 1) {
      points.push({
        symbol: "F",
        price: 10 + index / 100,
        at: new Date(Date.UTC(2020, 0, 1, 0, index * 15)).toISOString(),
        source: "Market Data",
        currency: "USD",
      });
    }
    const history = Storage.normalizePriceHistory({ F: points });
    assert(history.F.length === 5000, `Limite incorrecte: ${history.F.length}`);
  });

  test(154, "une ancienne sauvegarde sans priceHistory demeure compatible", () => {
    const legacy = stateBase();
    delete legacy.priceHistory;
    const restored = Backup.validatePayload(Backup.createPayload(legacy));
    assert(restored.valid && restored.value.priceHistory, "L'ancienne sauvegarde n'est pas compatible");
  });

  test(155, "l'export et le réimport conservent priceHistory", () => {
    const state = stateBase();
    state.priceHistory = Market.appendRealPricePoint({}, {
      symbol: "F", price: 14.2, at: "2026-07-30T10:16:00Z", source: "Market Data", currency: "USD",
    });
    const restored = Backup.validatePayload(Backup.createPayload(state));
    assert(restored.valid && restored.value.priceHistory.F[0].price === 14.2, "priceHistory n'a pas été restauré");
  });

  test(156, "le message d'historique en constitution s'affiche avec moins de deux points", () => {
    const model = Charts.buildModel({ symbol: "F", currentPrice: 14, priceHistory: {}, options: [option()] });
    assert(Charts.renderPriceChart(model).includes("Historique en cours de constitution"), "Le message initial manque");
  });

  test(157, "le prix actuel demeure affiché sans historique", () => {
    const model = Charts.buildModel({ symbol: "F", currentPrice: 14, priceHistory: {}, options: [option()] });
    assert(Charts.renderPriceChart(model).includes("Cours actuel"), "Le prix actuel manque");
  });

  test(158, "tous les strikes actifs et leurs types sont affichés", () => {
    const model = Charts.buildModel({
      symbol: "F",
      currentPrice: 14,
      now: new Date("2026-07-30T12:00:00Z"),
      options: [
        option(),
        option({ id: "OPT-2", contractId: "OPT-2", optionType: "CALL", strike: 16 }),
        option({ id: "OPT-3", contractId: "OPT-3", optionType: "CALL", strike: 18, expiration: "2028-01-21" }),
      ],
    });
    equal(
      model.options.map((item) => [item.type, item.strike]),
      [["PUT", 12], ["CALL", 16], ["LEAPS", 18]],
      "Les strikes actifs sont incomplets",
    );
  });

  test(159, "les distances en dollars et en pourcentage sont exactes", () => {
    const model = Charts.buildModel({
      symbol: "F",
      currentPrice: 10,
      now: new Date("2026-07-30T12:00:00Z"),
      options: [
        option({ strike: 12 }),
        option({ id: "EQ", contractId: "EQ", strike: 10 }),
        option({ id: "BELOW", contractId: "BELOW", strike: 8 }),
      ],
    });
    equal(
      model.options.map((item) => [item.distanceDollars, item.distancePercent, item.position]),
      [[-2, -20, "au-dessous du cours"], [0, 0, "au niveau du cours"], [2, 20, "au-dessus du cours"]],
      "Les distances sont incorrectes",
    );
  });

  test(160, "les options fermées et expirées sont cachées par défaut", () => {
    const model = Charts.buildModel({
      symbol: "F",
      currentPrice: 14,
      now: new Date("2026-07-30T12:00:00Z"),
      options: [
        option({ id: "OPEN", contractId: "OPEN" }),
        option({ id: "CLOSED", contractId: "CLOSED", contractsOpen: 0 }),
        option({ id: "EXPIRED", contractId: "EXPIRED", expiration: "2026-06-01" }),
      ],
    });
    const all = Charts.buildModel({
      symbol: "F",
      currentPrice: 14,
      now: new Date("2026-07-30T12:00:00Z"),
      includeExpired: true,
      options: [
        option({ id: "OPEN", contractId: "OPEN" }),
        option({ id: "CLOSED", contractId: "CLOSED", contractsOpen: 0 }),
        option({ id: "EXPIRED", contractId: "EXPIRED", expiration: "2026-06-01" }),
      ],
    });
    equal(model.options.map((item) => item.id), ["OPEN"], "Une option inactive est visible");
    equal(all.options.map((item) => item.id), ["EXPIRED", "OPEN"], "Le bouton Tous les strikes ne révèle pas les échéances expirées");
  });

  test(161, "la sélection d'une option est synchronisée entre les deux graphiques", () => {
    const model = Charts.buildModel({
      symbol: "F", currentPrice: 14, now: new Date("2026-07-30T12:00:00Z"), options: [option()],
    });
    assert(
      Charts.renderPriceChart(model, "OPT-1").includes("is-selected")
      && Charts.renderDistanceChart(model, "OPT-1").includes("is-selected")
      && appSource.includes("selectedChartOptionId = target.dataset.chartOption"),
      "La mise en évidence synchronisée manque",
    );
  });

  test(162, "le mode clair possède des couleurs adaptées", () => {
    assert(cssSource.includes(':root[data-theme="light"]'), "Le mode clair manque");
  });

  test(163, "le mode sombre demeure disponible", () => {
    assert(cssSource.includes("color-scheme: dark;") && appSource.includes('theme === "light" ? "light" : "dark"'), "Le mode sombre manque");
  });

  test(164, "les graphiques mobiles ne débordent pas de la page", () => {
    assert(
      cssSource.includes(".chart-scroll { width: 100%; overflow-x: auto; }")
      && cssSource.includes(".distance-chart {\n    overflow-x: auto;"),
      "Le défilement interne mobile manque",
    );
  });

  test(165, "les modules V1.3.0 se chargent sans erreur JavaScript", () => {
    assert(Storage.APP_VERSION === "1.3.0" && typeof Charts.buildModel === "function", "Un module V1.3.0 manque");
  });

  const failed = results.filter((result) => !result.passed);
  const summary = {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
  globalScope.__PORTAL_V13_TEST_RESULTS__ = summary;

  if (isNode) {
    console.log(`\nV1.3.0: ${summary.passed}/${summary.total} tests réussis.`);
    if (failed.length) process.exitCode = 1;
    module.exports = summary;
  } else {
    const groups = [
      globalScope.__PORTAL_TEST_RESULTS__,
      globalScope.__PORTAL_V11_TEST_RESULTS__,
      globalScope.__PORTAL_V111_TEST_RESULTS__,
      globalScope.__PORTAL_V12_TEST_RESULTS__,
      globalScope.__PORTAL_V121_TEST_RESULTS__,
      summary,
    ].filter(Boolean);
    const totalPassed = groups.reduce((sum, group) => sum + group.passed, 0);
    const totalFailed = groups.reduce((sum, group) => sum + group.failed, 0);
    const total = groups.reduce((sum, group) => sum + group.total, 0);
    const summaryElement = document.getElementById("testSummary");
    const body = document.getElementById("testResults");
    summaryElement.className = totalFailed ? "summary failed" : "summary passed";
    summaryElement.textContent = totalFailed
      ? `${totalPassed}/${total} tests réussis — ${totalFailed} échec(s)`
      : `${totalPassed}/${total} tests réussis`;
    body.insertAdjacentHTML("beforeend", results.map((result) => `
      <tr class="${result.passed ? "passed" : "failed"}">
        <td>${result.passed ? "RÉUSSI" : "ÉCHEC"}</td>
        <td>${result.number}. ${result.name}</td>
        <td>Réussi</td>
        <td>${result.passed ? "Réussi" : result.error}</td>
      </tr>`).join(""));
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
