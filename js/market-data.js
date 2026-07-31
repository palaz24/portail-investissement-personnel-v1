(function initMarketData(globalScope) {
  "use strict";

  const ALLOWED_UNDERLYINGS = new Set(["F", "SPY"]);
  const MANUAL_COOLDOWN_MS = 5 * 60 * 1000;
  const AUTO_REFRESH_MS = 60 * 60 * 1000;
  const PRICE_HISTORY_BUCKET_MS = 15 * 60 * 1000;
  const PRICE_HISTORY_LIMIT = 5000;
  const DEFAULT_WORKER_URL = "https://portail-investissement-market-prices.palazz24.workers.dev";
  const META_STORAGE_KEY = "portailInvestissementV1MarketDataMeta";

  function numberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function midpoint(bid, ask) {
    const validBid = numberOrNull(bid);
    const validAsk = numberOrNull(ask);
    return validBid != null && validAsk != null && validAsk >= validBid
      ? (validBid + validAsk) / 2
      : null;
  }

  function selectStockPrice(quote) {
    return numberOrNull(quote?.price)
      ?? numberOrNull(quote?.mid)
      ?? numberOrNull(quote?.last);
  }

  function selectOptionPrice(quote) {
    return midpoint(quote?.bid, quote?.ask)
      ?? numberOrNull(quote?.mid)
      ?? numberOrNull(quote?.last);
  }

  function buildOccSymbol(option) {
    const symbol = String(option?.symbol || "").trim().toUpperCase();
    const expiration = String(option?.expiration || "");
    const optionType = String(option?.optionType || "").toUpperCase();
    const strike = Number(option?.strike);
    if (!ALLOWED_UNDERLYINGS.has(symbol)) throw new Error("Sous-jacent non autorisé.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiration) || Number.isNaN(new Date(`${expiration}T12:00:00Z`).getTime())) {
      throw new Error("Échéance d’option invalide.");
    }
    if (!["CALL", "PUT"].includes(optionType)) throw new Error("Type d’option invalide.");
    if (!Number.isFinite(strike) || strike <= 0 || Math.round(strike * 1000) > 99999999) {
      throw new Error("Prix d’exercice invalide.");
    }
    const date = expiration.slice(2).replaceAll("-", "");
    const side = optionType === "CALL" ? "C" : "P";
    const strikePart = String(Math.round(strike * 1000)).padStart(8, "0");
    return `${symbol}${date}${side}${strikePart}`;
  }

  function buildQuoteRequest(state, derived) {
    const stocks = [...new Set(
      (state?.securities || [])
        .filter((security) => security.active !== false)
        .map((security) => String(security.symbol || "").toUpperCase())
        .filter((symbol) => ALLOWED_UNDERLYINGS.has(symbol))
    )].sort();
    const options = [...new Set(
      (derived?.openOptions || [])
        .filter((option) => ALLOWED_UNDERLYINGS.has(String(option.symbol || "").toUpperCase()))
        .map(buildOccSymbol)
    )].sort();
    return { stocks, options };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function appendRealPricePoint(priceHistory, point) {
    const next = clone(priceHistory || {});
    const symbol = String(point?.symbol || "").trim().toUpperCase();
    const price = Number(point?.price);
    const at = new Date(point?.at);
    if (
      !ALLOWED_UNDERLYINGS.has(symbol)
      || !Number.isFinite(price)
      || price <= 0
      || Number.isNaN(at.getTime())
      || point?.source !== "Market Data"
    ) return next;
    const normalizedPoint = {
      symbol,
      price,
      at: at.toISOString(),
      source: "Market Data",
      currency: String(point.currency || "USD").toUpperCase(),
    };
    const bucket = Math.floor(at.getTime() / PRICE_HISTORY_BUCKET_MS);
    const points = Array.isArray(next[symbol]) ? next[symbol].slice() : [];
    const existingIndex = points.findIndex((item) => (
      Math.floor(new Date(item.at).getTime() / PRICE_HISTORY_BUCKET_MS) === bucket
    ));
    if (existingIndex >= 0) {
      if (new Date(points[existingIndex].at) <= at) points[existingIndex] = normalizedPoint;
    } else {
      points.push(normalizedPoint);
    }
    next[symbol] = points
      .filter((item) => !Number.isNaN(new Date(item.at).getTime()))
      .sort((a, b) => new Date(a.at) - new Date(b.at))
      .slice(-PRICE_HISTORY_LIMIT);
    return next;
  }

  function optionContractMap(derived) {
    const map = new Map();
    for (const option of derived?.openOptions || []) {
      try {
        map.set(buildOccSymbol(option), option.contractId);
      } catch {
        // Une option locale invalide est exclue de la requête.
      }
    }
    return map;
  }

  function applyQuoteResponse(state, derived, response) {
    const next = clone(state);
    next.prices = clone(state?.prices || {});
    next.optionPrices = clone(state?.optionPrices || {});
    next.priceHistory = clone(state?.priceHistory || {});
    const errors = [...(response?.errors || [])];
    let stocksUpdated = 0;
    let optionsUpdated = 0;

    for (const [symbol, quote] of Object.entries(response?.stocks || {})) {
      if (!ALLOWED_UNDERLYINGS.has(symbol)) continue;
      const price = selectStockPrice(quote);
      if (price == null) {
        errors.push(`Aucun prix fiable pour ${symbol}; ancien prix conservé.`);
        continue;
      }
      next.prices[symbol] = {
        price,
        bid: numberOrNull(quote.bid),
        ask: numberOrNull(quote.ask),
        source: "Market Data",
        dataType: response.dataType || "REALTIME_OR_DELAYED",
        updatedAt: quote.updatedAt || response.retrievedAt
      };
      const currency = state?.securities?.find((security) => security.symbol === symbol)?.currency || "USD";
      next.priceHistory = appendRealPricePoint(next.priceHistory, {
        symbol,
        price,
        at: quote.updatedAt || response.retrievedAt,
        source: "Market Data",
        currency
      });
      stocksUpdated += 1;
    }

    const contractMap = optionContractMap(derived);
    for (const [occSymbol, quote] of Object.entries(response?.options || {})) {
      const contractId = contractMap.get(occSymbol);
      if (!contractId) continue;
      const price = selectOptionPrice(quote);
      if (price == null) {
        errors.push(`Aucun prix fiable pour ${occSymbol}; ancien prix conservé.`);
        continue;
      }
      next.optionPrices[contractId] = {
        price,
        bid: numberOrNull(quote.bid),
        ask: numberOrNull(quote.ask),
        last: numberOrNull(quote.last),
        occSymbol,
        source: "Market Data",
        dataType: response.dataType || "REALTIME_OR_DELAYED",
        updatedAt: quote.updatedAt || response.retrievedAt
      };
      optionsUpdated += 1;
    }

    next.updatedAt = response?.retrievedAt || new Date().toISOString();
    return { next, stocksUpdated, optionsUpdated, errors };
  }

  async function fetchQuotes(workerUrl, request, fetchImpl = globalScope.fetch) {
    const url = String(workerUrl || "").trim();
    if (!/^https:\/\/[a-z0-9.-]+(?:\/quotes)?$/i.test(url) && !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/quotes)?$/i.test(url)) {
      throw new Error("L’URL du service de prix est absente ou invalide.");
    }
    const endpoint = url.endsWith("/quotes") ? url : `${url.replace(/\/$/, "")}/quotes`;
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stocks: request.stocks, options: request.options })
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Le service de prix a retourné une réponse invalide.");
    }
    if (!response.ok || payload?.success !== true) {
      throw new Error("Le service de prix est temporairement indisponible.");
    }
    return payload;
  }

  function readMeta() {
    try {
      return JSON.parse(globalScope.localStorage?.getItem(META_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function writeMeta(meta) {
    try {
      globalScope.localStorage?.setItem(META_STORAGE_KEY, JSON.stringify(meta));
    } catch {
      // Le portail continue de fonctionner sans ce journal d’état.
    }
  }

  const api = {
    ALLOWED_UNDERLYINGS,
    MANUAL_COOLDOWN_MS,
    AUTO_REFRESH_MS,
    PRICE_HISTORY_BUCKET_MS,
    PRICE_HISTORY_LIMIT,
    DEFAULT_WORKER_URL,
    META_STORAGE_KEY,
    numberOrNull,
    midpoint,
    selectStockPrice,
    selectOptionPrice,
    buildOccSymbol,
    buildQuoteRequest,
    appendRealPricePoint,
    applyQuoteResponse,
    fetchQuotes,
    readMeta,
    writeMeta
  };

  globalScope.PortalMarketData = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
