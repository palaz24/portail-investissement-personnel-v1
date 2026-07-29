(async function runV12Tests(globalScope) {
  "use strict";

  const isNode = typeof module !== "undefined" && module.exports;
  const Collateral = isNode ? require("../js/collateral.js") : globalScope.PortalCollateral;
  const Calc = isNode ? require("../js/calculations.js") : globalScope.PortalCalculations;
  const Storage = isNode ? require("../js/storage.js") : globalScope.PortalStorage;
  const Forms = isNode ? require("../js/forms.js") : globalScope.PortalForms;
  const Corrections = isNode ? require("../js/transaction-corrections.js") : globalScope.PortalTransactionCorrections;
  const Backup = isNode ? require("../js/backup.js") : globalScope.PortalBackup;

  if (!isNode) {
    for (let attempt = 0; attempt < 100 && !globalScope.__PORTAL_V111_TEST_RESULTS__; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  const results = [];
  const stamp = (day) => `2026-01-${String(day).padStart(2, "0")}T09:00:00.000Z`;
  const security = (marginRequirement = 0.30) => ({
    id: "SEC-F",
    symbol: "F",
    name: "Ford",
    type: "ACTION",
    currency: "USD",
    marginEligible: true,
    marginRequirement,
    active: true
  });
  const state = (transactions = [], marginRequirement = 0.30, price = 14) => ({
    version: "1.2.0",
    demoMode: false,
    accountSettings: {
      accountName: "Test",
      baseCurrency: "USD",
      marginInterestRate: 8,
      stockCommission: 0,
      optionCommission: 0,
      assignmentFee: 0
    },
    securities: [security(marginRequirement)],
    transactions,
    prices: { F: { price, updatedAt: stamp(29), source: "Test" } },
    optionPrices: {},
    positionsInitiales: [],
    history: []
  });
  const soldPut = (overrides = {}) => ({
    id: "PUT-OPEN",
    createdAt: stamp(1),
    date: "2026-01-01",
    symbol: "F",
    type: "OPTION_SELL_OPEN",
    optionType: "PUT",
    strike: 14,
    expiration: "2026-12-18",
    contracts: 1,
    premium: 0.30,
    fees: 0,
    putCollateralMode: Collateral.MARGIN_PARTIAL,
    actualMarginRequirement: null,
    marginRequirementCheckedAt: null,
    shortMarginRequirement: 0,
    contractId: "F-PUT-14",
    note: "",
    ...overrides
  });
  const event = (type, contracts = 1, overrides = {}) => ({
    id: `${type}-${contracts}`,
    createdAt: stamp(10),
    date: "2026-02-10",
    symbol: "F",
    type,
    contracts,
    fees: 0,
    contractId: "F-PUT-14",
    note: "",
    ...overrides
  });
  const stockBuy = () => ({
    id: "STOCK",
    createdAt: stamp(1),
    date: "2026-01-01",
    symbol: "F",
    type: "STOCK_BUY",
    quantity: 100,
    price: 14,
    fees: 0,
    note: ""
  });

  function equal(actual, expected) {
    return typeof expected === "number"
      ? Math.abs(Number(actual) - expected) <= 1e-9
      : JSON.stringify(actual) === JSON.stringify(expected);
  }
  function test(name, expected, callback) {
    try {
      const actual = callback();
      results.push({ name, expected, actual, passed: equal(actual, expected) });
    } catch (error) {
      results.push({ name, expected, actual: `ERREUR: ${error.message}`, passed: false });
    }
  }
  function guarantee(transactions, key = "guaranteeRequired", margin = 0.30, price = 14) {
    return Calc.calculatePortfolio(state(transactions, margin, price)).account[key];
  }

  test("81. Choix obligatoire pour un put vendu", false, () => {
    const input = soldPut({ putCollateralMode: "" });
    return Forms.validateOperation(input, state([]), Calc.calculatePortfolio(state([]))).valid;
  });
  test("82. Aucun choix de garantie de put exigé pour un call", true, () => {
    const input = { ...soldPut(), optionType: "CALL", contractId: "F-CALL", putCollateralMode: undefined, shortMarginRequirement: 100 };
    return Forms.validateOperation(input, state([]), Calc.calculatePortfolio(state([]))).valid;
  });
  test("83. Put garanti à 100 % Ford strike 14", 1400, () =>
    guarantee([soldPut({ putCollateralMode: Collateral.FULLY_SECURED })], "fullySecuredPutGuarantee"));
  test("84. Put sur marge Ford strike 14 à 30 %", 420, () =>
    guarantee([soldPut()], "marginPutGuarantee"));
  test("85. Deux contrats sur marge", 840, () =>
    guarantee([soldPut({ contracts: 2 })], "marginPutGuarantee"));
  test("86. Garantie réelle remplace l’estimation", 435, () =>
    guarantee([soldPut({ actualMarginRequirement: 435, marginRequirementCheckedAt: "2026-07-29" })], "marginPutGuarantee"));
  test("87. Estimation utilisée sans garantie réelle", "ESTIMATED", () =>
    Calc.calculatePortfolio(state([soldPut()])).openOptions[0].collateralSource);
  test("88. Modification de FULLY_SECURED vers MARGIN_PARTIAL", 420, () => {
    const before = state([soldPut({ putCollateralMode: Collateral.FULLY_SECURED })]);
    const candidate = soldPut({ putCollateralMode: Collateral.MARGIN_PARTIAL });
    return Corrections.prepareEdit(before, "PUT-OPEN", candidate).derived.account.marginPutGuarantee;
  });
  test("89. Modification de MARGIN_PARTIAL vers FULLY_SECURED", 1400, () => {
    const before = state([soldPut()]);
    const candidate = soldPut({ putCollateralMode: Collateral.FULLY_SECURED });
    return Corrections.prepareEdit(before, "PUT-OPEN", candidate).derived.account.fullySecuredPutGuarantee;
  });
  test("90. Modification du strike recalcule la garantie", 450, () =>
    guarantee([soldPut({ strike: 15 })], "marginPutGuarantee"));
  test("91. Modification du nombre de contrats recalcule la garantie", 840, () =>
    guarantee([soldPut({ contracts: 2 })], "marginPutGuarantee"));
  test("92. Modification du taux Ford recalcule l’estimation", 560, () =>
    guarantee([soldPut()], "marginPutGuarantee", 0.40));
  test("93. Fermeture complète libère toute la garantie", 0, () =>
    guarantee([soldPut(), event("OPTION_BUY_CLOSE", 1, { premium: 0.10 })], "marginPutGuarantee"));
  test("94. Fermeture partielle libère seulement une portion", 420, () =>
    guarantee([soldPut({ contracts: 2 }), event("OPTION_BUY_CLOSE", 1, { premium: 0.10 })], "marginPutGuarantee"));
  test("95. Expiration libère la garantie", 0, () =>
    guarantee([soldPut(), event("OPTION_EXPIRY")], "marginPutGuarantee"));
  test("96. Assignation retire la garantie du put", 0, () =>
    guarantee([soldPut(), event("OPTION_ASSIGNMENT")], "marginPutGuarantee"));
  test("97. Assignation ajoute la garantie des actions", 420, () =>
    guarantee([soldPut(), event("OPTION_ASSIGNMENT")], "stockGuarantee"));
  test("98. Aucune double comptabilisation après assignation", 420, () =>
    guarantee([soldPut(), event("OPTION_ASSIGNMENT")]));
  test("99. Suppression d’un put libère sa garantie", 0, () =>
    Corrections.prepareDelete(state([soldPut()]), "PUT-OPEN").derived.account.guaranteeRequired);
  test("100. Annulation d’une suppression restaure la garantie", 420, () => {
    const previous = state([soldPut()]);
    const deleted = Corrections.prepareDelete(previous, "PUT-OPEN").value;
    let undo = null;
    Corrections.persistWithRollback(previous, deleted, {
      writeUndo: (value) => { undo = value; },
      readUndo: () => null,
      clearUndo: () => {},
      save: (value) => value
    });
    return Calc.calculatePortfolio(undo).account.guaranteeRequired;
  });
  test("101. Sauvegarde JSON conserve le mode", Collateral.FULLY_SECURED, () =>
    Backup.createPayload(state([soldPut({ putCollateralMode: Collateral.FULLY_SECURED })])).transactions[0].putCollateralMode);
  test("102. Restauration JSON conserve le mode", Collateral.MARGIN_PARTIAL, () => {
    const payload = Backup.createPayload(state([soldPut()]));
    return Backup.validatePayload(payload).value.transactions[0].putCollateralMode;
  });
  test("103. Migration d’un ancien shortMarginRequirement", [Collateral.MARGIN_PARTIAL, 435], () => {
    const legacy = soldPut({ putCollateralMode: undefined, actualMarginRequirement: undefined, shortMarginRequirement: 435 });
    const migrated = Storage.migrateData(state([legacy])).state.transactions[0];
    return [migrated.putCollateralMode, migrated.actualMarginRequirement];
  });
  test("104. Ancien put sans mode marqué REVIEW_REQUIRED", Collateral.REVIEW_REQUIRED, () => {
    const legacy = soldPut({ putCollateralMode: undefined, actualMarginRequirement: undefined, shortMarginRequirement: 0 });
    return Storage.migrateData(state([legacy])).state.transactions[0].putCollateralMode;
  });
  test("105. Garantie totale exacte", 2220, () => {
    const full = soldPut({ id: "FULL", contractId: "FULL", strike: 10, putCollateralMode: Collateral.FULLY_SECURED });
    const margin = soldPut({ id: "MARGIN", contractId: "MARGIN", strike: 20 });
    const call = { ...soldPut({ id: "CALL", contractId: "CALL" }), optionType: "CALL", putCollateralMode: undefined, shortMarginRequirement: 200 };
    return guarantee([stockBuy(), full, margin, call]);
  });

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  if (isNode) {
    for (const result of results) {
      console.log(`${result.passed ? "OK" : "ECHEC"} | ${result.name} | attendu=${JSON.stringify(result.expected)} | obtenu=${JSON.stringify(result.actual)}`);
    }
    console.log(`RESULTAT_V1_2=${passed}/${results.length}`);
    if (failed) process.exitCode = 1;
  } else {
    const previous = [
      globalScope.__PORTAL_TEST_RESULTS__,
      globalScope.__PORTAL_V11_TEST_RESULTS__,
      globalScope.__PORTAL_V111_TEST_RESULTS__
    ].filter(Boolean);
    const summary = document.getElementById("testSummary");
    const body = document.getElementById("testResults");
    const oldPassed = previous.reduce((sum, group) => sum + group.passed, 0);
    const oldFailed = previous.reduce((sum, group) => sum + group.failed, 0);
    const oldTotal = previous.reduce((sum, group) => sum + group.total, 0);
    const totalPassed = oldPassed + passed;
    const totalFailed = oldFailed + failed;
    const total = oldTotal + results.length;
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
    globalScope.__PORTAL_V12_TEST_RESULTS__ = { passed, failed, total: results.length, results };
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
