(async function runV111Tests(globalScope) {
  "use strict";

  const isNode = typeof module !== "undefined" && module.exports;
  const Forms = isNode ? require("../js/forms.js") : globalScope.PortalForms;
  const Calc = isNode ? require("../js/calculations.js") : globalScope.PortalCalculations;
  const Corrections = isNode ? require("../js/transaction-corrections.js") : globalScope.PortalTransactionCorrections;
  const History = isNode ? require("../js/history-utils.js") : globalScope.PortalHistory;
  let appSource = "";
  let indexSource = "";
  let cssSource = "";
  if (isNode) {
    const fs = require("fs");
    const path = require("path");
    appSource = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
    indexSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
    cssSource = fs.readFileSync(path.join(__dirname, "../css/style.css"), "utf8");
  } else {
    [appSource, indexSource, cssSource] = await Promise.all([
      fetch("../js/app.js?v=1.3.0-20260730b").then((response) => response.text()),
      fetch("../index.html?v=1.3.0-20260730b").then((response) => response.text()),
      fetch("../css/style.css?v=1.3.0-20260730b").then((response) => response.text())
    ]);
  }

  const results = [];
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

  const security = (symbol = "F") => ({
    id: `SEC-${symbol}`,
    symbol,
    name: symbol,
    type: symbol === "SPY" ? "FNB" : "ACTION",
    currency: "USD",
    marginEligible: true,
    marginRequirement: 0.3,
    active: true
  });
  const baseState = (transactions = [], additions = {}) => ({
    version: "1.1.1",
    demoMode: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    accountSettings: { accountName: "Test", baseCurrency: "USD", marginInterestRate: 8, stockCommission: 0, optionCommission: 0, assignmentFee: 0 },
    securities: [security("F"), security("SPY")],
    transactions,
    prices: { F: { price: 15 }, SPY: { price: 600 } },
    optionPrices: {},
    positionsInitiales: [],
    history: [],
    ...additions
  });
  const stamp = (day, hour = "09:00:00") => `2026-01-${String(day).padStart(2, "0")}T${hour}Z`;
  const deposit = (id, day, amount) => ({ id, date: `2026-01-${String(day).padStart(2, "0")}`, createdAt: stamp(day), type: "DEPOSIT", amount, note: "" });
  const buy = (id, day, quantity, price) => ({ id, date: `2026-01-${String(day).padStart(2, "0")}`, createdAt: stamp(day), symbol: "F", type: "STOCK_BUY", quantity, price, fees: 0, note: "" });
  const sell = (id, day, quantity, price) => ({ id, date: `2026-01-${String(day).padStart(2, "0")}`, createdAt: stamp(day), symbol: "F", type: "STOCK_SELL", quantity, price, fees: 0, note: "" });
  const dividend = (id, day, grossAmount, taxWithheld) => ({ id, date: `2026-01-${String(day).padStart(2, "0")}`, createdAt: stamp(day), symbol: "F", type: "DIVIDEND", grossAmount, taxWithheld, note: "" });
  const openCall = (id = "OPEN", contractId = "F-OLD") => ({ id, date: "2026-01-02", createdAt: stamp(2), symbol: "F", type: "OPTION_SELL_OPEN", optionType: "CALL", strike: 20, expiration: "2026-06-19", contracts: 1, premium: 1, fees: 0, shortMarginRequirement: 100, contractId, note: "" });
  const closeCall = (id = "CLOSE", contractId = "F-OLD") => ({ id, date: "2026-02-02", createdAt: "2026-02-02T09:00:00Z", symbol: "F", type: "OPTION_BUY_CLOSE", contracts: 1, premium: 0.5, fees: 0, contractId, note: "" });

  test("56. Modification d’un dépôt", 1500, () => {
    const tx = deposit("DEP", 1, 1000);
    const result = Corrections.prepareEdit(baseState([tx]), "DEP", { ...tx, amount: 1500 }, { updatedAt: stamp(5) });
    return result.value.transactions[0].amount;
  });
  test("57. Modification d’un achat d’actions", 120, () => {
    const tx = buy("BUY", 2, 100, 10);
    return Corrections.prepareEdit(baseState([deposit("DEP", 1, 5000), tx]), "BUY", { ...tx, quantity: 120 }, { updatedAt: stamp(5) }).derived.securities.find((item) => item.symbol === "F").shares;
  });
  test("58. Modification d’une vente d’actions", 60, () => {
    const sale = sell("SELL", 3, 50, 15);
    const result = Corrections.prepareEdit(baseState([buy("BUY", 2, 100, 10), sale]), "SELL", { ...sale, quantity: 40 }, { updatedAt: stamp(5) });
    return result.derived.securities.find((item) => item.symbol === "F").shares;
  });
  test("59. Correction du coût moyen après modification", 20, () => {
    const first = buy("BUY-1", 2, 100, 10);
    const result = Corrections.prepareEdit(baseState([first, buy("BUY-2", 3, 100, 20)]), "BUY-1", { ...first, price: 20 }, { updatedAt: stamp(5) });
    return result.derived.securities.find((item) => item.symbol === "F").averageCost;
  });
  test("60. Modification d’un dividende", 17, () => {
    const tx = dividend("DIV", 3, 15, 2);
    const result = Corrections.prepareEdit(baseState([tx]), "DIV", { ...tx, grossAmount: 20, taxWithheld: 3 }, { updatedAt: stamp(5) });
    return result.derived.account.dividendsNet;
  });
  test("61. Modification d’une prime d’option", 150, () => {
    const opening = openCall();
    const result = Corrections.prepareEdit(baseState([opening]), "OPEN", { ...opening, premium: 1.5 }, { updatedAt: stamp(5) });
    return result.derived.account.premiumsReceived;
  });
  test("62. Modification d’une échéance détecte les liens", true, () => {
    const opening = openCall();
    return Corrections.prepareEdit(baseState([opening, closeCall()]), "OPEN", { ...opening, expiration: "2026-07-17", contractId: "F-NEW" }).requiresConfirmation;
  });
  test("63. Modification d’un strike", 22, () => {
    const opening = openCall();
    const result = Corrections.prepareEdit(baseState([opening]), "OPEN", { ...opening, strike: 22, contractId: "F-NEW" });
    return result.value.transactions.find((item) => item.id === "OPEN").strike;
  });
  test("64. Mise à jour en cascade du contractId", "F-NEW", () => {
    const opening = openCall();
    const result = Corrections.prepareEdit(baseState([opening, closeCall()]), "OPEN", { ...opening, strike: 22, contractId: "F-NEW" }, { allowCascade: true });
    return result.value.transactions.find((item) => item.id === "CLOSE").contractId;
  });
  test("65. Transfert du prix automatique vers le nouveau contractId", [1.25, false], () => {
    const opening = openCall();
    const state = baseState([opening], { optionPrices: { "F-OLD": { price: 1.25, source: "Market Data" } } });
    const result = Corrections.prepareEdit(state, "OPEN", { ...opening, strike: 22, contractId: "F-NEW" });
    return [result.value.optionPrices["F-NEW"].price, Object.hasOwn(result.value.optionPrices, "F-OLD")];
  });
  test("66. Suppression d’un dépôt", 0, () => Corrections.prepareDelete(baseState([deposit("DEP", 1, 1000)]), "DEP").value.transactions.length);
  test("67. Suppression d’un achat d’actions", 0, () => Corrections.prepareDelete(baseState([buy("BUY", 2, 100, 10)]), "BUY").derived.securities.find((item) => item.symbol === "F").shares);
  test("68. Refus d’une suppression causant une vente impossible", false, () => Corrections.prepareDelete(baseState([buy("BUY", 2, 100, 10), sell("SELL", 3, 100, 15)]), "BUY").valid);
  test("69. Suppression d’une fermeture d’option", 1, () => Corrections.prepareDelete(baseState([openCall(), closeCall()]), "CLOSE").value.transactions.length);
  test("70. Réouverture du contrat après suppression de la fermeture", 1, () => Corrections.prepareDelete(baseState([openCall(), closeCall()]), "CLOSE").derived.openOptions[0].contractsOpen);
  test("71. Suppression groupée d’une option et de ses dépendances", 0, () => Corrections.prepareDelete(baseState([openCall(), closeCall()]), "OPEN", { allowCascade: true }).value.transactions.length);
  test("72. Absence de contrat orphelin", true, () => {
    const opening = openCall();
    const result = Corrections.prepareEdit(baseState([opening, closeCall()]), "OPEN", { ...opening, strike: 22, contractId: "F-NEW" }, { allowCascade: true });
    return Corrections.validateStateIntegrity(result.value).valid;
  });
  test("73. Doublon ignoré pour la transaction modifiée elle-même", true, () => {
    const tx = buy("BUY", 2, 100, 10);
    return Forms.validateOperation({ ...tx }, baseState([tx]), Calc.calculatePortfolio(baseState([])), "BUY").valid;
  });
  test("74. Véritable doublon toujours refusé", false, () => {
    const tx = buy("BUY", 2, 100, 10);
    return Forms.validateOperation({ ...tx, id: "BUY-2" }, baseState([tx]), Calc.calculatePortfolio(baseState([tx]))).valid;
  });
  test("75. Annulation d’une modification restaure la valeur précédente", 1000, () => {
    const previous = baseState([deposit("DEP", 1, 1000)]);
    const edited = Corrections.prepareEdit(previous, "DEP", { ...previous.transactions[0], amount: 1500 }).value;
    let undo = null;
    Corrections.persistWithRollback(previous, edited, { readUndo: () => null, writeUndo: (value) => { undo = value; }, clearUndo: () => { undo = null; }, save: (value) => value });
    return undo.transactions[0].amount;
  });
  test("76. Annulation d’une suppression restaure la transaction", "DEP", () => {
    const previous = baseState([deposit("DEP", 1, 1000)]);
    const deleted = Corrections.prepareDelete(previous, "DEP").value;
    let undo = null;
    Corrections.persistWithRollback(previous, deleted, { readUndo: () => null, writeUndo: (value) => { undo = value; }, clearUndo: () => { undo = null; }, save: (value) => value });
    return undo.transactions[0].id;
  });
  test("77. Restauration après erreur de sauvegarde", [1000, 900], () => {
    const previous = baseState([deposit("DEP", 1, 1000)]);
    const edited = { ...previous, transactions: [{ ...previous.transactions[0], amount: 1500 }] };
    let undo = baseState([deposit("OLD-UNDO", 1, 900)]);
    const result = Corrections.persistWithRollback(previous, edited, { readUndo: () => undo, writeUndo: (value) => { undo = value; }, clearUndo: () => { undo = null; }, save: () => { throw new Error("échec simulé"); } });
    return [result.state.transactions[0].amount, undo.transactions[0].amount];
  });
  test("78. Tri récent en premier après modification", ["B", "A"], () => {
    const a = deposit("A", 1, 100);
    const b = deposit("B", 2, 200);
    const edited = Corrections.prepareEdit(baseState([a, b]), "A", { ...a, amount: 150 }, { updatedAt: stamp(5) }).value;
    return History.sortHistoricalDescending(edited.transactions).map((item) => item.id);
  });
  test("79. Boutons utilisables sur mobile", true, () => /\.transaction-actions[\s\S]*min-height:\s*42px/.test(cssSource) && /@media \(max-width:\s*760px\)/.test(cssSource));
  test("80. Navigation clavier par boutons natifs et libellés accessibles", true, () => /<button[^>]+data-edit-transaction/.test(appSource) && /<button[^>]+data-delete-transaction/.test(appSource) && /aria-label=/.test(appSource) && /id="undoTransactionChange"[^>]+type="button"/.test(indexSource));

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  if (isNode) {
    for (const result of results) {
      console.log(`${result.passed ? "OK" : "ECHEC"} | ${result.name} | attendu=${JSON.stringify(result.expected)} | obtenu=${JSON.stringify(result.actual)}`);
    }
    console.log(`RESULTAT_V1_1_1=${passed}/${results.length}`);
    if (failed) process.exitCode = 1;
  } else {
    const existing = globalScope.__PORTAL_TEST_RESULTS__ || { passed: 0, failed: 0, total: 0, results: [] };
    const v11 = globalScope.__PORTAL_V11_TEST_RESULTS__ || { passed: 0, failed: 0, total: 0, results: [] };
    const summary = document.getElementById("testSummary");
    const body = document.getElementById("testResults");
    const totalPassed = existing.passed + v11.passed + passed;
    const totalFailed = existing.failed + v11.failed + failed;
    const total = existing.total + v11.total + results.length;
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
    globalScope.__PORTAL_V111_TEST_RESULTS__ = { passed, failed, total: results.length, results };
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
