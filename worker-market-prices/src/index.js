const ALLOWED_ORIGIN = "https://palaz24.github.io";
const ALLOWED_STOCKS = new Set(["F", "SPY"]);
const STOCK_PATTERN = /^(F|SPY)$/;
const OCC_PATTERN = /^(F|SPY)\d{6}[CP]\d{8}$/;
const CACHE_SECONDS = 15 * 60;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 30;
const localRateState = new Map();

function corsOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (origin === ALLOWED_ORIGIN) return origin;
  if (/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)) return origin;
  return "";
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, max-age=0, no-store"
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

function safeError(message) {
  return String(message || "Erreur du fournisseur.")
    .replace(/bearer\s+[^\s]+/gi, "Bearer [MASQUÉ]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[MASQUÉ]")
    .slice(0, 180);
}

function validatePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, errors: ["Le corps JSON doit être un objet."] };
  }
  const keys = Object.keys(payload);
  if (keys.some((key) => !["stocks", "options"].includes(key))) {
    errors.push("Le corps contient un champ interdit.");
  }
  if (!Array.isArray(payload.stocks) || !Array.isArray(payload.options)) {
    errors.push("Les listes stocks et options sont obligatoires.");
    return { valid: false, errors };
  }
  if (payload.stocks.length > 10) errors.push("Maximum de 10 symboles d’actions ou FNB.");
  if (payload.options.length > 20) errors.push("Maximum de 20 contrats d’options.");
  if (payload.stocks.some((symbol) => !STOCK_PATTERN.test(String(symbol)))) {
    errors.push("Un symbole d’action ou FNB est interdit.");
  }
  if (payload.options.some((symbol) => !OCC_PATTERN.test(String(symbol)))) {
    errors.push("Un symbole OCC est invalide ou interdit.");
  }
  return { valid: errors.length === 0, errors };
}

function arrayValue(payload, field, index) {
  const value = Array.isArray(payload?.[field]) ? payload[field][index] : undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

  function isoTimestamp(value, fallback) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return new Date(parsed * 1000).toISOString();
  const direct = new Date(value);
  return Number.isNaN(direct.getTime()) ? fallback : direct.toISOString();
}

function normalizeStockPayload(payload, symbols, retrievedAt) {
  const normalized = {};
  const providerSymbols = Array.isArray(payload?.symbol) ? payload.symbol : symbols;
  providerSymbols.forEach((symbol, index) => {
    if (!ALLOWED_STOCKS.has(symbol)) return;
    const price = arrayValue(payload, "price", index) ?? arrayValue(payload, "mid", index);
    const mid = arrayValue(payload, "mid", index);
    const last = arrayValue(payload, "last", index);
    const bid = arrayValue(payload, "bid", index);
    const ask = arrayValue(payload, "ask", index);
    const selected = [price, mid, last].find((value) => Number.isFinite(value) && value > 0);
    if (selected == null) return;
    normalized[symbol] = {
      price: selected,
      bid,
      ask,
      updatedAt: isoTimestamp(Array.isArray(payload?.updated) ? payload.updated[index] : null, retrievedAt)
    };
  });
  return normalized;
}

function normalizeOptionPayload(payload, occSymbol, retrievedAt) {
  const bid = arrayValue(payload, "bid", 0);
  const ask = arrayValue(payload, "ask", 0);
  const mid = arrayValue(payload, "mid", 0);
  const last = arrayValue(payload, "last", 0);
  const validMidpoint = bid > 0 && ask > 0 && ask >= bid ? (bid + ask) / 2 : null;
  const price = [validMidpoint, mid, last].find((value) => Number.isFinite(value) && value > 0);
  if (price == null) return null;
  return {
    price,
    bid,
    ask,
    last,
    updatedAt: isoTimestamp(Array.isArray(payload?.updated) ? payload.updated[0] : null, retrievedAt)
  };
}

async function providerJson(url, token, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`
    }
  });
  if (![200, 203].includes(response.status)) {
    throw new Error(`Fournisseur indisponible (${response.status}).`);
  }
  const payload = await response.json();
  if (payload?.s && !["ok", "success"].includes(payload.s)) {
    throw new Error(payload.errmsg || "Aucune donnée.");
  }
  return payload;
}

async function fetchStocks(symbols, token, fetchImpl, retrievedAt) {
  if (!symbols.length) return { values: {}, errors: [] };
  const joined = encodeURIComponent(symbols.join(","));
  const errors = [];
  try {
    const prices = await providerJson(
      `https://api.marketdata.app/v1/stocks/prices/?symbols=${joined}`,
      token,
      fetchImpl
    );
    const values = normalizeStockPayload(prices, symbols, retrievedAt);
    if (Object.keys(values).length === symbols.length) return { values, errors };
  } catch (error) {
    errors.push(`Prix d’actions principal indisponible : ${safeError(error.message)}`);
  }
  try {
    const quotes = await providerJson(
      `https://api.marketdata.app/v1/stocks/quotes/?symbols=${joined}`,
      token,
      fetchImpl
    );
    return { values: normalizeStockPayload(quotes, symbols, retrievedAt), errors };
  } catch (error) {
    errors.push(`Prix d’actions de secours indisponible : ${safeError(error.message)}`);
    return { values: {}, errors };
  }
}

