(function initOptionsEngine(globalScope) {
  "use strict";

  const DAY_MS = 86400000;
  const EPSILON = 1e-9;
  const DEFAULT_STEPS = 200;
  const ALLOWED_STEPS = new Set([50, 100, 200, 300, 500]);

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round(value, decimals = 6) {
    const factor = 10 ** decimals;
    return Math.round((number(value) + Number.EPSILON) * factor) / factor;
  }

  function dateOnly(value) {
    const text = String(value || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`)) ? text : "";
  }

  function addDays(value, days) {
    const base = new Date(`${dateOnly(value) || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + days);
    return base.toISOString().slice(0, 10);
  }

  function yearFraction(from, to) {
    const start = Date.parse(`${dateOnly(from)}T00:00:00Z`);
    const end = Date.parse(`${dateOnly(to)}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return NaN;
    return Math.max(0, (end - start) / (365 * DAY_MS));
  }

  function positionSign(side) {
    return String(side).toLowerCase() === "short" ? -1 : 1;
  }

  function intrinsicValue(optionType, stockPrice, strike) {
    const s = Math.max(0, number(stockPrice));
    const k = Math.max(0, number(strike));
    return String(optionType).toLowerCase() === "put" ? Math.max(k - s, 0) : Math.max(s - k, 0);
  }

  function normalizeLeg(input = {}) {
    const instrumentType = String(input.instrumentType || "option").toLowerCase() === "stock" ? "stock" : "option";
    const side = String(input.side || "long").toLowerCase() === "short" ? "short" : "long";
    const optionType = String(input.optionType || "call").toLowerCase() === "put" ? "put" : "call";
    return {
      id: String(input.id || `leg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
      enabled: input.enabled !== false,
      instrumentType,
      optionType,
      side,
      quantity: number(input.quantity, instrumentType === "stock" ? 100 : 1),
      multiplier: number(input.multiplier, 100),
      strike: number(input.strike),
      expiration: dateOnly(input.expiration),
      entryPrice: number(input.entryPrice),
      currentMark: input.currentMark == null || input.currentMark === "" ? null : number(input.currentMark, NaN),
      impliedVolatility: number(input.impliedVolatility, 0.4),
      commission: number(input.commission),
      label: String(input.label || "").slice(0, 100),
      notes: String(input.notes || "").slice(0, 2000),
    };
  }

  function normalizeStrategy(input = {}) {
    const valuationDate = dateOnly(input.valuationDate) || new Date().toISOString().slice(0, 10);
    const priceRange = input.priceRange && typeof input.priceRange === "object" ? input.priceRange : {};
    return {
      id: String(input.id || `strategy-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
      name: String(input.name || "Nouvelle stratégie").slice(0, 120),
      symbol: String(input.symbol == null ? "F" : input.symbol).trim().toUpperCase().slice(0, 12),
      securityName: String(input.securityName || "Ford Motor Company").slice(0, 120),
      underlyingPrice: number(input.underlyingPrice, 15),
      currency: String(input.currency || "USD").toUpperCase().slice(0, 6),
      valuationDate,
      analysisDate: dateOnly(input.analysisDate) || valuationDate,
      riskFreeRate: number(input.riskFreeRate, 0.04),
      dividendYield: number(input.dividendYield, 0),
      impliedVolatility: number(input.impliedVolatility, 0.4),
      multiplier: number(input.multiplier, 100),
      optionCommission: number(input.optionCommission, 0),
      stockCommission: number(input.stockCommission, 0),
      steps: ALLOWED_STEPS.has(number(input.steps)) ? number(input.steps) : DEFAULT_STEPS,
      pricingMethod: "american-binomial-crr",
      rangeMode: ["auto", "10", "20", "30", "custom"].includes(String(priceRange.mode || input.rangeMode))
        ? String(priceRange.mode || input.rangeMode)
        : "auto",
      rangeMin: number(priceRange.min ?? input.rangeMin, 0),
      rangeMax: number(priceRange.max ?? input.rangeMax, 0),
      tableStep: Math.max(0.01, number(input.tableStep, 1)),
      legs: Array.isArray(input.legs) ? input.legs.slice(0, 40).map(normalizeLeg) : [],
      updatedAt: String(input.updatedAt || new Date().toISOString()),
    };
  }

  function validateLeg(leg, valuationDate) {
    const value = normalizeLeg(leg);
    const errors = [];
    for (const field of ["quantity", "entryPrice", "commission", ...(value.instrumentType === "option" ? ["strike", "multiplier", "impliedVolatility"] : [])]) {
      if (leg[field] != null && leg[field] !== "" && !Number.isFinite(Number(leg[field]))) errors.push(`La valeur ${field} doit être numérique et finie.`);
    }
    if (!value.id) errors.push("Identifiant de jambe manquant.");
    if (!Number.isFinite(value.quantity) || value.quantity <= 0) errors.push("La quantité doit être supérieure à zéro.");
    if (!Number.isFinite(value.entryPrice) || value.entryPrice < 0) errors.push("La prime ou le prix d’entrée ne peut pas être négatif.");
    if (!Number.isFinite(value.commission) || value.commission < 0) errors.push("La commission ne peut pas être négative.");
    if (value.currentMark != null && (!Number.isFinite(value.currentMark) || value.currentMark < 0)) errors.push("Le prix actuel facultatif est invalide.");
    if (value.instrumentType === "option") {
      if (!Number.isFinite(value.strike) || value.strike <= 0) errors.push("Le strike doit être supérieur à zéro.");
      if (!value.expiration) errors.push("L’échéance est obligatoire.");
      else if (value.expiration < dateOnly(valuationDate)) errors.push("L’échéance ne peut pas précéder la date d’évaluation.");
      if (!Number.isFinite(value.impliedVolatility) || value.impliedVolatility < 0) errors.push("La volatilité ne peut pas être négative.");
      if (!Number.isFinite(value.multiplier) || value.multiplier <= 0) errors.push("Le multiplicateur doit être supérieur à zéro.");
    }
    return { valid: errors.length === 0, errors, value };
  }

  function validateStrategy(strategy) {
    const value = normalizeStrategy(strategy);
    const errors = [];
    for (const field of ["underlyingPrice", "riskFreeRate", "dividendYield", "impliedVolatility", "multiplier", "optionCommission", "stockCommission", "steps"]) {
      if (strategy[field] != null && strategy[field] !== "" && !Number.isFinite(Number(strategy[field]))) errors.push(`La valeur ${field} doit être numérique et finie.`);
    }
    if (strategy.valuationDate != null && !dateOnly(strategy.valuationDate)) errors.push("La date d’évaluation est invalide.");
    if (!value.symbol) errors.push("Le symbole est obligatoire.");
    if (!Number.isFinite(value.underlyingPrice) || value.underlyingPrice < 0) errors.push("Le prix du sous-jacent est invalide.");
    if (!value.valuationDate) errors.push("La date d’évaluation est invalide.");
    if (!Number.isFinite(value.riskFreeRate)) errors.push("Le taux sans risque est invalide.");
    if (!Number.isFinite(value.dividendYield)) errors.push("Le rendement du dividende est invalide.");
    if (!Number.isFinite(value.impliedVolatility) || value.impliedVolatility < 0) errors.push("La volatilité générale est invalide.");
    if (!ALLOWED_STEPS.has(value.steps)) errors.push("Le nombre de pas binomiaux est invalide.");
    const legResults = value.legs.map((leg) => validateLeg(leg, value.valuationDate));
    legResults.forEach((result, index) => result.errors.forEach((error) => errors.push(`Jambe ${index + 1} : ${error}`)));
    return { valid: errors.length === 0, errors, value: { ...value, legs: legResults.map((result) => result.value) } };
  }

  function legInitialCashFlow(leg) {
    if (leg.enabled === false) return 0;
    const sign = positionSign(leg.side);
    const quantity = number(leg.quantity);
    const commission = number(leg.commission);
    if (leg.instrumentType === "stock") return -sign * number(leg.entryPrice) * quantity - commission;
    return -sign * number(leg.entryPrice) * quantity * number(leg.multiplier, 100) - commission;
  }

  function strategyInitialCashFlow(strategy) {
    return round((strategy.legs || []).reduce((sum, leg) => sum + legInitialCashFlow(leg), 0), 4);
  }

  function legExpirationPL(leg, stockPrice) {
    if (leg.enabled === false) return 0;
    const sign = positionSign(leg.side);
    if (leg.instrumentType === "stock") {
      return sign * (number(stockPrice) - number(leg.entryPrice)) * number(leg.quantity) - number(leg.commission);
    }
    const terminal = sign * intrinsicValue(leg.optionType, stockPrice, leg.strike) * number(leg.quantity) * number(leg.multiplier, 100);
    return terminal + legInitialCashFlow(leg);
  }

  function expirationPL(strategy, stockPrice) {
    return round((strategy.legs || []).reduce((sum, leg) => sum + legExpirationPL(leg, stockPrice), 0), 4);
  }

  function americanOptionValue(params = {}) {
    const S = number(params.S, NaN);
    const K = number(params.K, NaN);
    const r = number(params.r, NaN);
    const q = number(params.q, 0);
    const sigma = number(params.sigma, NaN);
    const T = number(params.T, NaN);
    const N = Math.trunc(number(params.N, DEFAULT_STEPS));
    const type = String(params.optionType || "call").toLowerCase() === "put" ? "put" : "call";
    if (![S, K, r, q, sigma, T].every(Number.isFinite) || S < 0 || K <= 0 || sigma < 0 || T < 0) {
      throw new Error("Paramètres binomiaux invalides.");
    }
    if (N < 2 || N > 2000) throw new Error("Nombre de pas binomiaux invalide.");
    if (T <= EPSILON) return intrinsicValue(type, S, K);
    if (sigma <= EPSILON || S <= EPSILON) {
      const terminalSpot = S * Math.exp((r - q) * T);
      const discountedTerminal = Math.exp(-r * T) * intrinsicValue(type, terminalSpot, K);
      return Math.max(intrinsicValue(type, S, K), discountedTerminal);
    }
    const dt = T / N;
    const u = Math.exp(sigma * Math.sqrt(dt));
    const d = 1 / u;
    const denominator = u - d;
    const p = (Math.exp((r - q) * dt) - d) / denominator;
    const discount = Math.exp(-r * dt);
    if (![dt, u, d, p, discount].every(Number.isFinite) || denominator <= 0 || p < 0 || p > 1) {
      throw new Error("Probabilité binomiale invalide pour les hypothèses saisies.");
    }
    const values = new Float64Array(N + 1);
    for (let j = 0; j <= N; j += 1) {
      const nodeSpot = S * (u ** j) * (d ** (N - j));
      values[j] = intrinsicValue(type, nodeSpot, K);
    }
    for (let step = N - 1; step >= 0; step -= 1) {
      for (let j = 0; j <= step; j += 1) {
        const nodeSpot = S * (u ** j) * (d ** (step - j));
        const continuation = discount * (p * values[j + 1] + (1 - p) * values[j]);
        values[j] = Math.max(continuation, intrinsicValue(type, nodeSpot, K));
      }
    }
    if (!Number.isFinite(values[0])) throw new Error("Valeur binomiale non finie.");
    return values[0];
  }

  function optionValueAt(leg, strategy, stockPrice, analysisDate) {
    const expiration = dateOnly(leg.expiration);
    const date = dateOnly(analysisDate) || strategy.valuationDate;
    if (!expiration || date >= expiration) return intrinsicValue(leg.optionType, stockPrice, leg.strike);
    const T = yearFraction(date, expiration);
    return americanOptionValue({
      S: stockPrice,
      K: leg.strike,
      r: strategy.riskFreeRate,
      q: strategy.dividendYield,
      sigma: Number.isFinite(leg.impliedVolatility) ? leg.impliedVolatility : strategy.impliedVolatility,
      T,
      N: strategy.steps,
      optionType: leg.optionType,
    });
  }

  function strategyPLAtDate(strategy, stockPrice, analysisDate) {
    return round((strategy.legs || []).reduce((sum, leg) => {
      if (leg.enabled === false) return sum;
      if (leg.instrumentType === "stock") return sum + legExpirationPL(leg, stockPrice);
      const value = optionValueAt(leg, strategy, stockPrice, analysisDate);
      return sum + positionSign(leg.side) * value * leg.quantity * leg.multiplier + legInitialCashFlow(leg);
    }, 0), 4);
  }

  function optionGreeks(leg, strategy, stockPrice, analysisDate) {
    if (leg.enabled === false || leg.instrumentType !== "option") return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    const S = Math.max(0.01, number(stockPrice));
    const T = yearFraction(analysisDate, leg.expiration);
    if (!Number.isFinite(T) || T <= 0) return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    const sigma = Number.isFinite(leg.impliedVolatility) ? leg.impliedVolatility : strategy.impliedVolatility;
    const h = Math.max(S * 0.01, 0.01);
    const base = { K: leg.strike, r: strategy.riskFreeRate, q: strategy.dividendYield, sigma, T, N: strategy.steps, optionType: leg.optionType };
    const v0 = americanOptionValue({ ...base, S });
    const up = americanOptionValue({ ...base, S: S + h });
    const down = americanOptionValue({ ...base, S: Math.max(0.0001, S - h) });
    const vegaValue = americanOptionValue({ ...base, S, sigma: sigma + 0.01 }) - v0;
    const rhoValue = americanOptionValue({ ...base, S, r: strategy.riskFreeRate + 0.01 }) - v0;
    const thetaValue = T <= 1 / 365 ? intrinsicValue(leg.optionType, S, leg.strike) - v0 : americanOptionValue({ ...base, S, T: T - 1 / 365 }) - v0;
    const scale = positionSign(leg.side) * leg.quantity * leg.multiplier;
    return {
      delta: ((up - down) / (2 * h)) * scale,
      gamma: ((up - 2 * v0 + down) / (h ** 2)) * scale,
      theta: thetaValue * scale,
      vega: vegaValue * scale,
      rho: rhoValue * scale,
    };
  }

  function strategyGreeks(strategy, stockPrice = strategy.underlyingPrice, analysisDate = strategy.analysisDate) {
    return (strategy.legs || []).reduce((total, leg) => {
      if (leg.enabled === false) return total;
      if (leg.instrumentType === "stock") {
        total.delta += positionSign(leg.side) * leg.quantity;
        return total;
      }
      const legGreeks = optionGreeks(leg, strategy, stockPrice, analysisDate);
      Object.keys(total).forEach((key) => { total[key] += legGreeks[key]; });
      return total;
    }, { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 });
  }

  function uniqueExpirations(strategy) {
    return [...new Set((strategy.legs || []).filter((leg) => leg.enabled !== false && leg.instrumentType === "option").map((leg) => leg.expiration).filter(Boolean))].sort();
  }

  function refineRoot(strategy, left, right) {
    let a = left;
    let b = right;
    let fa = expirationPL(strategy, a);
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const mid = (a + b) / 2;
      const fm = expirationPL(strategy, mid);
      if (Math.abs(fm) < 1e-7) return mid;
      if ((fa <= 0 && fm >= 0) || (fa >= 0 && fm <= 0)) b = mid;
      else { a = mid; fa = fm; }
    }
    return (a + b) / 2;
  }

  function breakEvens(strategy) {
    if (!(strategy.legs || []).some((leg) => leg.enabled !== false && leg.quantity > 0)) return [];
    if (uniqueExpirations(strategy).length > 1) return [];
    const strikes = (strategy.legs || []).filter((leg) => leg.enabled !== false && leg.instrumentType === "option").map((leg) => leg.strike).filter(Number.isFinite);
    const maxAnchor = Math.max(strategy.underlyingPrice, ...strikes, 1);
    const maxPrice = maxAnchor * 8 + 10;
    const points = 2400;
    const roots = [];
    let previousX = 0;
    let previousY = expirationPL(strategy, 0);
    if (Math.abs(previousY) < 1e-7) roots.push(0);
    for (let index = 1; index <= points; index += 1) {
      const x = maxPrice * index / points;
      const y = expirationPL(strategy, x);
      if (Math.abs(y) < 1e-7) roots.push(x);
      else if ((previousY < 0 && y > 0) || (previousY > 0 && y < 0)) roots.push(refineRoot(strategy, previousX, x));
      previousX = x;
      previousY = y;
    }
    return [...new Set(roots.map((root) => round(root, 4)))];
  }

  function tailSlope(strategy) {
    return (strategy.legs || []).reduce((slope, leg) => {
      if (leg.enabled === false) return slope;
      const sign = positionSign(leg.side);
      if (leg.instrumentType === "stock") return slope + sign * leg.quantity;
      if (leg.optionType === "call") return slope + sign * leg.quantity * leg.multiplier;
      return slope;
    }, 0);
  }

  function maxProfitLoss(strategy) {
    if (uniqueExpirations(strategy).length > 1) {
      return { maxProfit: null, maxLoss: null, maxProfitLabel: "Non déterminable avec certitude", maxLossLabel: "Non déterminable avec certitude" };
    }
    const strikes = (strategy.legs || []).filter((leg) => leg.enabled !== false && leg.instrumentType === "option").map((leg) => leg.strike);
    const candidates = [0, ...strikes].map((price) => expirationPL(strategy, price));
    const slope = tailSlope(strategy);
    const finiteMax = Math.max(...candidates);
    const finiteMin = Math.min(...candidates);
    return {
      maxProfit: slope > EPSILON ? Infinity : round(finiteMax, 2),
      maxLoss: slope < -EPSILON ? -Infinity : round(finiteMin, 2),
      maxProfitLabel: slope > EPSILON ? "Illimité" : null,
      maxLossLabel: slope < -EPSILON ? "Illimitée" : null,
    };
  }

  function capitalRequirement(strategy) {
    const active = (strategy.legs || []).filter((leg) => leg.enabled !== false);
    const shortPuts = active.filter((leg) => leg.instrumentType === "option" && leg.optionType === "put" && leg.side === "short");
    const longPuts = active.filter((leg) => leg.instrumentType === "option" && leg.optionType === "put" && leg.side === "long");
    const shortCalls = active.filter((leg) => leg.instrumentType === "option" && leg.optionType === "call" && leg.side === "short");
    const longShares = active.filter((leg) => leg.instrumentType === "stock" && leg.side === "long").reduce((sum, leg) => sum + leg.quantity, 0);
    const credit = Math.max(0, strategyInitialCashFlow(strategy));
    if (shortPuts.length === 1 && !longPuts.length && !shortCalls.length) {
      const leg = shortPuts[0];
      return { amount: Math.max(0, leg.strike * leg.multiplier * leg.quantity - credit), method: "Put garanti en espèces", estimated: false };
    }
    if (shortCalls.length && longShares >= shortCalls.reduce((sum, leg) => sum + leg.quantity * leg.multiplier, 0)) {
      return { amount: Math.max(0, longShares * strategy.underlyingPrice), method: "Actions de couverture", estimated: true };
    }
    const limits = maxProfitLoss(strategy);
    if (Number.isFinite(limits.maxLoss)) {
      return { amount: Math.max(0, -limits.maxLoss), method: "Perte maximale définie", estimated: true };
    }
    return { amount: null, method: "Structure complexe ou risque illimité", estimated: true };
  }

  function priceRange(strategy, breakEvenValues = []) {
    const spot = Math.max(0.01, strategy.underlyingPrice);
    if (strategy.rangeMode === "custom" && strategy.rangeMax > strategy.rangeMin && strategy.rangeMin >= 0) return { min: strategy.rangeMin, max: strategy.rangeMax };
    if (["10", "20", "30"].includes(strategy.rangeMode)) {
      const pct = Number(strategy.rangeMode) / 100;
      return { min: Math.max(0, spot * (1 - pct)), max: spot * (1 + pct) };
    }
    const strikes = strategy.legs.filter((leg) => leg.enabled !== false && leg.instrumentType === "option").map((leg) => leg.strike);
    const anchors = [spot, ...strikes, ...breakEvenValues].filter(Number.isFinite);
    const minAnchor = Math.min(...anchors);
    const maxAnchor = Math.max(...anchors);
    const margin = Math.max(spot * 0.2, (maxAnchor - minAnchor) * 0.25, 1);
    return { min: Math.max(0, minAnchor - margin), max: maxAnchor + margin };
  }

  function analyze(strategyInput) {
    const validation = validateStrategy(strategyInput);
    const strategy = validation.value;
    const expirations = uniqueExpirations(strategy);
    const multiExpiration = expirations.length > 1;
    const breakEvenValues = breakEvens(strategy);
    const limits = maxProfitLoss(strategy);
    const capital = capitalRequirement(strategy);
    const greeks = strategyGreeks(strategy);
    const initialCashFlow = strategyInitialCashFlow(strategy);
    const currentPL = strategyPLAtDate(strategy, strategy.underlyingPrice, strategy.analysisDate);
    return {
      strategy,
      valid: validation.valid,
      errors: validation.errors,
      initialCashFlow,
      flowType: initialCashFlow >= 0 ? "Crédit net" : "Débit net",
      capital,
      maxProfit: limits.maxProfit,
      maxLoss: limits.maxLoss,
      maxProfitLabel: limits.maxProfitLabel,
      maxLossLabel: limits.maxLossLabel,
      breakEvens: breakEvenValues,
      currentPL,
      returnOnCapital: capital.amount > 0 ? currentPL / capital.amount : null,
      greeks,
      expirations,
      multiExpiration,
      projectionLabel: multiExpiration ? "Projection multéchéance — estimation" : "Profit/perte à l’échéance",
      range: priceRange(strategy, breakEvenValues),
      daysToExpiration: expirations.length ? Math.max(0, Math.round(yearFraction(strategy.valuationDate, expirations[0]) * 365)) : null,
      warning: capital.estimated ? "Exigence de capital estimative — à confirmer auprès du courtier." : "",
    };
  }

  function leg(input) {
    return normalizeLeg(input);
  }

  const TEMPLATE_NAMES = [
    "custom", "long-call", "long-put", "covered-call", "cash-secured-put", "covered-strangle",
    "bull-call-spread", "bear-put-spread", "bull-put-spread", "bear-call-spread", "iron-condor",
    "iron-butterfly", "calendar-call", "calendar-put", "diagonal-call", "diagonal-put",
    "double-diagonal", "pmcc", "ford-wheel-csp", "ford-wheel-covered-call",
  ];

  function createTemplate(templateName, base = {}) {
    const strategy = normalizeStrategy(base);
    const name = TEMPLATE_NAMES.includes(templateName) ? templateName : "custom";
    const S = Math.max(1, strategy.underlyingPrice || 15);
    const low = round(S * 0.9, 2);
    const high = round(S * 1.1, 2);
    const widerLow = round(S * 0.8, 2);
    const widerHigh = round(S * 1.2, 2);
    const near = addDays(strategy.valuationDate, 60);
    const far = addDays(strategy.valuationDate, 365);
    const opt = (optionType, side, strike, expiration = near, entryPrice = 1) => leg({ instrumentType: "option", optionType, side, quantity: 1, multiplier: strategy.multiplier, strike, expiration, entryPrice, impliedVolatility: strategy.impliedVolatility, commission: strategy.optionCommission });
    const stock = (side = "long") => leg({ instrumentType: "stock", side, quantity: 100, entryPrice: S, commission: strategy.stockCommission });
    const templates = {
      custom: [],
      "long-call": [opt("call", "long", high)],
      "long-put": [opt("put", "long", low)],
      "covered-call": [stock(), opt("call", "short", high)],
      "cash-secured-put": [opt("put", "short", low)],
      "covered-strangle": [stock(), opt("put", "short", low), opt("call", "short", high)],
      "bull-call-spread": [opt("call", "long", low, near, 1.5), opt("call", "short", high, near, 0.5)],
      "bear-put-spread": [opt("put", "long", high, near, 1.5), opt("put", "short", low, near, 0.5)],
      "bull-put-spread": [opt("put", "short", high, near, 1.5), opt("put", "long", low, near, 0.5)],
      "bear-call-spread": [opt("call", "short", low, near, 1.5), opt("call", "long", high, near, 0.5)],
      "iron-condor": [opt("put", "long", widerLow, near, 0.3), opt("put", "short", low, near, 0.8), opt("call", "short", high, near, 0.8), opt("call", "long", widerHigh, near, 0.3)],
      "iron-butterfly": [opt("put", "long", low, near, 0.4), opt("put", "short", S, near, 1), opt("call", "short", S, near, 1), opt("call", "long", high, near, 0.4)],
      "calendar-call": [opt("call", "short", S, near, 0.6), opt("call", "long", S, far, 1.6)],
      "calendar-put": [opt("put", "short", S, near, 0.6), opt("put", "long", S, far, 1.6)],
      "diagonal-call": [opt("call", "short", high, near, 0.5), opt("call", "long", low, far, 2)],
      "diagonal-put": [opt("put", "short", low, near, 0.5), opt("put", "long", high, far, 2)],
      "double-diagonal": [opt("put", "short", low, near, 0.5), opt("put", "long", widerLow, far, 1.2), opt("call", "short", high, near, 0.5), opt("call", "long", widerHigh, far, 1.2)],
      pmcc: [opt("call", "long", widerLow, far, 3), opt("call", "short", high, near, 0.5)],
      "ford-wheel-csp": [opt("put", "short", low, near, 0.5)],
      "ford-wheel-covered-call": [stock(), opt("call", "short", high, near, 0.5)],
    };
    return { ...strategy, name: name === "custom" ? "Stratégie personnalisée" : name.replaceAll("-", " "), legs: templates[name].map((item, index) => ({ ...item, id: `leg-${Date.now()}-${index + 1}` })) };
  }

  const api = {
    DAY_MS,
    DEFAULT_STEPS,
    ALLOWED_STEPS,
    TEMPLATE_NAMES,
    addDays,
    yearFraction,
    positionSign,
    intrinsicValue,
    normalizeLeg,
    normalizeStrategy,
    validateLeg,
    validateStrategy,
    legInitialCashFlow,
    strategyInitialCashFlow,
    legExpirationPL,
    expirationPL,
    americanOptionValue,
    optionValueAt,
    strategyPLAtDate,
    optionGreeks,
    strategyGreeks,
    uniqueExpirations,
    breakEvens,
    maxProfitLoss,
    capitalRequirement,
    priceRange,
    analyze,
    createTemplate,
    round,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.OptionsStrategyEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
