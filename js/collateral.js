(function initCollateral(globalScope) {
  "use strict";

  const FULLY_SECURED = "FULLY_SECURED";
  const MARGIN_PARTIAL = "MARGIN_PARTIAL";
  const COVERED_BY_LONG_PUT = "COVERED_BY_LONG_PUT";
  const REVIEW_REQUIRED = "REVIEW_REQUIRED";
  const VALID_MODES = new Set([FULLY_SECURED, MARGIN_PARTIAL, COVERED_BY_LONG_PUT]);
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

  function identifyCoverageType(shortPut, longPut) {
    if (!shortPut || !longPut) return REVIEW_REQUIRED;
    const sameExpiration = String(shortPut.expiration || "") === String(longPut.expiration || "");
    const laterExpiration = String(longPut.expiration || "") > String(shortPut.expiration || "");
    const sameStrike = number(shortPut.strike) === number(longPut.strike);
    if (sameExpiration && !sameStrike) return "VERTICAL";
    if (laterExpiration && sameStrike) return "CALENDAR";
    if (laterExpiration && !sameStrike) return "DIAGONAL";
    return REVIEW_REQUIRED;
  }

  function coverageTypeLabel(type) {
    return {
      VERTICAL: "Spread vertical",
      CALENDAR: "Spread calendrier",
      DIAGONAL: "Spread diagonal"
    }[type] || "À vérifier";
  }

  function isEligibleCoveringLongPut(shortPut, longPut) {
    return Boolean(
      shortPut
      && longPut
      && longPut.side === "LONG"
      && longPut.optionType === "PUT"
      && String(longPut.symbol || "").toUpperCase() === String(shortPut.symbol || "").toUpperCase()
      && number(longPut.contractsOpen) > 0
      && String(longPut.expiration || "") >= String(shortPut.expiration || "")
      && String(longPut.contractId || "") !== String(shortPut.contractId || "")
      && identifyCoverageType(shortPut, longPut) !== REVIEW_REQUIRED
    );
  }

  function calculateCoveredPutCollateral(opening, coveringOption, contractsOpen = opening?.contracts) {
    const originalContracts = number(opening?.originalContracts ?? opening?.contracts, 0);
    const remainingContracts = number(contractsOpen, 0);
    const actual = number(opening?.actualMarginRequirement);
    const coverageType = identifyCoverageType(opening, coveringOption);
    if (Number.isFinite(actual) && actual > 0 && originalContracts > 0) {
      return {
        amount: roundMoney(actual * remainingContracts / originalContracts),
        mode: COVERED_BY_LONG_PUT,
        source: "ACTUAL_WEALTHSIMPLE",
        label: "Réelle — Wealthsimple",
        coverageType,
        coverageTypeLabel: coverageTypeLabel(coverageType),
        checkedAt: opening?.marginRequirementCheckedAt || null
      };
    }

    const shortStrike = number(opening?.strike, 0);
    const longStrike = number(coveringOption?.strike, 0);
    if (coverageType === "VERTICAL" && shortStrike > longStrike) {
      const width = shortStrike - longStrike;
      const netCredit = number(opening?.openingPremium ?? opening?.premium, 0)
        - number(coveringOption?.openingPremium ?? coveringOption?.premium, 0);
      return {
        amount: roundMoney(Math.max(
          0,
          width * MULTIPLIER * remainingContracts
            - netCredit * MULTIPLIER * remainingContracts
        )),
        mode: COVERED_BY_LONG_PUT,
        source: "DEFINED_RISK_ESTIMATE",
        label: "Estimée — risque défini",
        coverageType,
        coverageTypeLabel: coverageTypeLabel(coverageType),
        checkedAt: opening?.marginRequirementCheckedAt || null
      };
    }

    if (coverageType === "CALENDAR" || coverageType === "DIAGONAL") {
      const estimate = (shortStrike - longStrike) * MULTIPLIER * remainingContracts;
      if (estimate > 0) {
        return {
          amount: roundMoney(estimate),
          mode: COVERED_BY_LONG_PUT,
          source: "CONSERVATIVE_ESTIMATE",
          label: "Estimée — à vérifier",
          coverageType,
          coverageTypeLabel: coverageTypeLabel(coverageType),
          checkedAt: opening?.marginRequirementCheckedAt || null
        };
      }
    }

    return {
      amount: 0,
      mode: COVERED_BY_LONG_PUT,
      source: "REVIEW_REQUIRED",
      label: "À vérifier",
      coverageType,
      coverageTypeLabel: coverageTypeLabel(coverageType),
      checkedAt: opening?.marginRequirementCheckedAt || null
    };
  }

  function calculatePutCollateral(opening, marginRate, contractsOpen = opening?.contracts, coveringOption = null) {
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
    if (mode === COVERED_BY_LONG_PUT) {
      return calculateCoveredPutCollateral(opening, coveringOption, remainingContracts);
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
      if (next.putCollateralMode === COVERED_BY_LONG_PUT) {
        next.coveringContractId = next.coveringContractId || null;
        next.coveredContracts = Number(next.coveredContracts || next.contracts || 0);
        next.coverageType = next.coverageType || null;
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
    COVERED_BY_LONG_PUT,
    REVIEW_REQUIRED,
    VALID_MODES,
    isSoldPutOpening,
    marginRateFor,
    identifyCoverageType,
    coverageTypeLabel,
    isEligibleCoveringLongPut,
    calculateCoveredPutCollateral,
    calculatePutCollateral,
    migrateState,
    roundMoney
  };

  globalScope.PortalCollateral = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