async function mapWithConcurrency(items, limit, callback) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await callback(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function fetchOptions(options, token, fetchImpl, retrievedAt) {
  const errors = [];
  const values = {};
  await mapWithConcurrency(options, 5, async (occSymbol) => {
    try {
      const payload = await providerJson(
        `https://api.marketdata.app/v1/options/quotes/${encodeURIComponent(occSymbol)}/`,
        token,
        fetchImpl
      );
      const normalized = normalizeOptionPayload(payload, occSymbol, retrievedAt);
      if (normalized) values[occSymbol] = normalized;
      else errors.push(`Aucun prix fiable pour ${occSymbol}.`);
    } catch (error) {
      errors.push(`Option ${occSymbol} indisponible : ${safeError(error.message)}`);
    }
  });
  return { values, errors };
}

function rateAllowed(origin, now = Date.now()) {
  const current = localRateState.get(origin);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    localRateState.set(origin, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= RATE_LIMIT;
}

function cacheKey(request, payload) {
  const url = new URL(request.url);
  url.pathname = "/quotes";
  url.search = new URLSearchParams({
    stocks: [...payload.stocks].sort().join(","),
    options: [...payload.options].sort().join(",")
  }).toString();
  return new Request(url.toString(), { method: "GET" });
}

async function handleQuotes(request, env, context, dependencies = {}) {
  const origin = corsOrigin(request);
  if (!origin) return json({ success: false, errors: ["Origine refusée."] }, 403, "null");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return json({ success: false, errors: ["Méthode refusée."] }, 405, origin);
  const url = new URL(request.url);
  if (url.pathname !== "/quotes") return json({ success: false, errors: ["Route introuvable."] }, 404, origin);
  if (!rateAllowed(origin)) return json({ success: false, errors: ["Trop de requêtes; réessayez plus tard."] }, 429, origin);
  if (!env?.MARKETDATA_TOKEN) return json({ success: false, errors: ["Service non configuré."] }, 503, origin);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, errors: ["Corps JSON invalide."] }, 400, origin);
  }
  const validation = validatePayload(payload);
  if (!validation.valid) return json({ success: false, errors: validation.errors }, 400, origin);

  const cache = dependencies.cache || globalThis.caches?.default;
  const key = cacheKey(request, payload);
  const cached = cache ? await cache.match(key) : null;
  if (cached) {
    const response = new Response(cached.body, cached);
    Object.entries(corsHeaders(origin)).forEach(([name, value]) => response.headers.set(name, value));
    response.headers.set("X-Portal-Cache", "HIT");
    return response;
  }

  const retrievedAt = new Date().toISOString();
  const fetchImpl = dependencies.fetchImpl || fetch;
  const stocks = await fetchStocks(payload.stocks, env.MARKETDATA_TOKEN, fetchImpl, retrievedAt);
  const options = await fetchOptions(payload.options, env.MARKETDATA_TOKEN, fetchImpl, retrievedAt);
  const errors = [...stocks.errors, ...options.errors];
  const result = {
    success: Object.keys(stocks.values).length + Object.keys(options.values).length > 0,
    provider: "Market Data",
    retrievedAt,
    dataType: "REALTIME_OR_DELAYED",
    stocks: stocks.values,
    options: options.values,
    errors
  };
  const status = result.success ? 200 : 502;
  const response = json(result, status, origin);
  response.headers.set("X-Portal-Cache", "MISS");
  if (cache && result.success) {
    const cachedResponse = new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`
      }
    });
    const put = cache.put(key, cachedResponse);
    if (context?.waitUntil) context.waitUntil(put);
    else await put;
  }
  return response;
}

export {
  ALLOWED_ORIGIN,
  CACHE_SECONDS,
  OCC_PATTERN,
  corsOrigin,
  validatePayload,
  normalizeStockPayload,
  normalizeOptionPayload,
  handleQuotes,
  safeError
};

export default {
  fetch(request, env, context) {
    return handleQuotes(request, env, context);
  }
};
