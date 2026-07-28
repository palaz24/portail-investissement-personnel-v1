(function runPortalTests(globalScope) {
  "use strict";

  const isNode = typeof module !== "undefined" && module.exports;
  const Calc = isNode ? require("../js/calculations.js") : globalScope.PortalCalculations;
  const Storage = isNode ? require("../js/storage.js") : globalScope.PortalStorage;
  const Forms = isNode ? require("../js/forms.js") : globalScope.PortalForms;
  const Backup = isNode ? require("../js/backup.js") : globalScope.PortalBackup;

  const results = [];

  function baseState(transactions = [], extra = {}) {
    return {
      version: "1.0.0",
      demoMode: false,
      accountSettings: {
        accountName: "Test",
        baseCurrency: "USD",
        marginInterestRate: 8,
        stockCommission: 0,
        optionCommission: 0,
        assignmentFee: 0
      },
      securities: [
        { id: "SEC-F", symbol: "F", name: "Ford", type: "ACTION", currency: "USD", marginEligible: true, marginRequirement: 0.30, active: true },
        { id: "SEC-SPY", symbol: "SPY", name: "SPY", type: "FNB", currency: "USD", marginEligible: true, marginRequirement: 0.30, active: true }
      ],
      transactions,
      prices: {},
      optionPrices: {},
      positionsInitiales: [],
      history: [],
      ...extra
    };
  }

  function tx(id, date, type, fields = {}) {
    return { id, date, type, ...fields };
  }

  function security(result, symbol = "F") {
    return result.securities.find((item) => item.symbol === symbol);
  }

  function equal(actual, expected, tolerance = 1e-9) {
    if (typeof expected === "number") return Math.abs(Number(actual) - expected) <= tolerance;
    return actual === expected;
  }

  function test(name, expected, callback) {
    try {
      const actual = callback();
      const passed = equal(actual, expected);
      results.push({ name, expected, actual, passed, error: passed ? "" : `Attendu ${expected}, obtenu ${actual}` });
    } catch (error) {
      results.push({ name, expected, actual: "ERREUR", passed: false, error: error.message });
    }
  }

  test("1. Achat d’actions — 100 actions à 10 $ donnent une valeur comptable de 1 000 $", 1000, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "DEPOSIT", { amount: 2000 }),
      tx("2", "2026-01-02", "STOCK_BUY", { symbol: "F", quantity: 100, price: 10, fees: 0 })
    ]));
    return security(result).stockBookValue;
  });

  test("2. Achats successifs — le coût moyen attendu est 15 $", 15, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "STOCK_BUY", { symbol: "F", quantity: 100, price: 10, fees: 0 }),
      tx("2", "2026-01-02", "STOCK_BUY", { symbol: "F", quantity: 100, price: 20, fees: 0 })
    ]));
    return security(result).averageCost;
  });

  test("3. Vente partielle — le coût moyen restant demeure 10 $", 10, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "STOCK_BUY", { symbol: "F", quantity: 100, price: 10, fees: 0 }),
      tx("2", "2026-01-02", "STOCK_SELL", { symbol: "F", quantity: 40, price: 12, fees: 0 })
    ]));
    return security(result).averageCost;
  });

  test("4. Option courte profitable — prime 100 $, rachat 40 $, profit 60 $", 60, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "OPTION_SELL_OPEN", { symbol: "F", optionType: "CALL", strike: 12, expiration: "2026-02-20", contracts: 1, premium: 1, fees: 0, shortMarginRequirement: 0, contractId: "C1" }),
      tx("2", "2026-01-05", "OPTION_BUY_CLOSE", { symbol: "F", contracts: 1, premium: 0.4, fees: 0, contractId: "C1" })
    ]));
    return security(result).realizedOptions;
  });

  test("5. Option courte déficitaire — prime 50 $, rachat 120 $, perte 70 $", -70, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "OPTION_SELL_OPEN", { symbol: "F", optionType: "PUT", strike: 10, expiration: "2026-02-20", contracts: 1, premium: 0.5, fees: 0, shortMarginRequirement: 0, contractId: "P1" }),
      tx("2", "2026-01-05", "OPTION_BUY_CLOSE", { symbol: "F", contracts: 1, premium: 1.2, fees: 0, contractId: "P1" })
    ]));
    return security(result).realizedOptions;
  });

  test("6. Option longue profitable — achat 50 $, vente 100 $, profit 50 $", 50, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "OPTION_BUY_OPEN", { symbol: "F", optionType: "CALL", strike: 10, expiration: "2026-02-20", contracts: 1, premium: 0.5, fees: 0, contractId: "LC1" }),
      tx("2", "2026-01-05", "OPTION_SELL_CLOSE", { symbol: "F", contracts: 1, premium: 1, fees: 0, contractId: "LC1" })
    ]));
    return security(result).realizedOptions;
  });

  test("7. Expiration d’une option courte — prime de 50 $ entièrement réalisée", 50, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "OPTION_SELL_OPEN", { symbol: "F", optionType: "CALL", strike: 10, expiration: "2026-01-20", contracts: 1, premium: 0.5, fees: 0, shortMarginRequirement: 0, contractId: "SC2" }),
      tx("2", "2026-01-20", "OPTION_EXPIRY", { symbol: "F", contracts: 1, contractId: "SC2", fees: 0 })
    ]));
    return security(result).realizedOptions;
  });

  test("8. Expiration d’une option longue — prime de 50 $ entièrement perdue", -50, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "OPTION_BUY_OPEN", { symbol: "F", optionType: "PUT", strike: 10, expiration: "2026-01-20", contracts: 1, premium: 0.5, fees: 0, contractId: "LP2" }),
      tx("2", "2026-01-20", "OPTION_EXPIRY", { symbol: "F", contracts: 1, contractId: "LP2", fees: 0 })
    ]));
    return security(result).realizedOptions;
  });

  test("9. Assignation d’un PUT vendu — 1 contrat crée 100 actions", 100, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "DEPOSIT", { amount: 2000 }),
      tx("2", "2026-01-02", "OPTION_SELL_OPEN", { symbol: "F", optionType: "PUT", strike: 10, expiration: "2026-01-20", contracts: 1, premium: 0.5, fees: 0, shortMarginRequirement: 0, contractId: "SP3" }),
      tx("3", "2026-01-20", "OPTION_ASSIGNMENT", { symbol: "F", contracts: 1, contractId: "SP3", fees: 0 })
    ]));
    return security(result).shares;
  });

  test("10. Assignation d’un CALL vendu — 100 actions sont vendues", 0, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "STOCK_BUY", { symbol: "F", quantity: 100, price: 8, fees: 0 }),
      tx("2", "2026-01-02", "OPTION_SELL_OPEN", { symbol: "F", optionType: "CALL", strike: 10, expiration: "2026-01-20", contracts: 1, premium: 0.5, fees: 0, shortMarginRequirement: 0, contractId: "SC3" }),
      tx("3", "2026-01-20", "OPTION_ASSIGNMENT", { symbol: "F", contracts: 1, contractId: "SC3", fees: 0 })
    ]));
    return security(result).shares;
  });

  test("11. Dividende — 15 $ brut moins 2,25 $ de retenue donne 12,75 $ net", 12.75, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "DIVIDEND", { symbol: "F", grossAmount: 15, taxWithheld: 2.25 })
    ]));
    return security(result).dividendsNet;
  });

  test("12. Dépôt de 3 000 $ et retrait de 500 $ — capital net de 2 500 $", 2500, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "DEPOSIT", { amount: 3000 }),
      tx("2", "2026-01-02", "WITHDRAWAL", { amount: 500 })
    ]));
    return result.account.netDeposits;
  });

  test("13. Intérêt sur marge de 10 $ — P/L réalisé diminué de 10 $", -10, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "MARGIN_INTEREST", { amount: 10 })
    ]));
    return result.account.realizedPL;
  });

  test("14. Garantie Ford de 30 % — valeur de 1 000 $ donne 300 $", 300, () => {
    const data = baseState([
      tx("1", "2026-01-01", "STOCK_BUY", { symbol: "F", quantity: 100, price: 10, fees: 0 })
    ], { prices: { F: { price: 10, updatedAt: "2026-01-02T12:00:00Z" } } });
    return security(Calc.calculatePortfolio(data)).guaranteeRequired;
  });

  test("15. Marge utilisée — liquidités de -100 $ donnent 100 $", 100, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "DEPOSIT", { amount: 100 }),
      tx("2", "2026-01-02", "STOCK_BUY", { symbol: "F", quantity: 20, price: 10, fees: 0 })
    ], { prices: { F: { price: 10, updatedAt: "2026-01-02T12:00:00Z" } } }));
    return result.account.marginUsed;
  });

  test("16. Marge disponible — équité 1 000 $ moins garantie 300 $ donne 700 $", 700, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "DEPOSIT", { amount: 1000 }),
      tx("2", "2026-01-02", "STOCK_BUY", { symbol: "F", quantity: 100, price: 10, fees: 0 })
    ], { prices: { F: { price: 10, updatedAt: "2026-01-02T12:00:00Z" } } }));
    return result.account.marginAvailable;
  });

  test("17. P/L réalisé des actions — vente de 50 actions avec profit de 2 $ donne 100 $", 100, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "STOCK_BUY", { symbol: "F", quantity: 100, price: 10, fees: 0 }),
      tx("2", "2026-01-02", "STOCK_SELL", { symbol: "F", quantity: 50, price: 12, fees: 0 })
    ]));
    return result.account.realizedPL;
  });

  test("18. P/L non réalisé — 100 actions achetées 10 $ et valant 12 $ donnent 200 $", 200, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "STOCK_BUY", { symbol: "F", quantity: 100, price: 10, fees: 0 })
    ], { prices: { F: { price: 12, updatedAt: "2026-01-02T12:00:00Z" } } }));
    return result.account.unrealizedPL;
  });

  test("19. P/L économique — 100 $ réalisé plus 100 $ latent donne 200 $", 200, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "STOCK_BUY", { symbol: "F", quantity: 100, price: 10, fees: 0 }),
      tx("2", "2026-01-02", "STOCK_SELL", { symbol: "F", quantity: 50, price: 12, fees: 0 })
    ], { prices: { F: { price: 12, updatedAt: "2026-01-02T12:00:00Z" } } }));
    return result.account.economicPL;
  });

  test("20. Valeur totale — 500 $ de liquidités plus 500 $ d’actions donne 1 000 $", 1000, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "DEPOSIT", { amount: 1000 }),
      tx("2", "2026-01-02", "STOCK_BUY", { symbol: "F", quantity: 50, price: 10, fees: 0 })
    ], { prices: { F: { price: 10, updatedAt: "2026-01-02T12:00:00Z" } } }));
    return result.account.totalValue;
  });

  test("21. Exportation JSON — la sauvegarde conserve les transactions", 1, () => {
    const payload = Backup.createPayload(baseState([tx("1", "2026-01-01", "DEPOSIT", { amount: 100 })]));
    return payload.transactions.length;
  });

  test("22. Restauration JSON — une sauvegarde compatible est acceptée", true, () => {
    const payload = Backup.createPayload(baseState([]));
    return Backup.validatePayload(payload).valid;
  });

  test("23. Détection de doublon — une transaction identique est refusée", false, () => {
    const existing = tx("1", "2026-01-01", "DEPOSIT", { amount: 100 });
    const data = baseState([existing]);
    return Forms.validateOperation(tx("2", "2026-01-01", "DEPOSIT", { amount: 100 }), data, Calc.calculatePortfolio(data)).valid;
  });

  test("24. Données manquantes — un achat sans symbole est refusé", false, () => {
    const data = baseState([]);
    return Forms.validateOperation(tx("1", "2026-01-01", "STOCK_BUY", { quantity: 1, price: 10, fees: 0 }), data, Calc.calculatePortfolio(data)).valid;
  });

  test("25. Affichage mobile — une règle responsive de 760 px ou moins existe", true, () => {
    if (isNode) {
      const fs = require("fs");
      const path = require("path");
      const css = fs.readFileSync(path.join(__dirname, "..", "css", "style.css"), "utf8");
      return /@media\s*\(max-width:\s*760px\)/.test(css) && /overflow-x:\s*auto/.test(css);
    }
    return [...document.styleSheets].some((sheet) => {
      try {
        return [...sheet.cssRules].some((rule) => String(rule.conditionText || "").includes("max-width: 760px"));
      } catch {
        return false;
      }
    });
  });

  test("26. Division par zéro — rendement sans dépôt égal à 0 %", 0, () => {
    return Calc.calculatePortfolio(baseState([])).account.returnPercent;
  });

  test("27. Consolidation — plusieurs opérations Ford produisent une seule fiche Ford", 1, () => {
    const result = Calc.calculatePortfolio(baseState([
      tx("1", "2026-01-01", "STOCK_BUY", { symbol: "F", quantity: 10, price: 10, fees: 0 }),
      tx("2", "2026-01-02", "DIVIDEND", { symbol: "F", grossAmount: 1, taxWithheld: 0 })
    ]));
    return result.securities.filter((item) => item.symbol === "F").length;
  });

  test("28. Aucune stratégie — les données de démonstration ne contiennent aucun champ stratégie", false, () => {
    return /"strategy"|"strategie"|"stratégie"/i.test(JSON.stringify(Storage.getDemoData()));
  });

  test("29. Assignation CALL invalide — refus si les actions sont insuffisantes", false, () => {
    const data = baseState([
      tx("1", "2026-01-01", "OPTION_SELL_OPEN", { symbol: "F", optionType: "CALL", strike: 10, expiration: "2026-02-20", contracts: 1, premium: 0.5, fees: 0, shortMarginRequirement: 0, contractId: "SC4" })
    ]);
    const result = Calc.calculatePortfolio(data);
    return Forms.validateOperation(tx("2", "2026-02-20", "OPTION_ASSIGNMENT", { symbol: "F", contracts: 1, contractId: "SC4", fees: 0 }), data, result).valid;
  });

  test("30. Fermeture invalide — un contrat inexistant est refusé", false, () => {
    const data = baseState([]);
    return Forms.validateOperation(tx("1", "2026-01-01", "OPTION_BUY_CLOSE", { symbol: "F", contracts: 1, premium: 0.1, contractId: "ABSENT", fees: 0 }), data, Calc.calculatePortfolio(data)).valid;
  });

  test("31. Sauvegarde incompatible — une version 2.0 est refusée", false, () => {
    const data = baseState([]);
    data.version = "2.0.0";
    return Storage.validateData(data).valid;
  });

  test("32. Démonstration — la valeur totale attendue est 3 172,75 $", 3172.75, () => {
    return Calc.calculatePortfolio(Storage.getDemoData()).account.totalValue;
  });

  test("33. Démonstration — le P/L économique attendu est 172,75 $", 172.75, () => {
    return Calc.calculatePortfolio(Storage.getDemoData()).account.economicPL;
  });

  test("34. Démonstration — la garantie totale attendue est 793,50 $", 793.5, () => {
    return Calc.calculatePortfolio(Storage.getDemoData()).account.guaranteeRequired;
  });

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  if (isNode) {
    for (const result of results) {
      const marker = result.passed ? "OK" : "ECHEC";
      console.log(`${marker} | ${result.name} | attendu=${result.expected} | obtenu=${result.actual}${result.error ? ` | ${result.error}` : ""}`);
    }
    console.log(`RESULTAT_FINAL=${passed}/${results.length}`);
    if (failed) process.exitCode = 1;
  } else {
    const summary = document.getElementById("testSummary");
    const body = document.getElementById("testResults");
    summary.className = failed ? "summary failed" : "summary passed";
    summary.textContent = failed
      ? `${passed}/${results.length} tests réussis — ${failed} échec(s)`
      : `${passed}/${results.length} tests réussis`;
    body.innerHTML = results.map((result) => `
      <tr class="${result.passed ? "passed" : "failed"}">
        <td>${result.passed ? "RÉUSSI" : "ÉCHEC"}</td>
        <td>${result.name}</td>
        <td>${String(result.expected)}</td>
        <td>${String(result.actual)}</td>
      </tr>`).join("");
    globalScope.__PORTAL_TEST_RESULTS__ = { passed, failed, total: results.length, results };
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
