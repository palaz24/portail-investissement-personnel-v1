(function initCalculations(globalScope) {
  "use strict";

  const isNode = typeof module !== "undefined" && module.exports;
  const Collateral = isNode ? require("./collateral.js") : globalScope.PortalCollateral;
  const MULTIPLIER = 100;
  const CASH_TYPES = new Set([
    "DEPOSIT",
    "WITHDRAWAL",
    "INTEREST_INCOME",
    "MARGIN_INTEREST",
    "MANUAL_ADJUSTMENT"
  ]);

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function roundMoney(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function compareTransactionsChronologically(a, b) {
    const byDate = String(a?.date || "").localeCompare(String(b?.date || ""));
    if (byDate) return byDate;
    const byCreatedAt = String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
    if (byCreatedAt) return byCreatedAt;
    return String(a?.id || "").localeCompare(String(b?.id || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function createSecurityLedger(security) {
    return {
      symbol: security.symbol,
      name: security.name,
      type: security.type,
      currency: security.currency || "USD",
      marginEligible: Boolean(security.marginEligible),
      marginRequirement: number(security.marginRequirement),
      active: security.active !== false,
      shares: 0,
      stockBookValue: 0,
      averageCost: 0,
      currentPrice: 0,
      stockValue: 0,
      realizedStock: 0,
      realizedOptions: 0,
      unrealizedStock: 0,
      unrealizedOptions: 0,
      dividendsNet: 0,
      premiumsReceived: 0,
      fees: 0,
      shortOptionMargin: 0,
      stockGuarantee: 0,
      fullySecuredPutGuarantee: 0,
      marginPutGuarantee: 0,
      otherShortOptionGuarantee: 0,
      guaranteeRequired: 0,
      capitalEngaged: 0,
      currentValue: 0,
      realizedPL: 0,
      unrealizedPL: 0,
      economicPL: 0,
      revenues: 0,
      optionsOpen: [],
      transactions: []
    };
  }

  function optionMarketPrice(data, contractId) {
    return Math.max(0, number(data.optionPrices?.[contractId]?.price));
  }

  function addShares(ledger, quantity, price, extraCost = 0) {
    const qty = number(quantity);
    const cost = qty * number(price) + number(extraCost);
    ledger.shares += qty;
    ledger.stockBookValue += cost;
    ledger.averageCost = ledger.shares > 0 ? ledger.stockBookValue / ledger.shares : 0;
  }

  function sellShares(ledger, quantity, price, fees = 0) {
    const qty = number(quantity);
    if (qty <= 0 || qty > ledger.shares + 1e-9) {
      throw new Error(`Vente impossible pour ${ledger.symbol} : quantité détenue insuffisante.`);
    }
    const averageCost = ledger.shares > 0 ? ledger.stockBookValue / ledger.shares : 0;
    const removedCost = averageCost * qty;
    const proceeds = qty * number(price) - number(fees);
    ledger.realizedStock += proceeds - removedCost;
    ledger.shares -= qty;
    ledger.stockBookValue -= removedCost;
    if (Math.abs(ledger.shares) < 1e-9) {
      ledger.shares = 0;
      ledger.stockBookValue = 0;
      ledger.averageCost = 0;
    } else {
      ledger.averageCost = ledger.stockBookValue / ledger.shares;
    }
    return proceeds;
  }

  function requireOption(options, transaction, expectedSide) {
    const option = options.get(transaction.contractId);
    if (!option || option.contractsOpen <= 0) {
      throw new Error("Le contrat d’option correspondant est introuvable ou déjà fermé.");
    }
    if (expectedSide && option.side !== expectedSide) {
      throw new Error(`Cette opération exige une option ${expectedSide === "SHORT" ? "courte" : "longue"}.`);
    }
    const contracts = number(transaction.contracts || option.contractsOpen);
    if (!Number.isInteger(contracts) || contracts <= 0 || contracts > option.contractsOpen) {
      throw new Error("Le nombre de contrats à fermer est invalide.");
    }
    return { option, contracts };
  }

  function allocateOptionBasis(option, contracts) {
    const ratio = contracts / option.contractsOpen;
    const allocated = option.openingBasisRemaining * ratio;
    option.openingBasisRemaining -= allocated;
    option.contractsOpen -= contracts;
    if (option.contractsOpen === 0) option.openingBasisRemaining = 0;
    return allocated;
  }

  function transactionCashFlow(transaction) {
    const quantity = number(transaction.quantity);
    const price = number(transaction.price);
    const contracts = number(transaction.contracts);
    const premium = number(transaction.premium);
    const fees = number(transaction.fees);
    const amount = number(transaction.amount);

    switch (transaction.type) {
      case "DEPOSIT": return Math.abs(amount);
      case "WITHDRAWAL": return -Math.abs(amount);
      case "STOCK_BUY": return -(quantity * price + fees);
      case "STOCK_SELL": return quantity * price - fees;
      case "OPTION_BUY_OPEN":
      case "OPTION_BUY_CLOSE": return -(contracts * premium * MULTIPLIER + fees);
      case "OPTION_SELL_OPEN":
      case "OPTION_SELL_CLOSE": return contracts * premium * MULTIPLIER - fees;
      case "DIVIDEND": return number(transaction.grossAmount) - number(transaction.taxWithheld);
      case "INTEREST_INCOME": return Math.abs(amount);
      case "MARGIN_INTEREST": return -Math.abs(amount);
      case "MANUAL_ADJUSTMENT": return amount;
      default: return 0;
    }
  }

  function calculatePortfolio(input) {
    const data = clone(input || {});
    const ledgers = new Map();
    const options = new Map();
    const errors = [];
    const account = {
      netDeposits: 0,
      cash: 0,
      interestIncome: 0,
      marginInterest: 0,
      manualAdjustments: 0
    };

    for (const security of data.securities || []) {
      ledgers.set(String(security.symbol || "").toUpperCase(), createSecurityLedger(security));
    }

    const transactions = (data.transactions || [])
      .map((transaction, index) => ({ ...transaction, _index: index }))
      .sort((a, b) => compareTransactionsChronologically(a, b) || a._index - b._index);

    for (const transaction of transactions) {
      const symbol = String(transaction.symbol || "").toUpperCase();
      const ledger = symbol ? ledgers.get(symbol) : null;
      try {
        if (!CASH_TYPES.has(transaction.type) && transaction.type !== "DIVIDEND" && !ledger) {
          throw new Error(`Le titre ${symbol || "sans symbole"} est introuvable.`);
        }

        switch (transaction.type) {
          case "DEPOSIT":
            account.netDeposits += Math.abs(number(transaction.amount));
            account.cash += Math.abs(number(transaction.amount));
            break;
          case "WITHDRAWAL":
            account.netDeposits -= Math.abs(number(transaction.amount));
            account.cash -= Math.abs(number(transaction.amount));
            break;
          case "STOCK_BUY": {
            const fees = number(transaction.fees);
            addShares(ledger, transaction.quantity, transaction.price, fees);
            ledger.fees += fees;
            account.cash += transactionCashFlow(transaction);
            ledger.transactions.push(transaction);
            break;
          }
          case "STOCK_SELL": {
            const fees = number(transaction.fees);
            account.cash += sellShares(ledger, transaction.quantity, transaction.price, fees);
            ledger.fees += fees;
            ledger.transactions.push(transaction);
            break;
          }
          case "OPTION_BUY_OPEN":
          case "OPTION_SELL_OPEN": {
            const contracts = number(transaction.contracts);
            const gross = contracts * number(transaction.premium) * MULTIPLIER;
            const fees = number(transaction.fees);
            const side = transaction.type === "OPTION_BUY_OPEN" ? "LONG" : "SHORT";
            if (options.has(transaction.contractId)) {
              throw new Error(`Le contrat ${transaction.contractId} existe déjà.`);
            }
            options.set(transaction.contractId, {
              contractId: transaction.contractId,
              symbol,
              optionType: transaction.optionType,
              side,
              strike: number(transaction.strike),
              expiration: transaction.expiration,
              contractsOpen: contracts,
              originalContracts: contracts,
              openingBasisRemaining: side === "LONG" ? gross + fees : gross - fees,
              openingPremium: number(transaction.premium),
              shortMarginRequirement: side === "SHORT" ? number(transaction.shortMarginRequirement) : 0,
              putCollateralMode: side === "SHORT" && transaction.optionType === "PUT"
                ? transaction.putCollateralMode
                : null,
              actualMarginRequirement: side === "SHORT" && transaction.optionType === "PUT"
                ? transaction.actualMarginRequirement ?? null
                : null,
              marginRequirementCheckedAt: side === "SHORT" && transaction.optionType === "PUT"
                ? transaction.marginRequirementCheckedAt || null
                : null,
              openedOn: transaction.date
            });
            if (side === "SHORT") ledger.premiumsReceived += gross;
            ledger.fees += fees;
            account.cash += transactionCashFlow(transaction);
            ledger.transactions.push(transaction);
            break;
          }
          case "OPTION_BUY_CLOSE":
          case "OPTION_SELL_CLOSE": {
            const expectedSide = transaction.type === "OPTION_BUY_CLOSE" ? "SHORT" : "LONG";
            const { option, contracts } = requireOption(options, transaction, expectedSide);
            const allocatedBasis = allocateOptionBasis(option, contracts);
            const gross = contracts * number(transaction.premium) * MULTIPLIER;
            const fees = number(transaction.fees);
            const realized = option.side === "SHORT"
              ? allocatedBasis - gross - fees
              : gross - fees - allocatedBasis;
            ledger.realizedOptions += realized;
            ledger.fees += fees;
            account.cash += transactionCashFlow(transaction);
            ledger.transactions.push(transaction);
            break;
          }
          case "OPTION_EXPIRY": {
            const { option, contracts } = requireOption(options, transaction);
            const allocatedBasis = allocateOptionBasis(option, contracts);
            ledger.realizedOptions += option.side === "SHORT" ? allocatedBasis : -allocatedBasis;
            ledger.transactions.push(transaction);
            break;
          }
          case "OPTION_ASSIGNMENT": {
            const { option, contracts } = requireOption(options, transaction, "SHORT");
            const allocatedBasis = allocateOptionBasis(option, contracts);
            const shares = contracts * MULTIPLIER;
            const fee = number(transaction.fees);
            ledger.realizedOptions += allocatedBasis;
            ledger.fees += fee;
            if (option.optionType === "PUT") {
              addShares(ledger, shares, option.strike, fee);
              account.cash -= shares * option.strike + fee;
            } else {
              account.cash += sellShares(ledger, shares, option.strike, fee);
            }
            ledger.transactions.push(transaction);
            break;
          }
          case "OPTION_EXERCISE": {
            const { option, contracts } = requireOption(options, transaction, "LONG");
            const allocatedBasis = allocateOptionBasis(option, contracts);
            const shares = contracts * MULTIPLIER;
            const fee = number(transaction.fees);
            ledger.fees += fee;
            if (option.optionType === "CALL") {
              addShares(ledger, shares, option.strike, allocatedBasis + fee);
              account.cash -= shares * option.strike + fee;
            } else {
              account.cash += sellShares(ledger, shares, option.strike, fee);
              ledger.realizedOptions -= allocatedBasis;
            }
            ledger.transactions.push(transaction);
            break;
          }
          case "DIVIDEND": {
            if (!ledger) throw new Error("Un dividende doit être associé à un titre.");
            const net = number(transaction.grossAmount) - number(transaction.taxWithheld);
            ledger.dividendsNet += net;
            account.cash += net;
            ledger.transactions.push(transaction);
            break;
          }
          case "INTEREST_INCOME":
            account.interestIncome += Math.abs(number(transaction.amount));
            account.cash += Math.abs(number(transaction.amount));
            break;
          case "MARGIN_INTEREST":
            account.marginInterest += Math.abs(number(transaction.amount));
            account.cash -= Math.abs(number(transaction.amount));
            break;
          case "MANUAL_ADJUSTMENT":
            account.manualAdjustments += number(transaction.amount);
            account.cash += number(transaction.amount);
            break;
          default:
            throw new Error(`Type d’opération non reconnu : ${transaction.type || "vide"}.`);
        }
      } catch (error) {
        errors.push({ transactionId: transaction.id, message: error.message });
      }
    }

    let stocksValue = 0;
    let longOptionsValue = 0;
    let shortOptionsLiability = 0;
    let guaranteeRequired = 0;
    let stockGuarantee = 0;
    let fullySecuredPutGuarantee = 0;
    let marginPutGuarantee = 0;
    let otherShortOptionGuarantee = 0;
    let realizedSecurities = 0;
    let unrealizedTotal = 0;
    let dividendsNet = 0;
    let premiumsReceived = 0;
    const openOptions = [];

    for (const [symbol, ledger] of ledgers) {
      const price = Math.max(0, number(data.prices?.[symbol]?.price));
      ledger.currentPrice = price;
      ledger.stockValue = ledger.shares * price;
      ledger.unrealizedStock = ledger.stockValue - ledger.stockBookValue;

      for (const option of options.values()) {
        if (option.symbol !== symbol || option.contractsOpen <= 0) continue;
        const currentPrice = optionMarketPrice(data, option.contractId);
        const currentValue = currentPrice * option.contractsOpen * MULTIPLIER;
        const unrealized = option.side === "LONG"
          ? currentValue - option.openingBasisRemaining
          : option.openingBasisRemaining - currentValue;
        const position = {
          ...option,
          currentPrice,
          currentValue,
          unrealizedPL: unrealized
        };
        ledger.optionsOpen.push(position);
        openOptions.push(position);
        ledger.unrealizedOptions += unrealized;
        if (option.side === "LONG") longOptionsValue += currentValue;
        else {
          shortOptionsLiability += currentValue;
          if (option.optionType === "PUT") {
            const collateral = Collateral.calculatePutCollateral(
              option,
              ledger.marginRequirement,
              option.contractsOpen
            );
            Object.assign(position, {
              collateralAmount: collateral.amount,
              collateralSource: collateral.source,
              collateralLabel: collateral.label,
              collateralMarginRate: collateral.marginRate,
              collateralCheckedAt: collateral.checkedAt,
              collateralReplacedInvalidActual: Boolean(collateral.replacedInvalidActual)
            });
            if (option.putCollateralMode === Collateral.FULLY_SECURED) {
              ledger.fullySecuredPutGuarantee += collateral.amount;
            } else {
              ledger.marginPutGuarantee += collateral.amount;
            }
            ledger.shortOptionMargin += collateral.amount;
          } else {
            const originalContracts = number(option.originalContracts, option.contractsOpen);
            const ratio = originalContracts > 0 ? option.contractsOpen / originalContracts : 0;
            const amount = number(option.shortMarginRequirement) * ratio;
            ledger.otherShortOptionGuarantee += amount;
            ledger.shortOptionMargin += amount;
            Object.assign(position, {
              collateralAmount: roundMoney(amount),
              collateralSource: "MANUAL_OTHER_SHORT",
              collateralLabel: "Manuelle"
            });
          }
        }
      }

      ledger.realizedPL = ledger.realizedStock + ledger.realizedOptions + ledger.dividendsNet;
      ledger.unrealizedPL = ledger.unrealizedStock + ledger.unrealizedOptions;
      ledger.economicPL = ledger.realizedPL + ledger.unrealizedPL;
      ledger.revenues = ledger.premiumsReceived + ledger.dividendsNet;
      ledger.stockGuarantee = ledger.stockValue * ledger.marginRequirement;
      ledger.guaranteeRequired = ledger.stockGuarantee + ledger.shortOptionMargin;
      ledger.capitalEngaged = ledger.stockBookValue
        + ledger.optionsOpen.filter((option) => option.side === "LONG")
          .reduce((sum, option) => sum + option.openingBasisRemaining, 0)
        + ledger.shortOptionMargin;
      ledger.currentValue = ledger.stockValue
        + ledger.optionsOpen.filter((option) => option.side === "LONG").reduce((sum, option) => sum + option.currentValue, 0)
        - ledger.optionsOpen.filter((option) => option.side === "SHORT").reduce((sum, option) => sum + option.currentValue, 0);
      ledger.averageCost = ledger.shares > 0 ? ledger.stockBookValue / ledger.shares : 0;
      ledger.riskLevel = ledger.shortOptionMargin > 0
        ? "Élevé"
        : ledger.optionsOpen.length > 0
          ? "Modéré"
          : "Faible";

      stocksValue += ledger.stockValue;
      stockGuarantee += ledger.stockGuarantee;
      fullySecuredPutGuarantee += ledger.fullySecuredPutGuarantee;
      marginPutGuarantee += ledger.marginPutGuarantee;
      otherShortOptionGuarantee += ledger.otherShortOptionGuarantee;
      guaranteeRequired += ledger.guaranteeRequired;
      realizedSecurities += ledger.realizedPL;
      unrealizedTotal += ledger.unrealizedPL;
      dividendsNet += ledger.dividendsNet;
      premiumsReceived += ledger.premiumsReceived;
    }

    const realizedPL = realizedSecurities + account.interestIncome - account.marginInterest + account.manualAdjustments;
    const totalValue = account.cash + stocksValue + longOptionsValue - shortOptionsLiability;
    const economicPL = realizedPL + unrealizedTotal;
    const marginUsed = account.cash < 0 ? Math.abs(account.cash) : 0;
    const marginAvailable = totalValue - guaranteeRequired;
    const returnPercent = account.netDeposits === 0 ? 0 : economicPL / account.netDeposits * 100;

    return {
      account: {
        netDeposits: roundMoney(account.netDeposits),
        cash: roundMoney(account.cash),
        stocksValue: roundMoney(stocksValue),
        longOptionsValue: roundMoney(longOptionsValue),
        shortOptionsLiability: roundMoney(shortOptionsLiability),
        totalValue: roundMoney(totalValue),
        marginUsed: roundMoney(marginUsed),
        stockGuarantee: roundMoney(stockGuarantee),
        fullySecuredPutGuarantee: roundMoney(fullySecuredPutGuarantee),
        marginPutGuarantee: roundMoney(marginPutGuarantee),
        otherShortOptionGuarantee: roundMoney(otherShortOptionGuarantee),
        guaranteeRequired: roundMoney(guaranteeRequired),
        marginAvailable: roundMoney(marginAvailable),
        premiumsReceived: roundMoney(premiumsReceived),
        dividendsNet: roundMoney(dividendsNet),
        interestIncome: roundMoney(account.interestIncome),
        marginInterest: roundMoney(account.marginInterest),
        realizedPL: roundMoney(realizedPL),
        unrealizedPL: roundMoney(unrealizedTotal),
        economicPL: roundMoney(economicPL),
        returnPercent: roundMoney(returnPercent)
      },
      securities: [...ledgers.values()].map((ledger) => ({
        ...ledger,
        shares: number(ledger.shares),
        averageCost: roundMoney(ledger.averageCost),
        stockBookValue: roundMoney(ledger.stockBookValue),
        stockValue: roundMoney(ledger.stockValue),
        capitalEngaged: roundMoney(ledger.capitalEngaged),
        currentValue: roundMoney(ledger.currentValue),
        stockGuarantee: roundMoney(ledger.stockGuarantee),
        fullySecuredPutGuarantee: roundMoney(ledger.fullySecuredPutGuarantee),
        marginPutGuarantee: roundMoney(ledger.marginPutGuarantee),
        otherShortOptionGuarantee: roundMoney(ledger.otherShortOptionGuarantee),
        guaranteeRequired: roundMoney(ledger.guaranteeRequired),
        premiumsReceived: roundMoney(ledger.premiumsReceived),
        dividendsNet: roundMoney(ledger.dividendsNet),
        realizedPL: roundMoney(ledger.realizedPL),
        unrealizedPL: roundMoney(ledger.unrealizedPL),
        economicPL: roundMoney(ledger.economicPL),
        revenues: roundMoney(ledger.revenues)
      })),
      openOptions,
      errors
    };
  }

  const api = {
    MULTIPLIER,
    calculatePortfolio,
    compareTransactionsChronologically,
    transactionCashFlow,
    roundMoney
  };

  globalScope.PortalCalculations = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
