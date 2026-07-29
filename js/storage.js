(function initStorage(globalScope) {
  "use strict";

  const STORAGE_KEY = "portailInvestissementV1";
  const APP_VERSION = "1.1.0";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createBaseSecurities() {
    return [
      {
        id: "SEC-F",
        symbol: "F",
        name: "Ford Motor Company",
        type: "ACTION",
        currency: "USD",
        marginEligible: true,
        marginRequirement: 0.30,
        active: true
      },
      {
        id: "SEC-SPY",
        symbol: "SPY",
        name: "SPDR S&P 500 ETF Trust",
        type: "FNB",
        currency: "USD",
        marginEligible: true,
        marginRequirement: 0.30,
        active: true
      }
    ];
  }

  function getDemoData() {
    return {
      version: APP_VERSION,
      demoMode: true,
      createdAt: "2026-07-28T12:00:00.000Z",
      updatedAt: "2026-07-28T12:00:00.000Z",
      accountSettings: {
        accountName: "Compte sur marge — démonstration",
        baseCurrency: "USD",
        marginInterestRate: 8.00,
        stockCommission: 0,
        optionCommission: 0,
        assignmentFee: 0,
        marketData: {
          enabled: true,
          workerUrl: "https://portail-investissement-market-prices.palazz24.workers.dev",
          frequencyMinutes: 60,
          provider: "Market Data"
        }
      },
      securities: createBaseSecurities(),
      transactions: [
        {
          id: "DEMO-TX-001",
          date: "2026-07-01",
          type: "DEPOSIT",
          amount: 3000,
          note: "Dépôt initial fictif"
        },
        {
          id: "DEMO-TX-002",
          date: "2026-07-02",
          symbol: "F",
          type: "STOCK_BUY",
          quantity: 100,
          price: 10,
          fees: 0,
          note: "Achat fictif de Ford"
        },
        {
          id: "DEMO-TX-003",
          date: "2026-07-03",
          symbol: "F",
          type: "OPTION_SELL_OPEN",
          optionType: "CALL",
          strike: 12,
          expiration: "2026-12-18",
          contracts: 1,
          premium: 0.35,
          fees: 0,
          shortMarginRequirement: 150,
          contractId: "DEMO-F-CALL-20261218-12-001",
          note: "Call Ford fictif"
        },
        {
          id: "DEMO-TX-004",
          date: "2026-07-10",
          symbol: "F",
          type: "DIVIDEND",
          grossAmount: 15,
          taxWithheld: 2.25,
          note: "Dividende Ford fictif"
        },
        {
          id: "DEMO-TX-005",
          date: "2026-07-15",
          symbol: "SPY",
          type: "STOCK_BUY",
          quantity: 2,
          price: 500,
          fees: 0,
          note: "Petite position SPY fictive"
        }
      ],
      prices: {
        F: { price: 11.25, updatedAt: "2026-07-28T12:00:00.000Z", source: "Démonstration" },
        SPY: { price: 510, updatedAt: "2026-07-28T12:00:00.000Z", source: "Démonstration" }
      },
      optionPrices: {
        "DEMO-F-CALL-20261218-12-001": {
          price: 0.20,
          updatedAt: "2026-07-28T12:00:00.000Z",
          source: "Démonstration"
        }
      },
      positionsInitiales: [],
      history: [
        {
          id: "HIST-DEMO-001",
          at: "2026-07-28T12:00:00.000Z",
          action: "DEMO_CREATED",
          note: "Données fictives fournies avec le portail."
        }
      ]
    };
  }

  function getEmptyData() {
    const now = new Date().toISOString();
    return {
      version: APP_VERSION,
      demoMode: false,
      createdAt: now,
      updatedAt: now,
      accountSettings: {
        accountName: "Mon compte sur marge",
        baseCurrency: "USD",
        marginInterestRate: 8.00,
        stockCommission: 0,
        optionCommission: 0,
        assignmentFee: 0,
        marketData: {
          enabled: true,
          workerUrl: "https://portail-investissement-market-prices.palazz24.workers.dev",
          frequencyMinutes: 60,
          provider: "Market Data"
        }
      },
      securities: createBaseSecurities(),
      transactions: [],
      prices: {},
      optionPrices: {},
      positionsInitiales: [],
      history: [{ id: `HIST-${Date.now()}`, at: now, action: "EMPTY_PORTFOLIO_CREATED" }]
    };
  }

  function validateData(data) {
    const errors = [];
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { valid: false, errors: ["Le contenu de la sauvegarde n’est pas un objet valide."] };
    }
    if (typeof data.version !== "string" || data.version.split(".")[0] !== APP_VERSION.split(".")[0]) {
      errors.push("La version de la sauvegarde est incompatible.");
    }
    for (const field of ["securities", "transactions", "positionsInitiales", "history"]) {
      if (!Array.isArray(data[field])) errors.push(`La section « ${field} » est absente ou invalide.`);
    }
    if (!data.accountSettings || typeof data.accountSettings !== "object") {
      errors.push("Les paramètres du compte sont absents.");
    }
    if (!data.prices || typeof data.prices !== "object" || Array.isArray(data.prices)) {
      errors.push("La section des prix est invalide.");
    }
    if (!data.optionPrices || typeof data.optionPrices !== "object" || Array.isArray(data.optionPrices)) {
      errors.push("La section des prix d’options est invalide.");
    }

    const securityIds = new Set();
    const symbols = new Set();
    for (const security of data.securities || []) {
      const symbol = String(security.symbol || "").trim().toUpperCase();
      if (!security.id || securityIds.has(security.id)) errors.push("Un identifiant de titre est absent ou dupliqué.");
      if (!symbol || symbols.has(symbol)) errors.push("Un symbole est vide ou dupliqué.");
      if (!["ACTION", "FNB", "AUTRE"].includes(security.type)) errors.push(`Le type du titre ${symbol || "inconnu"} est invalide.`);
      if (Number(security.marginRequirement) < 0 || Number(security.marginRequirement) > 1) {
        errors.push(`L’exigence de garantie de ${symbol || "ce titre"} est invalide.`);
      }
      securityIds.add(security.id);
      symbols.add(symbol);
    }

    const transactionIds = new Set();
    for (const transaction of data.transactions || []) {
      if (!transaction.id || transactionIds.has(transaction.id)) {
        errors.push("Un identifiant de transaction est absent ou dupliqué.");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(transaction.date || ""))) {
        errors.push(`La date de la transaction ${transaction.id || "inconnue"} est invalide.`);
      }
      transactionIds.add(transaction.id);
    }

    return { valid: errors.length === 0, errors };
  }

  function safeRead() {
    try {
      return globalScope.localStorage?.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  }

  function safeWrite(value) {
    try {
      globalScope.localStorage?.setItem(STORAGE_KEY, value);
      return true;
    } catch {
      return false;
    }
  }

  function load() {
    const raw = safeRead();
    if (!raw) return getDemoData();
    try {
      const parsed = JSON.parse(raw);
      const validation = validateData(parsed);
      return validation.valid ? parsed : getDemoData();
    } catch {
      return getDemoData();
    }
  }

  function save(data, action = "AUTO_SAVE") {
    const next = clone(data);
    next.version = APP_VERSION;
    next.updatedAt = new Date().toISOString();
    next.history = Array.isArray(next.history) ? next.history.slice(-49) : [];
    next.history.push({
      id: `HIST-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      at: next.updatedAt,
      action
    });
    const validation = validateData(next);
    if (!validation.valid) {
      throw new Error(validation.errors.join(" "));
    }
    if (!safeWrite(JSON.stringify(next))) {
      throw new Error("Le navigateur n’a pas permis d’enregistrer les données localement.");
    }
    return next;
  }

  function savePriceUpdate(data) {
    const next = clone(data);
    next.version = APP_VERSION;
    next.updatedAt = new Date().toISOString();
    const validation = validateData(next);
    if (!validation.valid) {
      throw new Error(validation.errors.join(" "));
    }
    if (!safeWrite(JSON.stringify(next))) {
      throw new Error("Le navigateur n’a pas permis d’enregistrer les prix localement.");
    }
    return next;
  }

  function clear() {
    try {
      globalScope.localStorage?.removeItem(STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  const api = {
    STORAGE_KEY,
    APP_VERSION,
    getDemoData,
    getEmptyData,
    validateData,
    load,
    save,
    savePriceUpdate,
    clear,
    clone
  };

  globalScope.PortalStorage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
