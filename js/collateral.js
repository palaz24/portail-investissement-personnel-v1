(function initCollateral(globalScope) {
  "use strict";

  const FULLY_SECURED = "FULLY_SECURED";
  const MARGIN_PARTIAL = "MARGIN_PARTIAL";
  const REVIEW_REQUIRED = "REVIEW_REQUIRED";
  const VALID_MODES = new Set([FULLY_SECURED, MARGIN_PARTIAL]);
  const MULTIPLIER = 100;

  function number(value, fallback = NaN) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function roundMoney(value) {
    return Math.round((number(value, 0) + Number.EPSILON) * 100) / 100;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isSoldPutOpening(transaction) {
    return transaction?.type === "OPTION_SELL_OPEN" && transaction?.optionType === "PUT";
  }

  function marginRateFor(state, symbol) {
    const security = (state?.securities || []).find((item) =>
      String(item.symbol || "").toUpperCase() === String(symbol || "").toUpperCase()
    );
    const rate = number(security?.marginRequirement);
    return Number.isFinite(rate) && rate > 0 && rate <= 1 ? rate : null;
  }

  function calculatePutCollateral(opening, marginRate, contractsOpen = opening?.contracts) {
    const strike = number(opening?.strike, 0);
    const originalContracts = number(opening?.originalContracts ?? opening?.contracts, 0);
    const remainingContracts = number(contractsOpen, 0);
    const mode = opening?.putCollateralMode || REVIEW_REQUIRED;
    if (mode === FULLY_SECURED) {
      return {
        amount: roundMoney(strike * MULTIPLIER * remainingContracts),
        mode,
        source: "AUTOMATIC_FULL",
        label: "Calcul automatique",
        marginRate: null,
        checkedAt: null
      };
    }
    if (mode === MARGIN_PARTIAL) {
      const actual = number(opening?.actualMarginRequirement);
      if (Number.isFinite(actual) && actual > 0 && originalContracts > 0) {
        return {
          amount: roundMoney(actual * remainingContracts / originalContracts),
          mode,
          source: "ACTUAL_WEALTHSIMPLE",
          label: "Réelle — Wealthsimple",
          marginRate: Number.isFinite(marginRate) ? marginRate : null,
          checkedAt: opening?.marginRequirementCheckedAt || null
        };
      }
      if (Number.isFinite(marginRate) && marginRate > 0) {
        return {
          amount: roundMoney(strike * MULTIPLIER * remainingContracts * marginRate),
          mode,
          source: "ESTIMATED",
          label: "Estimée",
          marginRate,
          checkedAt: opening?.marginRequirementCheckedAt || null,
          replacedInvalidActual: opening?.actualMarginRequirement != null
        };
      }
    }
    return {
      amount: 0,
      mode,
      source: "REVIEW_REQUIRED",
      label: "À vérifier",
      marginRate: Number.isFinite(marginRate) ? marginRate : null,
      checkedAt: opening?.marginRequirementCheckedAt || null
    };
  }

  function migrateState(input) {
    const state = clone(input || {});
    const report = { migrated: [], reviewRequired: [] };
    state.transactions = (state.transactions || []).map((transaction) => {
      const next = { ...transaction };
      if (!isSoldPutOpening(next)) return next;
      if (!VALID_MODES.has(next.putCollateralMode)) {
        const legacy = number(next.shortMarginRequirement);
        if (Number.isFinite(legacy) && legacy > 0) {
          next.putCollateralMode = MARGIN_PARTIAL;
          next.actualMarginRequirement = legacy;
          next.marginRequirementCheckedAt = next.marginRequirementCheckedAt || null;
          report.migrated.push(next.id || "inconnue");
        } else {
          next.putCollateralMode = REVIEW_REQUIRED;
          next.actualMarginRequirement = null;
          next.marginRequirementCheckedAt = null;
          report.reviewRequired.push(next.id || "inconnue");
        }
      }
      if (next.actualMarginRequirement === "") next.actualMarginRequirement = null;
      if (!next.marginRequirementCheckedAt) next.marginRequirementCheckedAt = null;
      return next;
    });
    state.collateralMigrationReport = report;
    return { state, report };
  }

  const api = {
    FULLY_SECURED,
    MARGIN_PARTIAL,
    REVIEW_REQUIRED,
    VALID_MODES,
    isSoldPutOpening,
    marginRateFor,
    calculatePutCollateral,
    migrateState,
    roundMoney
  };

  globalScope.PortalCollateral = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
