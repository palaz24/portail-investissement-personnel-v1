(function initTransactionCorrections(globalScope) {
  "use strict";

  const isNode = typeof module !== "undefined" && module.exports;
  const Forms = isNode ? require("./forms.js") : globalScope.PortalForms;
  const Calc = isNode ? require("./calculations.js") : globalScope.PortalCalculations;
  const Collateral = isNode ? require("./collateral.js") : globalScope.PortalCollateral;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function compareChronologically(a, b) {
    return Calc.compareTransactionsChronologically(a, b);
  }

  function sortChronologically(transactions) {
    return [...(transactions || [])].sort(compareChronologically);
  }

  function stateBeforeTransaction(state, transaction) {
    const context = clone(state);
    context.transactions = sortChronologically(context.transactions)
      .filter((existing) => compareChronologically(existing, transaction) < 0);
    return context;
  }
  function findTransaction(state, transactionId) {
    return (state?.transactions || []).find((transaction) => transaction.id === transactionId) || null;
  }

  function linkedTransactions(state, opening) {
    if (!opening || !Forms.OPTION_OPEN_TYPES.has(opening.type) || !opening.contractId) return [];
    return (state?.transactions || []).filter((transaction) =>
      transaction.id !== opening.id && transaction.contractId === opening.contractId
    );
  }

  function coverageDependents(state, opening) {
    if (
      !opening
      || opening.type !== "OPTION_BUY_OPEN"
      || opening.optionType !== "PUT"
      || !opening.contractId
    ) return [];
    return (state?.transactions || []).filter((transaction) =>
      transaction.type === "OPTION_SELL_OPEN"
      && transaction.optionType === "PUT"
      && transaction.putCollateralMode === Collateral.COVERED_BY_LONG_PUT
      && transaction.coveringContractId === opening.contractId
    );
  }

  function refreshCoverageTypes(transactions) {
    const openings = new Map((transactions || [])
      .filter((transaction) => Forms.OPTION_OPEN_TYPES.has(transaction.type))
      .map((transaction) => [transaction.contractId, transaction]));
    return (transactions || []).map((transaction) => {
      if (
        transaction.type !== "OPTION_SELL_OPEN"
        || transaction.optionType !== "PUT"
        || transaction.putCollateralMode !== Collateral.COVERED_BY_LONG_PUT
      ) return transaction;
      return {
        ...transaction,
        coverageType: Collateral.identifyCoverageType(
          transaction,
          openings.get(transaction.coveringContractId)
        )
      };
    });
  }

  function openingIdentityChanged(before, after) {
    if (!Forms.OPTION_OPEN_TYPES.has(before?.type) || !Forms.OPTION_OPEN_TYPES.has(after?.type)) {
      return before?.type !== after?.type;
    }
    return ["symbol", "type", "optionType", "expiration", "strike", "contractId"]
      .some((key) => String(before?.[key] ?? "") !== String(after?.[key] ?? ""));
  }

  function duplicateIdErrors(transactions) {
    const seen = new Set();
    const errors = [];
    for (const transaction of transactions || []) {
      if (!transaction.id) {
        errors.push("Une opération ne possède aucun identifiant.");
      } else if (seen.has(transaction.id)) {
        errors.push(`L’identifiant ${transaction.id} est dupliqué.`);
      }
      seen.add(transaction.id);
    }
    return errors;
  }

  function optionLinkErrors(transactions) {
    const openings = new Map();
    const errors = [];
    for (const transaction of transactions || []) {
      if (!Forms.OPTION_OPEN_TYPES.has(transaction.type)) continue;
      if (!transaction.contractId) {
        errors.push(`L’ouverture ${transaction.id || "inconnue"} ne possède aucun identifiant de contrat.`);
      } else if (openings.has(transaction.contractId)) {
        errors.push(`Le contrat ${transaction.contractId} possède plusieurs ouvertures.`);
      } else {
        openings.set(transaction.contractId, transaction);
      }
    }
    for (const transaction of transactions || []) {
      if (!Forms.OPTION_CLOSE_TYPES.has(transaction.type) && !Forms.OPTION_EVENT_TYPES.has(transaction.type)) continue;
      const opening = openings.get(transaction.contractId);
      if (!opening) {
        errors.push(`L’opération ${transaction.id || "inconnue"} est orpheline : le contrat ${transaction.contractId || "inconnu"} n’a aucune ouverture.`);
      } else if (String(transaction.date || "") < String(opening.date || "")) {
        errors.push(`L’opération ${transaction.id || "inconnue"} précède l’ouverture du contrat ${transaction.contractId}.`);
      }
    }
    return errors;
  }

  function validateStateIntegrity(input) {
    const next = clone(input);
    next.transactions = sortChronologically(next.transactions);
    const errors = [
      ...duplicateIdErrors(next.transactions),
      ...optionLinkErrors(next.transactions)
    ];
    const prefix = { ...clone(next), transactions: [] };
    for (const transaction of next.transactions) {
      const derivedBefore = Calc.calculatePortfolio(prefix);
      if (derivedBefore.errors.length) {
        errors.push(...derivedBefore.errors.map((item) =>
          `L’opération ${item.transactionId || "inconnue"} empêche le recalcul : ${item.message}`
        ));
        break;
      }
      const validation = Forms.validateOperation(transaction, prefix, derivedBefore);
      if (!validation.valid) {
        errors.push(...validation.errors.map((message) =>
          `L’opération ${transaction.id || "inconnue"} est invalide : ${message}`
        ));
        break;
      }
      prefix.transactions.push(clone(transaction));
    }
    const derived = Calc.calculatePortfolio(next);
    errors.push(...derived.errors.map((item) =>
      `L’opération ${item.transactionId || "inconnue"} empêche le recalcul : ${item.message}`
    ));
    return {
      valid: errors.length === 0,
      errors: [...new Set(errors)],
      value: next,
      derived
    };
  }

  function prepareAdd(state, transaction) {
    const previous = clone(state);
    const chronologicalContext = stateBeforeTransaction(previous, transaction);
    const derivedBefore = Calc.calculatePortfolio(chronologicalContext);
    const validation = Forms.validateOperation(transaction, previous, derivedBefore);
    if (!validation.valid) return { valid: false, errors: validation.errors };
    const next = clone(previous);
    next.transactions.push(validation.value);
    return validateStateIntegrity(next);
  }
  function prepareEdit(state, transactionId, candidate, options = {}) {
    const previous = clone(state);
    const original = findTransaction(previous, transactionId);
    if (!original) return { valid: false, errors: ["La transaction à modifier est introuvable."] };

    const temporary = clone(previous);
    temporary.transactions = temporary.transactions.filter((transaction) => transaction.id !== transactionId);
    const replacement = {
      ...candidate,
      id: original.id,
      createdAt: original.createdAt || candidate.createdAt,
      updatedAt: options.updatedAt || new Date().toISOString()
    };
    const chronologicalContext = stateBeforeTransaction(temporary, replacement);
    const derivedWithoutOriginal = Calc.calculatePortfolio(chronologicalContext);
    const validation = Forms.validateOperation(
      replacement,
      temporary,
      derivedWithoutOriginal,
      transactionId
    );
    if (!validation.valid) return { valid: false, errors: validation.errors };

    const linked = linkedTransactions(previous, original);
    const coverageLinks = coverageDependents(previous, original);
    const dependencies = [...linked, ...coverageLinks];
    const identityChanged = openingIdentityChanged(original, validation.value);
    const confirmationRequired = identityChanged && dependencies.length > 0;
    if (confirmationRequired && !options.allowCascade) {
      return {
        valid: false,
        errors: [],
        requiresConfirmation: true,
        confirmationType: "EDIT_OPTION_CASCADE",
        dependencies: clone(dependencies)
      };
    }

    const next = clone(previous);
    next.transactions = next.transactions.map((transaction) => {
      if (transaction.id === transactionId) return clone(validation.value);
      if (identityChanged && transaction.contractId === original.contractId) {
        return {
          ...transaction,
          symbol: validation.value.symbol,
          contractId: validation.value.contractId,
          updatedAt: options.updatedAt || new Date().toISOString()
        };
      }
      if (identityChanged && transaction.coveringContractId === original.contractId) {
        return {
          ...transaction,
          coveringContractId: validation.value.contractId,
          updatedAt: options.updatedAt || new Date().toISOString()
        };
      }
      return transaction;
    });
    next.transactions = refreshCoverageTypes(next.transactions);

    next.optionPrices = clone(next.optionPrices || {});
    if (identityChanged && original.contractId !== validation.value.contractId) {
      if (next.optionPrices[validation.value.contractId] && !next.optionPrices[original.contractId]) {
        return { valid: false, errors: [`Un prix existe déjà pour le contrat ${validation.value.contractId}.`] };
      }
      if (next.optionPrices[original.contractId]) {
        next.optionPrices[validation.value.contractId] = next.optionPrices[original.contractId];
      }
      delete next.optionPrices[original.contractId];
    }

    const integrity = validateStateIntegrity(next);
    return {
      ...integrity,
      dependencies: clone(dependencies),
      cascadeApplied: identityChanged,
      oldContractId: original.contractId || null,
      newContractId: validation.value.contractId || null
    };
  }

  function prepareDelete(state, transactionId, options = {}) {
    const previous = clone(state);
    const target = findTransaction(previous, transactionId);
    if (!target) return { valid: false, errors: ["La transaction à supprimer est introuvable."] };
    const coverageLinks = coverageDependents(previous, target);
    if (coverageLinks.length) {
      const contracts = coverageLinks
        .map((transaction) => `${transaction.contractId} (${transaction.contracts} contrat(s))`)
        .join(", ");
      return {
        valid: false,
        errors: [`Ce put acheté couvre ${contracts}. Modifiez d’abord le mode de garantie des puts vendus liés.`],
        coverageDependents: clone(coverageLinks)
      };
    }
    const dependencies = linkedTransactions(previous, target);
    if (dependencies.length && !options.allowCascade) {
      return {
        valid: false,
        errors: [],
        requiresConfirmation: true,
        confirmationType: "DELETE_OPTION_CASCADE",
        dependencies: clone(dependencies)
      };
    }

    const removedIds = new Set([target.id]);
    if (dependencies.length) dependencies.forEach((transaction) => removedIds.add(transaction.id));
    const next = clone(previous);
    next.transactions = next.transactions.filter((transaction) => !removedIds.has(transaction.id));
    next.optionPrices = clone(next.optionPrices || {});
    if (Forms.OPTION_OPEN_TYPES.has(target.type)) delete next.optionPrices[target.contractId];
    const integrity = validateStateIntegrity(next);
    return {
      ...integrity,
      dependencies: clone(dependencies),
      cascadeApplied: dependencies.length > 0,
      removedTransactionIds: [...removedIds]
    };
  }

  function persistWithRollback(previous, next, adapters) {
    const before = clone(previous);
    const priorUndo = adapters.readUndo ? adapters.readUndo() : null;
    try {
      adapters.writeUndo(before);
      return { ok: true, state: adapters.save(clone(next)) };
    } catch (error) {
      try {
        if (priorUndo) adapters.writeUndo(priorUndo);
        else adapters.clearUndo?.();
      } catch {
        // L’état financier principal demeure la source de vérité.
      }
      return { ok: false, state: before, error };
    }
  }

  const api = {
    compareChronologically,
    sortChronologically,
    stateBeforeTransaction,
    findTransaction,
    linkedTransactions,
    coverageDependents,
    openingIdentityChanged,
    validateStateIntegrity,
    prepareAdd,
    prepareEdit,
    prepareDelete,
    persistWithRollback,
    clone
  };

  globalScope.PortalTransactionCorrections = api;
  if (isNode) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
