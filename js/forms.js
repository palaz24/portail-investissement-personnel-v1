(function initForms(globalScope) {
  "use strict";

  const isNode = typeof module !== "undefined" && module.exports;
  const Collateral = isNode ? require("./collateral.js") : globalScope.PortalCollateral;
  const ACCOUNT_TYPES = new Set([
    "DEPOSIT",
    "WITHDRAWAL",
    "INTEREST_INCOME",
    "MARGIN_INTEREST",
    "MANUAL_ADJUSTMENT"
  ]);
  const STOCK_TYPES = new Set(["STOCK_BUY", "STOCK_SELL"]);
  const OPTION_OPEN_TYPES = new Set(["OPTION_BUY_OPEN", "OPTION_SELL_OPEN"]);
  const OPTION_CLOSE_TYPES = new Set(["OPTION_BUY_CLOSE", "OPTION_SELL_CLOSE"]);
  const OPTION_EVENT_TYPES = new Set(["OPTION_EXPIRY", "OPTION_ASSIGNMENT", "OPTION_EXERCISE"]);
  const OPTION_TYPES = new Set([...OPTION_OPEN_TYPES, ...OPTION_CLOSE_TYPES, ...OPTION_EVENT_TYPES]);

  const TYPE_LABELS = {
    DEPOSIT: "Dépôt",
    WITHDRAWAL: "Retrait",
    STOCK_BUY: "Achat d’actions",
    STOCK_SELL: "Vente d’actions",
    OPTION_BUY_OPEN: "Achat d’option à l’ouverture",
    OPTION_SELL_OPEN: "Vente d’option à l’ouverture",
    OPTION_BUY_CLOSE: "Rachat d’option",
    OPTION_SELL_CLOSE: "Vente de fermeture",
    OPTION_EXPIRY: "Expiration",
    OPTION_ASSIGNMENT: "Assignation",
    OPTION_EXERCISE: "Exercice",
    DIVIDEND: "Dividende",
    INTEREST_INCOME: "Intérêt reçu",
    MARGIN_INTEREST: "Intérêt sur marge",
    MANUAL_ADJUSTMENT: "Ajustement manuel"
  };

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function isValidDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
      && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
  }

  function validateActualMarginFields(transaction, errors) {
    const hasActual = transaction.actualMarginRequirement !== ""
      && transaction.actualMarginRequirement != null;
    if (hasActual) {
      const actual = number(transaction.actualMarginRequirement);
      if (!Number.isFinite(actual) || actual <= 0) {
        errors.push("La garantie réelle Wealthsimple doit être supérieure à zéro.");
      }
      if (!isValidDate(transaction.marginRequirementCheckedAt)) {
        errors.push("La date de vérification de la garantie réelle est obligatoire.");
      }
    } else if (transaction.marginRequirementCheckedAt) {
      errors.push("Une date de vérification exige un montant de garantie réelle.");
    }
    return hasActual;
  }

  function canonicalTransaction(transaction) {
    const ignored = new Set(["id", "createdAt", "updatedAt", "note", "_index"]);
    return Object.keys(transaction)
      .filter((key) => !ignored.has(key) && transaction[key] !== "" && transaction[key] != null)
      .sort()
      .map((key) => `${key}:${typeof transaction[key] === "string" ? transaction[key].trim() : transaction[key]}`)
      .join("|");
  }

  function validateSecurity(security, state, editingId = null) {
    const errors = [];
    const symbol = String(security.symbol || "").trim().toUpperCase();
    if (!symbol) errors.push("Le symbole est obligatoire.");
    if (!/^[A-Z0-9.-]{1,10}$/.test(symbol)) errors.push("Le symbole contient des caractères non permis.");
    if (!String(security.name || "").trim()) errors.push("Le nom du titre est obligatoire.");
    if (!["ACTION", "FNB", "AUTRE"].includes(security.type)) errors.push("Le type du titre est invalide.");
    if (!["USD", "CAD"].includes(security.currency)) errors.push("La devise est invalide.");
    const requirement = number(security.marginRequirement);
    if (!Number.isFinite(requirement) || requirement < 0 || requirement > 1) {
      errors.push("L’exigence de garantie doit être entre 0 % et 100 %.");
    }
    if ((state.securities || []).some((item) => item.symbol === symbol && item.id !== editingId)) {
      errors.push("Ce symbole existe déjà.");
    }
    return { valid: errors.length === 0, errors, value: { ...security, symbol } };
  }

  function validateOperation(transaction, state, derived, editingId = null) {
    const errors = [];
    let coverageType = transaction.coverageType || null;
    const type = transaction.type;
    const symbol = String(transaction.symbol || "").trim().toUpperCase();
    if (!TYPE_LABELS[type]) errors.push("Le type d’opération est obligatoire.");
    if (!isValidDate(transaction.date)) errors.push("La date est invalide.");
    if (!ACCOUNT_TYPES.has(type) && !symbol) errors.push("Le symbole est obligatoire.");
    if (symbol && !(state.securities || []).some((security) => security.symbol === symbol && security.active !== false)) {
      errors.push("Le titre sélectionné est introuvable ou désactivé.");
    }

    if (ACCOUNT_TYPES.has(type)) {
      const amount = number(transaction.amount);
      if (!Number.isFinite(amount) || amount === 0) errors.push("Le montant doit être différent de zéro.");
      if (type !== "MANUAL_ADJUSTMENT" && amount < 0) errors.push("Entrez un montant positif; le sens est déterminé par l’opération.");
    }

    if (STOCK_TYPES.has(type)) {
      const quantity = number(transaction.quantity);
      const price = number(transaction.price);
      if (!Number.isFinite(quantity) || quantity <= 0) errors.push("La quantité d’actions doit être supérieure à zéro.");
      if (!Number.isFinite(price) || price < 0) errors.push("Le prix des actions ne peut pas être négatif.");
      if (type === "STOCK_SELL") {
        const held = derived.securities.find((security) => security.symbol === symbol)?.shares || 0;
        if (quantity > held) errors.push(`Vous détenez seulement ${held} action(s) de ${symbol}.`);
      }
    }

    if (type === "DIVIDEND") {
      const gross = number(transaction.grossAmount);
      const tax = number(transaction.taxWithheld || 0);
      if (!Number.isFinite(gross) || gross <= 0) errors.push("Le dividende brut doit être supérieur à zéro.");
      if (!Number.isFinite(tax) || tax < 0 || tax > gross) errors.push("La retenue fiscale est invalide.");
    }

    if (OPTION_OPEN_TYPES.has(type)) {
      if (!["CALL", "PUT"].includes(transaction.optionType)) errors.push("Choisissez CALL ou PUT.");
      if (!isValidDate(transaction.expiration)) errors.push("La date d’échéance est obligatoire.");
      if (isValidDate(transaction.expiration) && transaction.expiration < transaction.date) {
        errors.push("L’échéance ne peut pas précéder la date de l’opération.");
      }
      const strike = number(transaction.strike);
      const contracts = number(transaction.contracts);
      const premium = number(transaction.premium);
      if (!Number.isFinite(strike) || strike <= 0) errors.push("Le prix d’exercice doit être supérieur à zéro.");
      if (!Number.isInteger(contracts) || contracts <= 0) errors.push("Le nombre de contrats doit être un entier supérieur à zéro.");
      if (!Number.isFinite(premium) || premium < 0) errors.push("La prime ne peut pas être négative.");
      if (type === "OPTION_SELL_OPEN" && transaction.optionType === "PUT") {
        if (!Collateral.VALID_MODES.has(transaction.putCollateralMode)) {
          errors.push("Choisissez le mode de garantie du put vendu.");
        }
        if (transaction.putCollateralMode === Collateral.MARGIN_PARTIAL) {
          const security = (state.securities || []).find((item) => item.symbol === symbol);
          const rate = number(security?.marginRequirement);
          if (!Number.isFinite(rate) || rate <= 0 || rate > 1) {
            errors.push("Le taux de marge du titre est manquant ou invalide.");
          }
          validateActualMarginFields(transaction, errors);
        }
        if (transaction.putCollateralMode === Collateral.COVERED_BY_LONG_PUT) {
          const covering = (derived.openOptions || []).find((item) =>
            item.contractId === transaction.coveringContractId
          );
          if (!transaction.coveringContractId) {
            errors.push("Choisissez obligatoirement le put acheté utilisé comme couverture.");
          } else if (!covering) {
            errors.push("Le put acheté sélectionné est fermé ou introuvable.");
          } else {
            if (covering.side !== "LONG" || covering.optionType !== "PUT") {
              errors.push("La couverture doit être un put acheté encore ouvert.");
            }
            if (covering.symbol !== symbol) {
              errors.push("Le put acheté doit avoir le même symbole que le put vendu.");
            }
            if (String(covering.expiration || "") < String(transaction.expiration || "")) {
              errors.push("Le put acheté ne peut pas expirer avant le put vendu.");
            }
            if (covering.contractId === transaction.contractId) {
              errors.push("Le contrat vendu ne peut pas se couvrir lui-même.");
            }
            coverageType = Collateral.identifyCoverageType(transaction, covering);
            if (coverageType === Collateral.REVIEW_REQUIRED) {
              errors.push("La combinaison ne forme pas un spread vertical, calendrier ou diagonal valide.");
            }
            const covered = number(transaction.coveredContracts);
            const sold = number(transaction.contracts);
            if (!Number.isInteger(covered) || covered <= 0) {
              errors.push("Le nombre de contrats couverts doit être un entier supérieur à zéro.");
            } else if (covered < sold) {
              errors.push(`Cette transaction vend ${sold} contrats, mais seulement ${covered} sont couverts. Séparez les contrats non couverts dans une autre transaction.`);
            } else if (covered > sold) {
              errors.push("Le nombre de contrats couverts ne peut pas dépasser le nombre de contrats vendus.");
            }
            const available = Number(covering.longPutContractsAvailable ?? covering.contractsOpen);
            if (Number.isFinite(covered) && covered > available) {
              errors.push(`Cette option achetée possède seulement ${Math.max(0, available)} contrat de couverture disponible.`);
            }
            const hasActual = validateActualMarginFields(transaction, errors);
            const collateral = Collateral.calculateCoveredPutCollateral(transaction, covering, sold);
            if (!hasActual && collateral.source === "REVIEW_REQUIRED") {
              errors.push("Cette couverture exige une garantie réelle Wealthsimple et sa date de vérification.");
            }
          }
        }
      } else if (type === "OPTION_SELL_OPEN") {
        const margin = number(transaction.shortMarginRequirement || 0);
        if (!Number.isFinite(margin) || margin < 0) errors.push("L’exigence de marge de l’option est invalide.");
      }
    }

    if (OPTION_CLOSE_TYPES.has(type) || OPTION_EVENT_TYPES.has(type)) {
      const option = derived.openOptions.find((item) => item.contractId === transaction.contractId);
      if (!option) errors.push("Choisissez un contrat actuellement ouvert.");
      if (option) {
        const contracts = number(transaction.contracts || option.contractsOpen);
        if (!Number.isInteger(contracts) || contracts <= 0 || contracts > option.contractsOpen) {
          errors.push(`Vous pouvez fermer au maximum ${option.contractsOpen} contrat(s).`);
        }
        if (type === "OPTION_BUY_CLOSE" && option.side !== "SHORT") errors.push("Le rachat exige une option courte.");
        if (type === "OPTION_SELL_CLOSE" && option.side !== "LONG") errors.push("La vente de fermeture exige une option longue.");
        if (type === "OPTION_ASSIGNMENT" && option.side !== "SHORT") errors.push("L’assignation exige une option courte.");
        if (type === "OPTION_EXERCISE" && option.side !== "LONG") errors.push("L’exercice exige une option longue.");
        if (option.side === "LONG" && option.optionType === "PUT" && Number(option.longPutContractsAllocated) > 0) {
          const availableToClose = Math.max(
            0,
            Number(option.contractsOpen) - Number(option.longPutContractsAllocated)
          );
          if (contracts > availableToClose) {
            const linked = (option.usedAsCoverageOf || [])
              .map((item) => `${item.contractId} (${item.contracts} contrat(s))`)
              .join(", ");
            errors.push(`Ce put acheté est utilisé comme couverture de ${linked || "put(s) vendu(s)"}. Remplacez leur garantie avant de fermer, expirer ou exercer ces contrats.`);
          }
        }
        if (type === "OPTION_ASSIGNMENT" && option.optionType === "CALL") {
          const held = derived.securities.find((security) => security.symbol === option.symbol)?.shares || 0;
          const required = contracts * 100;
          if (required > held) errors.push(`Cette assignation exige ${required} actions, mais seulement ${held} sont détenues.`);
        }
      }
      if (OPTION_CLOSE_TYPES.has(type)) {
        const premium = number(transaction.premium);
        if (!Number.isFinite(premium) || premium < 0) errors.push("La prime de fermeture ne peut pas être négative.");
      }
    }

    const fees = number(transaction.fees || 0);
    if (!Number.isFinite(fees) || fees < 0) errors.push("Les frais ne peuvent pas être négatifs.");

    const fingerprint = canonicalTransaction({ ...transaction, symbol });
    if ((state.transactions || []).some((existing) =>
      existing.id !== editingId && canonicalTransaction(existing) === fingerprint
    )) {
      errors.push("Cette transaction est un doublon exact d’une transaction existante.");
    }

    return {
      valid: errors.length === 0,
      errors,
      value: {
        ...transaction,
        symbol,
        coverageType: transaction.putCollateralMode === Collateral.COVERED_BY_LONG_PUT
          ? coverageType
          : null
      }
    };
  }

  function validatePrice(price) {
    const errors = [];
    const value = number(price.price);
    if (!Number.isFinite(value) || value < 0) errors.push("Le prix ne peut pas être négatif.");
    if (!price.updatedAt || Number.isNaN(new Date(price.updatedAt).getTime())) errors.push("La date et l’heure sont invalides.");
    return { valid: errors.length === 0, errors };
  }

  function makeContractId(transaction) {
    const strike = String(transaction.strike).replace(".", "_");
    const suffix = String(transaction.id || Date.now()).replace(/[^A-Za-z0-9]/g, "").slice(-10);
    return `${transaction.symbol}-${transaction.expiration}-${transaction.optionType}-${strike}-${suffix}`;
  }

  const api = {
    ACCOUNT_TYPES,
    STOCK_TYPES,
    OPTION_OPEN_TYPES,
    OPTION_CLOSE_TYPES,
    OPTION_EVENT_TYPES,
    OPTION_TYPES,
    TYPE_LABELS,
    canonicalTransaction,
    validateSecurity,
    validateOperation,
    validatePrice,
    makeContractId,
    isValidDate
  };

  globalScope.PortalForms = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
