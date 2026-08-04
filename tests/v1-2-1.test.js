(async function runPortalV121Tests(globalScope) {
  "use strict";

  const isNode = typeof module !== "undefined" && module.exports;

  if (!isNode) {
    while (!globalScope.__PORTAL_V12_TEST_RESULTS__) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  const Collateral = isNode ? require("../js/collateral.js") : globalScope.PortalCollateral;
  const Calc = isNode ? require("../js/calculations.js") : globalScope.PortalCalculations;
  const Forms = isNode ? require("../js/forms.js") : globalScope.PortalForms;
  const Storage = isNode ? require("../js/storage.js") : globalScope.PortalStorage;
  const Backup = isNode ? require("../js/backup.js") : globalScope.PortalBackup;
  const Corrections = isNode
    ? require("../js/transaction-corrections.js")
    : globalScope.PortalTransactionCorrections;

  let appSource = "";
  let cssSource = "";
  let htmlSource = "";

  if (isNode) {
    const fs = require("node:fs");
    const path = require("node:path");
    appSource = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
    cssSource = fs.readFileSync(path.join(__dirname, "../css/style.css"), "utf8");
    htmlSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  } else {
    [appSource, cssSource, htmlSource] = await Promise.all([
      fetch(`../js/app.js?test=${Date.now()}`).then((response) => response.text()),
      fetch(`../css/style.css?test=${Date.now()}`).then((response) => response.text()),
      fetch(`../index.html?test=${Date.now()}`).then((response) => response.text()),
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
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    assert(actualJson === expectedJson, `${message} (${actualJson} !== ${expectedJson})`);
  }

  function baseState(transactions = []) {
    return {
      version: "1.2.1",
      demoMode: false,
      accountSettings: {
        accountName: "Test",
        baseCurrency: "USD",
        marginInterestRate: 0,
        stockCommission: 0,
        optionCommission: 0,
        assignmentFee: 0,
      },
      securities: [
        {
          id: "SEC-F",
          symbol: "F",
          name: "Ford",
          type: "ACTION",
          currency: "USD",
          marginEligible: true,
          marginRequirement: 0.3,
          active: true,
        },
        {
          id: "SEC-SPY",
          symbol: "SPY",
          name: "SPY",
          type: "FNB",
          currency: "USD",
          marginEligible: true,
          marginRequirement: 0.3,
          active: true,
        },
      ],
      transactions,
      positionsInitiales: [],
      prices: {
        F: { price: 14, updatedAt: "2026-07-29T09:00:00.000Z", source: "Test" },
        SPY: { price: 600, updatedAt: "2026-07-29T09:00:00.000Z", source: "Test" },
      },
      optionPrices: {},
      history: [],
    };
  }

  function longPut(overrides = {}) {
    return {
      id: "LONG-F-12",
      createdAt: "2026-01-02T09:00:00.000Z",
      date: "2026-01-02",
      type: "OPTION_BUY_OPEN",
      symbol: "F",
      optionType: "PUT",
      strike: 12,
      expiration: "2026-12-18",
      contracts: 2,
      premium: 0.15,
      fees: 0,
      contractId: "LONG-F-12",
      note: "",
      ...overrides,
    };
  }

  function shortPut(overrides = {}) {
    return {
      id: "SHORT-F-14",
      createdAt: "2026-01-03T09:00:00.000Z",
      date: "2026-01-03",
      type: "OPTION_SELL_OPEN",
      symbol: "F",
      optionType: "PUT",
      strike: 14,
      expiration: "2026-06-19",
      contracts: 1,
      premium: 0.4,
      fees: 0,
      contractId: "SHORT-F-14",
      putCollateralMode: Collateral.COVERED_BY_LONG_PUT,
      coveringContractId: "LONG-F-12",
      coveredContracts: 1,
      coverageType: "DIAGONAL",
      actualMarginRequirement: null,
      marginRequirementCheckedAt: "",
      ...overrides,
    };
  }

  function optionRows() {
    return [
      { contractId: "Z", expiration: "2026-10-16", optionType: "CALL", strike: 15 },
      { contractId: "B", expiration: "2026-08-21", optionType: "CALL", strike: 14 },
      { contractId: "A", expiration: "2026-08-21", optionType: "PUT", strike: 14 },
      { contractId: "C", expiration: "2026-08-21", optionType: "PUT", strike: 13 },
      { contractId: "OLD", expiration: "2026-01-16", optionType: "PUT", strike: 12 },
      { contractId: "OLDER", expiration: "2025-12-19", optionType: "PUT", strike: 12 },
    ];
  }

  test(106, "les échéances futures sont classées en ordre croissant", () => {
    const sorted = Calc.sortOpenOptionsByExpiration(optionRows(), "2026-07-29");
    equal(
      sorted.slice(0, 4).map((item) => item.expiration),
      ["2026-08-21", "2026-08-21", "2026-08-21", "2026-10-16"],
      "Ordre des échéances futures invalide",
    );
  });

  test(107, "les égalités suivent PUT, CALL, strike et identifiant", () => {
    const sorted = Calc.sortOpenOptionsByExpiration(optionRows(), "2026-07-29");
    equal(
      sorted.slice(0, 3).map((item) => item.contractId),
      ["C", "A", "B"],
      "Ordre secondaire invalide",
    );
  });

  test(108, "les options échues suivent les futures, de la plus récente à la plus ancienne", () => {
    const sorted = Calc.sortOpenOptionsByExpiration(optionRows(), "2026-07-29");
    equal(
      sorted.slice(-2).map((item) => item.contractId),
      ["OLD", "OLDER"],
      "Ordre des options échues invalide",
    );
  });

  test(109, "le tri ne modifie jamais la liste originale", () => {
    const options = optionRows();
    const snapshot = JSON.stringify(options);
    Calc.sortOpenOptionsByExpiration(options, "2026-07-29");
    assert(JSON.stringify(options) === snapshot, "La liste originale a été modifiée");
  });

  test(110, "le même tri est utilisé dans les listes complètes et les prix", () => {
    const occurrences = (appSource.match(/Calc\.sortOpenOptionsByExpiration/g) || []).length;
    assert(occurrences >= 3, "Le tri commun n'est pas réutilisé partout");
  });

  test(111, "une note courte demeure affichée directement", () => {
    assert(
      appSource.includes('function renderTransactionNote(note, transactionId)') &&
        appSource.includes('<div class="transaction-note">'),
      "Le rendu direct des notes courtes manque",
    );
  });

  test(112, "une note longue est limitée à deux lignes sur ordinateur", () => {
    assert(cssSource.includes("-webkit-line-clamp: 2"), "La limite de deux lignes manque");
    assert(/max-width:\s*(2[4-9]\d|300)px/.test(cssSource), "La largeur maximale attendue manque");
  });

  test(113, "une note longue propose une commande pour voir le texte complet", () => {
    assert(appSource.includes("data-view-note"), "Le bouton de consultation manque");
    assert(appSource.includes("Voir la note"), "Le libellé ordinateur manque");
  });

  test(114, "le texte complet de la note est échappé avant son affichage", () => {
    assert(
      /\$\("#noteModalContent"\)\.innerHTML\s*=\s*escapeHtml\(transaction\.note\)/.test(appSource),
      "Le texte complet n'est pas protégé",
    );
  });

  test(115, "la fenêtre de note se ferme avec Échap", () => {
    assert(
      appSource.includes('event.key !== "Escape"') &&
        appSource.includes('const open = $$(".modal-backdrop")') &&
        appSource.includes("closeModal(open.id)"),
      "La fermeture avec Échap manque",
    );
  });

  test(116, "le rendu mobile tient sur une ligne sans débordement horizontal", () => {
    assert(
      cssSource.includes("text-overflow: ellipsis") && cssSource.includes("white-space: nowrap"),
      "La limite mobile d'une ligne manque",
    );
    assert(cssSource.includes("overflow-wrap: anywhere"), "La protection contre le débordement manque");
  });

  test(117, "le troisième mode de garantie est offert pour un put vendu", () => {
    assert(htmlSource.includes('value="COVERED_BY_LONG_PUT"'), "Le troisième mode manque");
    assert(appSource.includes('const soldPut = type === "OPTION_SELL_OPEN"'), "La condition réservée aux puts vendus manque");
  });

  test(118, "un put couvert exige un véritable put long sélectionné", () => {
    const candidate = shortPut({ coveringContractId: "" });
    const state = baseState([longPut()]);
    const validation = Forms.validateOperation(candidate, state, Calc.calculatePortfolio(state));
    assert(!validation.valid, "Une couverture sans put long a été acceptée");
  });

  test(119, "un put long d'un autre sous-jacent est refusé", () => {
    const covering = longPut({ id: "LONG-SPY", symbol: "SPY" });
    const state = baseState([covering]);
    const validation = Forms.validateOperation(
      shortPut({ coveringContractId: "LONG-SPY" }),
      state,
      Calc.calculatePortfolio(state),
    );
    assert(!validation.valid, "Un sous-jacent différent a été accepté");
  });

  test(120, "un call long ne peut pas couvrir un put vendu", () => {
    const covering = longPut({ id: "LONG-CALL", optionType: "CALL" });
    const state = baseState([covering]);
    const validation = Forms.validateOperation(
      shortPut({ coveringContractId: "LONG-CALL" }),
      state,
      Calc.calculatePortfolio(state),
    );
    assert(!validation.valid, "Un call long a été accepté");
  });

  test(121, "une échéance longue antérieure à l'échéance courte est refusée", () => {
    const covering = longPut({ expiration: "2026-05-15" });
    const state = baseState([covering]);
    const validation = Forms.validateOperation(shortPut(), state, Calc.calculatePortfolio(state));
    assert(!validation.valid, "Une échéance de couverture trop courte a été acceptée");
  });

  test(122, "un put long déjà entièrement alloué ne peut pas être réutilisé", () => {
    const state = baseState([longPut({ contracts: 1 }), shortPut()]);
    const validation = Forms.validateOperation(
      shortPut({ id: "SHORT-2", date: "2026-01-04" }),
      state,
      Calc.calculatePortfolio(state),
    );
    assert(!validation.valid, "Une double allocation a été acceptée");
    assert(
      validation.errors.some((error) => error.includes("disponible")),
      "Le message n'explique pas la quantité disponible",
    );
  });

  test(123, "une même échéance est reconnue comme un vertical", () => {
    assert(
      Collateral.identifyCoverageType(
        shortPut({ expiration: "2026-12-18" }),
        longPut({ expiration: "2026-12-18" }),
      ) === "VERTICAL",
      "Le vertical n'est pas reconnu",
    );
  });

  test(124, "des strikes égaux et des échéances différentes forment un calendrier", () => {
    assert(
      Collateral.identifyCoverageType(shortPut({ strike: 12 }), longPut({ strike: 12 })) ===
        "CALENDAR",
      "Le calendrier n'est pas reconnu",
    );
  });

  test(125, "des strikes et échéances différents forment un diagonal", () => {
    assert(
      Collateral.identifyCoverageType(shortPut(), longPut()) === "DIAGONAL",
      "Le diagonal n'est pas reconnu",
    );
  });

  test(126, "la garantie d'un vertical correspond exactement au risque défini", () => {
    const result = Collateral.calculateCoveredPutCollateral(
      shortPut({ strike: 14, expiration: "2026-12-18", premium: 0.4 }),
      longPut({ strike: 12, expiration: "2026-12-18", premium: 0.15 }),
      1,
    );
    assert(result.amount === 175, `Garantie verticale incorrecte: ${result.amount}`);
    assert(
      appSource.includes('expiration: $("#optionExpiration").value'),
      "L’aperçu du formulaire ne transmet pas l’échéance au calcul",
    );
  });

  test(127, "la garantie Wealthsimple réelle a priorité lorsqu'elle est fournie", () => {
    const result = Collateral.calculateCoveredPutCollateral(
      shortPut({ actualMarginRequirement: 160, marginRequirementCheckedAt: "2026-01-03" }),
      longPut(),
      1,
    );
    assert(
      result.amount === 160 && result.source === "ACTUAL_WEALTHSIMPLE",
      "La garantie réelle n'a pas priorité",
    );
  });

  test(128, "un calendrier sans garantie réelle et sans risque positif exige une révision", () => {
    const result = Collateral.calculateCoveredPutCollateral(
      shortPut({ strike: 12 }),
      longPut({ strike: 12 }),
      1,
    );
    assert(result.source === "REVIEW_REQUIRED", "La révision obligatoire n'est pas signalée");
  });

  test(129, "une fermeture partielle libère la même quantité de couverture", () => {
    const state = baseState([
      longPut(),
      shortPut({ contracts: 2, coveredContracts: 2 }),
      {
        id: "CLOSE-1",
        createdAt: "2026-02-01T09:00:00.000Z",
        date: "2026-02-01",
        symbol: "F",
        type: "OPTION_BUY_CLOSE",
        contractId: "SHORT-F-14",
        contracts: 1,
        premium: 0.1,
        fees: 0,
      },
    ]);
    const derived = Calc.calculatePortfolio(state);
    const covering = derived.openOptions.find((option) => option.contractId === "LONG-F-12");
    assert(
      covering.longPutContractsAllocated === 1 && covering.longPutContractsAvailable === 1,
      "La couverture partielle n'a pas été libérée",
    );
  });

  test(130, "une fermeture complète libère toute la couverture", () => {
    const state = baseState([
      longPut(),
      shortPut(),
      {
        id: "CLOSE-ALL",
        createdAt: "2026-02-01T09:00:00.000Z",
        date: "2026-02-01",
        symbol: "F",
        type: "OPTION_BUY_CLOSE",
        contractId: "SHORT-F-14",
        contracts: 1,
        premium: 0.1,
        fees: 0,
      },
    ]);
    const covering = Calc.calculatePortfolio(state).openOptions.find(
      (option) => option.contractId === "LONG-F-12",
    );
    assert(covering.longPutContractsAllocated === 0, "La couverture complète demeure allouée");
  });

  test(131, "la suppression du put court libère sa couverture", () => {
    const state = baseState([longPut(), shortPut()]);
    const deletion = Corrections.prepareDelete(state, "SHORT-F-14");
    assert(deletion.valid, "La suppression du put court a été refusée");
    const covering = Calc.calculatePortfolio(deletion.value).openOptions.find(
      (option) => option.contractId === "LONG-F-12",
    );
    assert(covering.longPutContractsAllocated === 0, "La suppression n'a pas libéré la couverture");
  });

  test(132, "la fermeture du put long est bloquée tant qu'il couvre un put court", () => {
    const state = baseState([longPut(), shortPut()]);
    const validation = Forms.validateOperation(
      {
        id: "CLOSE-LONG",
        createdAt: "2026-02-01T09:00:00.000Z",
        date: "2026-02-01",
        symbol: "F",
        type: "OPTION_SELL_CLOSE",
        contractId: "LONG-F-12",
        contracts: 2,
        premium: 0.1,
        fees: 0,
      },
      state,
      Calc.calculatePortfolio(state),
    );
    assert(!validation.valid, "La fermeture du put long alloué a été acceptée");
    assert(
      validation.errors.some((error) => error.includes("SHORT-F-14")),
      "Le contrat court lié n'est pas expliqué",
    );
  });

  test(133, "l'assignation conserve le put long de couverture", () => {
    const state = baseState([
      longPut(),
      shortPut(),
      {
        id: "ASSIGN-1",
        createdAt: "2026-03-01T09:00:00.000Z",
        date: "2026-03-01",
        symbol: "F",
        type: "OPTION_ASSIGNMENT",
        contractId: "SHORT-F-14",
        contracts: 1,
        fees: 0,
      },
    ]);
    const derived = Calc.calculatePortfolio(state);
    const covering = derived.openOptions.find((option) => option.contractId === "LONG-F-12");
    assert(covering && covering.contractsOpen === 2, "Le put long a disparu après l'assignation");
  });

  test(134, "l'assignation ne compte pas deux fois la garantie", () => {
    const state = baseState([
      longPut(),
      shortPut(),
      {
        id: "ASSIGN-2",
        createdAt: "2026-03-01T09:00:00.000Z",
        date: "2026-03-01",
        symbol: "F",
        type: "OPTION_ASSIGNMENT",
        contractId: "SHORT-F-14",
        contracts: 1,
        fees: 0,
      },
    ]);
    const derived = Calc.calculatePortfolio(state);
    assert(derived.account.coveredPutGuarantee === 0, "Une garantie de put couvert subsiste");
    assert(derived.account.stockGuarantee === 420, "La garantie des actions assignées est incorrecte");
  });

  test(135, "la sauvegarde conserve tous les liens de couverture", () => {
    const state = baseState([longPut(), shortPut()]);
    const restored = JSON.parse(JSON.stringify(state));
    const savedShort = restored.transactions.find((transaction) => transaction.id === "SHORT-F-14");
    assert(
      savedShort.coveringContractId === "LONG-F-12" &&
        savedShort.coveredContracts === 1 &&
        savedShort.coverageType === "DIAGONAL",
      "Les liens de couverture n'ont pas survécu à la sauvegarde",
    );
  });

  test(136, "la modification peut remplacer le put long de couverture", () => {
    const state = baseState([
      longPut({ id: "LONG-1", contractId: "LONG-1", contracts: 1 }),
      longPut({ id: "LONG-2", contractId: "LONG-2", strike: 11, contracts: 1 }),
      shortPut({ coveringContractId: "LONG-1" }),
    ]);
    const edited = Corrections.prepareEdit(state, "SHORT-F-14", {
      ...shortPut({ coveringContractId: "LONG-2" }),
    });
    assert(edited.valid, "La modification de couverture a été refusée");
    const saved = edited.value.transactions.find((transaction) => transaction.id === "SHORT-F-14");
    assert(saved.coveringContractId === "LONG-2", "Le nouveau put long n'a pas été enregistré");
  });

  test(137, "l'annulation d'une correction restaure l'ancien lien", () => {
    const state = baseState([
      longPut({ id: "LONG-1", contractId: "LONG-1", contracts: 1 }),
      longPut({ id: "LONG-2", contractId: "LONG-2", strike: 11, contracts: 1 }),
      shortPut({ coveringContractId: "LONG-1" }),
    ]);
    let undo = null;
    let saved = null;
    const adapters = {
      writeUndo(value) {
        undo = value;
      },
      readUndo() {
        return undo;
      },
      clearUndo() {},
      save(value) {
        saved = value;
        return value;
      },
    };
    const edited = Corrections.prepareEdit(state, "SHORT-F-14", {
      ...shortPut({ coveringContractId: "LONG-2" }),
    });
    Corrections.persistWithRollback(state, edited.value, adapters);
    assert(saved, "La correction n'a pas été enregistrée");
    const restoredShort = undo.transactions.find((transaction) => transaction.id === "SHORT-F-14");
    assert(restoredShort.coveringContractId === "LONG-1", "L'ancien lien n'a pas été restauré");
  });

  test(138, "la suppression d'un put long ne peut pas créer un lien orphelin", () => {
    const state = baseState([longPut(), shortPut()]);
    const deletion = Corrections.prepareDelete(state, "LONG-F-12");
    assert(!deletion.valid, "Un lien de couverture orphelin a été créé");
  });

  test(139, "l'intégrité détecte une surallocation de couverture", () => {
    const state = baseState([
      longPut({ contracts: 1 }),
      shortPut(),
      shortPut({ id: "SHORT-2", date: "2026-01-04" }),
    ]);
    const integrity = Corrections.validateStateIntegrity(state);
    assert(!integrity.valid, "La surallocation n'a pas été détectée");
  });

  test(140, "le prix comptable d'une option longue est le coût net par action", () => {
    const option = Calc.calculatePortfolio(baseState([longPut()])).openOptions[0];
    assert(option.bookPrice === 0.15, `Prix comptable long incorrect: ${option.bookPrice}`);
  });

  test(141, "le prix comptable d'une option courte est la prime nette par action", () => {
    const option = Calc.calculatePortfolio(baseState([
      shortPut({
        putCollateralMode: Collateral.FULLY_SECURED,
        coveringContractId: null,
        coveredContracts: 0,
        coverageType: null,
      }),
    ])).openOptions[0];
    assert(option.bookPrice === 0.4, `Prix comptable court incorrect: ${option.bookPrice}`);
  });

  test(142, "les frais sont inclus dans le prix comptable de chaque jambe", () => {
    const longOption = Calc.calculatePortfolio(baseState([
      longPut({ fees: 2 }),
    ])).openOptions[0];
    const shortOption = Calc.calculatePortfolio(baseState([
      shortPut({
        contracts: 2,
        fees: 2,
        putCollateralMode: Collateral.FULLY_SECURED,
        coveringContractId: null,
        coveredContracts: 0,
        coverageType: null,
      }),
    ])).openOptions[0];
    equal(
      [longOption.bookPrice, shortOption.bookPrice],
      [0.16, 0.39],
      "Les frais ne sont pas répartis correctement",
    );
  });

  test(143, "une fermeture partielle utilise la valeur comptable restante", () => {
    const state = baseState([
      longPut({ fees: 2 }),
      {
        id: "CLOSE-LONG-PARTIAL",
        createdAt: "2026-02-01T09:00:00.000Z",
        date: "2026-02-01",
        symbol: "F",
        type: "OPTION_SELL_CLOSE",
        contractId: "LONG-F-12",
        contracts: 1,
        premium: 0.2,
        fees: 0,
      },
    ]);
    const option = Calc.calculatePortfolio(state).openOptions[0];
    assert(
      option.contractsOpen === 1 &&
        option.openingBasisRemaining === 16 &&
        option.bookPrice === 0.16,
      "Le prix comptable restant est incorrect après une fermeture partielle",
    );
  });

  test(144, "une option entièrement fermée est absente du tableau", () => {
    const state = baseState([
      longPut(),
      {
        id: "CLOSE-LONG-ALL",
        createdAt: "2026-02-01T09:00:00.000Z",
        date: "2026-02-01",
        symbol: "F",
        type: "OPTION_SELL_CLOSE",
        contractId: "LONG-F-12",
        contracts: 2,
        premium: 0.2,
        fees: 0,
      },
    ]);
    assert(Calc.calculatePortfolio(state).openOptions.length === 0, "L'option fermée est encore visible");
  });

  test(145, "la sauvegarde et la restauration préservent le calcul comptable", () => {
    const state = baseState([longPut({ fees: 2 })]);
    const payload = Backup.createPayload(state);
    const restored = Backup.validatePayload(payload);
    assert(restored.valid, "La sauvegarde n'a pas été restaurée");
    const option = Calc.calculatePortfolio(restored.value).openOptions[0];
    assert(
      restored.value.transactions[0].fees === 2 && option.bookPrice === 0.16,
      "Le prix comptable restauré est incorrect",
    );
    assert(Storage.APP_VERSION === "1.4.0", "La version de sauvegarde attendue a changé");
  });

  test(146, "le tableau mobile demeure contenu dans un défilement horizontal propre", () => {
    assert(
      /\.table-wrap\s*\{[^}]*overflow-x:\s*auto/s.test(cssSource),
      "Le tableau ne possède pas son propre défilement horizontal",
    );
    assert(
      /\.option-collateral-detail\s*\{[^}]*white-space:\s*normal/s.test(cssSource),
      "Le détail de garantie ne peut pas se replier sur mobile",
    );
  });

  test(147, "les anciennes colonnes sont retirées et Prix comptable est présent", () => {
    const table = htmlSource.match(
      /<thead><tr><th>Contrat[\s\S]*?<\/thead>\s*<tbody id="securityOptionsBody">/,
    )?.[0] || "";
    assert(table.includes("<th>Prix comptable</th>"), "La colonne Prix comptable manque");
    assert(!table.includes("Réelle ou estimée"), "La colonne Réelle ou estimée est encore visible");
    assert(!table.includes("Date de vérification"), "La colonne Date de vérification est encore visible");
  });

  const failed = results.filter((result) => !result.passed);
  const summary = {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };

  globalScope.__PORTAL_V121_TEST_RESULTS__ = summary;

  if (isNode) {
    console.log(`\nV1.2.2: ${summary.passed}/${summary.total} tests réussis.`);
    if (failed.length) process.exitCode = 1;
    module.exports = summary;
  } else {
    const previous = [
      globalScope.__PORTAL_TEST_RESULTS__,
      globalScope.__PORTAL_V11_TEST_RESULTS__,
      globalScope.__PORTAL_V111_TEST_RESULTS__,
      globalScope.__PORTAL_V12_TEST_RESULTS__,
    ].filter(Boolean);
    const oldPassed = previous.reduce((sum, group) => sum + group.passed, 0);
    const oldFailed = previous.reduce((sum, group) => sum + group.failed, 0);
    const oldTotal = previous.reduce((sum, group) => sum + group.total, 0);
    const totalPassed = oldPassed + summary.passed;
    const totalFailed = oldFailed + summary.failed;
    const total = oldTotal + summary.total;
    const summaryElement = document.getElementById("testSummary");
    const body = document.getElementById("testResults");
    summaryElement.className = totalFailed ? "summary failed" : "summary passed";
    summaryElement.textContent = totalFailed
      ? `${totalPassed}/${total} tests réussis — ${totalFailed} échec(s)`
      : `${totalPassed}/${total} tests réussis`;
    body.insertAdjacentHTML(
      "beforeend",
      results.map((result) => `
        <tr class="${result.passed ? "passed" : "failed"}">
          <td>${result.passed ? "RÉUSSI" : "ÉCHEC"}</td>
          <td>${result.number}. ${result.name}</td>
          <td>Réussi</td>
          <td>${result.passed ? "Réussi" : result.error}</td>
        </tr>
      `).join(""),
    );
  }
})(typeof window !== "undefined" ? window : globalThis);
