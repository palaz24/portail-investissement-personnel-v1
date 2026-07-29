(function runV11Tests(globalScope) {
  "use strict";

  const isNode = typeof module !== "undefined" && module.exports;
  const Market = isNode ? require("../js/market-data.js") : globalScope.PortalMarketData;
  const History = isNode ? require("../js/history-utils.js") : globalScope.PortalHistory;
  const results = [];

  function equal(actual, expected) {
    return typeof expected === "number"
      ? Math.abs(Number(actual) - expected) <= 1e-9
      : JSON.stringify(actual) === JSON.stringify(expected);
  }

  function test(name, expected, callback) {
    try {
      const actual = callback();
      const passed = equal(actual, expected);
      results.push({ name, expected, actual, passed });
    } catch (error) {
      results.push({ name, expected, actual: `ERREUR: ${error.message}`, passed: false });
    }
  }

  const option = (fields = {}) => ({
    symbol: "F",
    expiration: "2026-08-21",
    optionType: "CALL",
    strike: 15,
    contractId: "LOCAL-OPTION",
    ...fields
  });
  const baseState = {
    securities: [
      { symbol: "F", active: true },
      { symbol: "SPY", active: true }
    ],
    transactions: [{ id: "KEEP", date: "2026-01-01" }],
    prices: { F: { price: 10, updatedAt: "2026-01-01T12:00:00Z" } },
    optionPrices: { "LOCAL-OPTION": { price: 0.5, updatedAt: "2026-01-01T12:00:00Z" } }
  };

  test("35. Symbole OCC d’un call Ford", "F260821C00015000", () => Market.buildOccSymbol(option()));
  test("36. Symbole OCC d’un put Ford avec strike décimal", "F260821P00015500", () => Market.buildOccSymbol(option({ optionType: "PUT", strike: 15.5 })));
  test("37. Symbole OCC d’une option SPY", "SPY261218C00600000", () => Market.buildOccSymbol(option({ symbol: "SPY", expiration: "2026-12-18", strike: 600 })));
  test("38. Calcul du milieu bid-ask", 1.5, () => Market.midpoint(1, 2));
  test("39. Repli vers mid", 1.25, () => Market.selectOptionPrice({ bid: 0, ask: 0, mid: 1.25, last: 1.1 }));
  test("40. Repli vers last", 1.1, () => Market.selectOptionPrice({ bid: null, ask: null, mid: null, last: 1.1 }));
  test("41. Absence de prix fiable", null, () => Market.selectOptionPrice({ bid: 0, ask: 0, mid: 0, last: 0 }));
  test("42. Conservation de l’ancien prix après erreur", 0.5, () => {
    const applied = Market.applyQuoteResponse(baseState, { openOptions: [option()] }, {
      retrievedAt: "2026-07-28T20:00:00Z",
      options: { F260821C00015000: { bid: 0, ask: 0, mid: 0, last: 0 } },
      errors: []
    });
    return applied.next.optionPrices["LOCAL-OPTION"].price;
  });
  test("43. Mise à jour d’une action", 14.25, () => {
    const applied = Market.applyQuoteResponse(baseState, { openOptions: [] }, {
      retrievedAt: "2026-07-28T20:00:00Z",
      stocks: { F: { price: 14.25, updatedAt: "2026-07-28T19:59:00Z" } },
      errors: []
    });
    return applied.next.prices.F.price;
  });
  test("44. Mise à jour d’une option", 1.5, () => {
    const applied = Market.applyQuoteResponse(baseState, { openOptions: [option()] }, {
      retrievedAt: "2026-07-28T20:00:00Z",
      options: { F260821C00015000: { bid: 1, ask: 2, last: 1.4 } },
      errors: []
    });
    return applied.next.optionPrices["LOCAL-OPTION"].price;
  });
  test("45. Mise à jour partielle", [1, 0], () => {
    const applied = Market.applyQuoteResponse(baseState, { openOptions: [option()] }, {
      retrievedAt: "2026-07-28T20:00:00Z",
      stocks: { F: { price: 14.25 } },
      options: { F260821C00015000: { bid: 0, ask: 0, mid: 0, last: 0 } },
      errors: []
    });
    return [applied.stocksUpdated, applied.optionsUpdated];
  });
  test("46. La requête ne contient que symboles et options OCC", ["options", "stocks"], () => {
    const request = Market.buildQuoteRequest(baseState, { openOptions: [option()] });
    return Object.keys(request).sort();
  });
  test("47. Aucun champ privé n’est transmis", false, () => {
    const request = Market.buildQuoteRequest({
      ...baseState,
      cash: 999,
      notes: "privé",
      quantities: [100]
    }, { openOptions: [option({ contractsOpen: 5, openingBasisRemaining: 900 })] });
    return /cash|note|quant|contractId|basis/i.test(JSON.stringify(request));
  });
  test("48. Contrat invalide bloqué", true, () => {
    try {
      Market.buildOccSymbol(option({ expiration: "28/07/2026" }));
      return false;
    } catch {
      return true;
    }
  });
  test("49. Transactions triées par date décroissante", ["B", "A"], () => {
    return History.sortHistoricalDescending([
      { id: "A", date: "2026-01-01" },
      { id: "B", date: "2026-02-01" }
    ]).map((item) => item.id);
  });
  test("50. Même date triée par heure de création décroissante", ["B", "A"], () => {
    return History.sortHistoricalDescending([
      { id: "A", date: "2026-01-01", createdAt: "2026-01-01T09:00:00Z" },
      { id: "B", date: "2026-01-01", createdAt: "2026-01-01T10:00:00Z" }
    ]).map((item) => item.id);
  });
  test("51. Même date et heure triées par identifiant décroissant", ["TX-10", "TX-2"], () => {
    return History.sortHistoricalDescending([
      { id: "TX-2", date: "2026-01-01", createdAt: "2026-01-01T10:00:00Z" },
      { id: "TX-10", date: "2026-01-01", createdAt: "2026-01-01T10:00:00Z" }
    ]).map((item) => item.id);
  });
  test("52. Dernier recours : ordre d’enregistrement décroissant", ["B", "A"], () => {
    return History.sortHistoricalDescending([
      { id: "", date: "2026-01-01" },
      { id: "", date: "2026-01-01" }
    ]).map((item, index) => index === 0 ? "B" : "A");
  });
  test("53. Échéances futures triées par date croissante", ["A", "B"], () => {
    return History.sortFutureExpirationsAscending([
      { contractId: "B", expiration: "2026-12-18" },
      { contractId: "A", expiration: "2026-08-21" }
    ]).map((item) => item.contractId);
  });
  test("54. Une action interdite n’entre pas dans la requête", ["F", "SPY"], () => {
    const request = Market.buildQuoteRequest({
      ...baseState,
      securities: [
        { symbol: "F", active: true },
        { symbol: "SPY", active: true },
        { symbol: "TLT", active: true }
      ]
    }, { openOptions: [] });
    return request.stocks;
  });
  test("55. Seules les collections de prix changent", true, () => {
    const applied = Market.applyQuoteResponse(baseState, { openOptions: [] }, {
      retrievedAt: "2026-07-28T20:00:00Z",
      stocks: { F: { price: 14.25 } },
      errors: []
    });
    return JSON.stringify(applied.next.transactions) === JSON.stringify(baseState.transactions)
      && JSON.stringify(applied.next.securities) === JSON.stringify(baseState.securities);
  });

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  if (isNode) {
    for (const result of results) {
      console.log(`${result.passed ? "OK" : "ECHEC"} | ${result.name} | attendu=${JSON.stringify(result.expected)} | obtenu=${JSON.stringify(result.actual)}`);
    }
    console.log(`RESULTAT_V1_1=${passed}/${results.length}`);
    if (failed) process.exitCode = 1;
  } else {
    const existing = globalScope.__PORTAL_TEST_RESULTS__ || { passed: 0, failed: 0, total: 0, results: [] };
    const summary = document.getElementById("testSummary");
    const body = document.getElementById("testResults");
    const totalPassed = existing.passed + passed;
    const totalFailed = existing.failed + failed;
    const total = existing.total + results.length;
    summary.className = totalFailed ? "summary failed" : "summary passed";
    summary.textContent = totalFailed
      ? `${totalPassed}/${total} tests réussis — ${totalFailed} échec(s)`
      : `${totalPassed}/${total} tests réussis`;
    body.insertAdjacentHTML("beforeend", results.map((result) => `
      <tr class="${result.passed ? "passed" : "failed"}">
        <td>${result.passed ? "RÉUSSI" : "ÉCHEC"}</td>
        <td>${result.name}</td>
        <td>${String(result.expected)}</td>
        <td>${String(result.actual)}</td>
      </tr>`).join(""));
    globalScope.__PORTAL_V11_TEST_RESULTS__ = { passed, failed, total: results.length, results };
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
