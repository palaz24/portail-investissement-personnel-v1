(function initOptionsStorage(globalScope) {
  "use strict";

  const Engine = typeof require === "function" ? require("./options-engine.js") : globalScope.OptionsStrategyEngine;
  const NAMESPACE = "optionsStrategyStudio.v1";
  const SCHEMA = "options-strategy-studio";
  const VERSION = 1;
  const MAX_IMPORT_LENGTH = 500000;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultState() {
    return { schemaVersion: VERSION, strategies: [], preferences: { theme: "dark" }, settings: {}, lastStrategy: null };
  }

  function safeStorage(storage) {
    if (storage) return storage;
    try { return globalScope.localStorage || null; } catch { return null; }
  }

  function sanitizeState(input) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    return {
      schemaVersion: VERSION,
      strategies: Array.isArray(source.strategies) ? source.strategies.slice(0, 100).map(Engine.normalizeStrategy) : [],
      preferences: source.preferences && typeof source.preferences === "object" ? { theme: source.preferences.theme === "light" ? "light" : "dark" } : { theme: "dark" },
      settings: source.settings && typeof source.settings === "object" ? { tableStep: Math.max(0.01, Number(source.settings.tableStep) || 1) } : {},
      lastStrategy: source.lastStrategy ? Engine.normalizeStrategy(source.lastStrategy) : null,
    };
  }

  function load(storage) {
    const target = safeStorage(storage);
    if (!target) return defaultState();
    try {
      const raw = target.getItem(NAMESPACE);
      return raw ? sanitizeState(JSON.parse(raw)) : defaultState();
    } catch {
      return defaultState();
    }
  }

  function save(state, storage) {
    const target = safeStorage(storage);
    const clean = sanitizeState(state);
    if (target) target.setItem(NAMESPACE, JSON.stringify(clean));
    return clean;
  }

  function saveStrategy(strategy, storage) {
    const state = load(storage);
    const clean = Engine.normalizeStrategy(strategy);
    const index = state.strategies.findIndex((item) => item.id === clean.id);
    if (index >= 0) state.strategies[index] = clean;
    else state.strategies.unshift(clean);
    state.lastStrategy = clean;
    return save(state, storage);
  }

  function deleteStrategy(id, storage) {
    const state = load(storage);
    state.strategies = state.strategies.filter((item) => item.id !== id);
    if (state.lastStrategy?.id === id) state.lastStrategy = null;
    return save(state, storage);
  }

  function exportDocument(strategy, exportedAt = new Date().toISOString()) {
    return { schema: SCHEMA, version: VERSION, exportedAt, strategy: Engine.normalizeStrategy(strategy) };
  }

  function dangerousObject(value, depth = 0) {
    if (depth > 12) return true;
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some((item) => dangerousObject(item, depth + 1));
    return Object.keys(value).some((key) => ["__proto__", "prototype", "constructor"].includes(key) || dangerousObject(value[key], depth + 1));
  }

  function importDocument(input) {
    try {
      const raw = typeof input === "string" ? input : JSON.stringify(input);
      if (!raw || raw.length > MAX_IMPORT_LENGTH) return { valid: false, errors: ["Le fichier est vide ou trop volumineux."] };
      const parsed = typeof input === "string" ? JSON.parse(input) : clone(input);
      if (dangerousObject(parsed)) return { valid: false, errors: ["La structure contient une propriété interdite."] };
      if (parsed?.schema !== SCHEMA) return { valid: false, errors: ["Schéma de stratégie incompatible."] };
      if (parsed?.version !== VERSION) return { valid: false, errors: ["Version de stratégie incompatible."] };
      const validation = Engine.validateStrategy(parsed.strategy);
      if (!validation.valid) return { valid: false, errors: validation.errors };
      return { valid: true, value: validation.value, errors: [] };
    } catch (error) {
      return { valid: false, errors: [`JSON invalide : ${String(error.message).slice(0, 120)}`] };
    }
  }

  function publicLeg(leg) {
    const normalized = Engine.normalizeLeg(leg);
    return {
      id: normalized.id,
      enabled: normalized.enabled,
      instrumentType: normalized.instrumentType,
      optionType: normalized.optionType,
      side: normalized.side,
      quantity: normalized.quantity,
      multiplier: normalized.multiplier,
      strike: normalized.strike,
      expiration: normalized.expiration,
      entryPrice: normalized.entryPrice,
      impliedVolatility: normalized.impliedVolatility,
      commission: normalized.commission,
      label: normalized.label,
    };
  }

  function publicStrategy(strategy) {
    const value = Engine.normalizeStrategy(strategy);
    return {
      schema: SCHEMA,
      version: VERSION,
      strategy: {
        name: value.name,
        symbol: value.symbol,
        securityName: value.securityName,
        underlyingPrice: value.underlyingPrice,
        currency: value.currency,
        valuationDate: value.valuationDate,
        analysisDate: value.analysisDate,
        riskFreeRate: value.riskFreeRate,
        dividendYield: value.dividendYield,
        impliedVolatility: value.impliedVolatility,
        multiplier: value.multiplier,
        optionCommission: value.optionCommission,
        stockCommission: value.stockCommission,
        steps: value.steps,
        pricingMethod: value.pricingMethod,
        rangeMode: value.rangeMode,
        rangeMin: value.rangeMin,
        rangeMax: value.rangeMax,
        tableStep: value.tableStep,
        legs: value.legs.map(publicLeg),
      },
    };
  }

  function encodeBase64Url(text) {
    if (typeof Buffer !== "undefined") return Buffer.from(text, "utf8").toString("base64url");
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
  }

  function decodeBase64Url(text) {
    if (typeof Buffer !== "undefined") return Buffer.from(text, "base64url").toString("utf8");
    const padded = text.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  }

  function createShareFragment(strategy) {
    return `#strategy=${encodeBase64Url(JSON.stringify(publicStrategy(strategy)))}`;
  }

  function parseShareFragment(fragment) {
    const match = String(fragment || "").match(/(?:^#|&)strategy=([^&]+)/);
    if (!match) return { valid: false, errors: ["Aucune stratégie partagée dans l’URL."] };
    try {
      const parsed = JSON.parse(decodeBase64Url(decodeURIComponent(match[1])));
      return importDocument(parsed);
    } catch {
      return { valid: false, errors: ["Le fragment de partage est invalide."] };
    }
  }

  const api = {
    NAMESPACE,
    SCHEMA,
    VERSION,
    defaultState,
    sanitizeState,
    load,
    save,
    saveStrategy,
    deleteStrategy,
    exportDocument,
    importDocument,
    publicStrategy,
    createShareFragment,
    parseShareFragment,
    clone,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.OptionsStrategyStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
