import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_ORIGIN,
  CACHE_SECONDS,
  corsOrigin,
  handleQuotes,
  normalizeOptionPayload,
  normalizeStockPayload,
  safeError,
  validatePayload
} from "../src/index.js";

function request(method = "POST", origin = ALLOWED_ORIGIN, body = { stocks: ["F"], options: [] }) {
  return new Request("https://worker.example/quotes", {
    method,
    headers: {
      "Content-Type": "application/json",
      "Origin": origin
    },
    body: method === "POST" ? JSON.stringify(body) : undefined
  });
}

test("symbole interdit bloqué", () => {
  assert.equal(validatePayload({ stocks: ["AAPL"], options: [] }).valid, false);
});

test("plus de 20 options bloquées", () => {
  const options = Array.from({ length: 21 }, (_, index) => `F260821C${String(15000 + index).padStart(8, "0")}`);
  assert.equal(validatePayload({ stocks: ["F"], options }).valid, false);
});

test("champ privé bloqué", () => {
  assert.equal(validatePayload({ stocks: ["F"], options: [], cash: 1000 }).valid, false);
});

test("symbole OCC SPY valide", () => {
  assert.equal(validatePayload({ stocks: ["SPY"], options: ["SPY261218P00600000"] }).valid, true);
});

test("CORS GitHub autorisé", () => {
  assert.equal(corsOrigin(request()), ALLOWED_ORIGIN);
});

test("CORS localhost autorisé", () => {
  assert.equal(corsOrigin(request("POST", "http://localhost:8768")), "http://localhost:8768");
});

test("CORS externe refusé", async () => {
  const response = await handleQuotes(request("POST", "https://example.com"), { MARKETDATA_TOKEN: "secret" }, {});
  assert.equal(response.status, 403);
});

test("OPTIONS autorisé", async () => {
  const response = await handleQuotes(request("OPTIONS"), { MARKETDATA_TOKEN: "secret" }, {});
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGIN);
});

test("méthode GET refusée", async () => {
  const response = await handleQuotes(request("GET"), { MARKETDATA_TOKEN: "secret" }, {});
  assert.equal(response.status, 405);
});

test("jeton absent", async () => {
  const response = await handleQuotes(request(), {}, {});
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.errors[0], "Service non configuré.");
});

test("cache de quinze minutes", async () => {
  let fetchCalled = false;
  const cachedBody = {
    success: true,
    provider: "Market Data",
    retrievedAt: "2026-07-28T20:00:00Z",
    dataType: "REALTIME_OR_DELAYED",
    stocks: { F: { price: 14, updatedAt: "2026-07-28T20:00:00Z" } },
    options: {},
    errors: []
  };
  const cache = {
    async match() {
      return new Response(JSON.stringify(cachedBody), {
        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_SECONDS}` }
      });
    },
    async put() {}
  };
  const response = await handleQuotes(
    request(),
    { MARKETDATA_TOKEN: "secret" },
    {},
    { cache, fetchImpl: async () => { fetchCalled = true; } }
  );
  assert.equal(response.headers.get("X-Portal-Cache"), "HIT");
  assert.equal(fetchCalled, false);
});

test("normalisation action", () => {
  const result = normalizeStockPayload(
    { symbol: ["F"], mid: [14.25], updated: [1785268800] },
    ["F"],
    "2026-07-28T20:00:00Z"
  );
  assert.equal(result.F.price, 14.25);
});

test("milieu bid-ask option prioritaire", () => {
  const result = normalizeOptionPayload(
    { bid: [1], ask: [2], mid: [1.4], last: [1.3], updated: [1785268800] },
    "F260821C00015000",
    "2026-07-28T20:00:00Z"
  );
  assert.equal(result.price, 1.5);
});

test("repli option vers mid", () => {
  assert.equal(normalizeOptionPayload({ bid: [0], ask: [0], mid: [1.4], last: [1.3] }, "F260821C00015000", "2026-07-28T20:00:00Z").price, 1.4);
});

test("repli option vers last", () => {
  assert.equal(normalizeOptionPayload({ bid: [0], ask: [0], mid: [0], last: [1.3] }, "F260821C00015000", "2026-07-28T20:00:00Z").price, 1.3);
});

test("option sans prix fiable", () => {
  assert.equal(normalizeOptionPayload({ bid: [0], ask: [0], mid: [0], last: [0] }, "F260821C00015000", "2026-07-28T20:00:00Z"), null);
});

test("message interne et jeton masqués", () => {
  const sanitized = safeError("Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456");
  assert.equal(sanitized.includes("abcdefghijklmnopqrstuvwxyz"), false);
});
