(function initOptionsChart(globalScope) {
  "use strict";

  const Engine = typeof require === "function" ? require("./options-engine.js") : globalScope.OptionsStrategyEngine;
  const WIDTH = 920;
  const HEIGHT = 420;
  const PAD = { left: 72, right: 28, top: 34, bottom: 54 };

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function money(value) {
    if (value === Infinity) return "Illimité";
    if (value === -Infinity) return "Illimitée";
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value) || 0);
  }

  function getScenarioPriceStep(symbol, fallback = 1) {
    return String(symbol || "").trim().toUpperCase() === "F" ? 0.5 : Math.max(0.01, Number(fallback) || 1);
  }

  function isFordSymbol(symbol) {
    return String(symbol || "").trim().toUpperCase() === "F";
  }

  function fordScenarioPrices(range) {
    const firstHalfDollar = Math.ceil((Number(range.min) - 1e-9) * 2);
    const lastHalfDollar = Math.floor((Number(range.max) + 1e-9) * 2);
    const count = Math.max(0, lastHalfDollar - firstHalfDollar + 1);
    return Array.from({ length: Math.min(5000, count) }, (_, index) => (firstHalfDollar + index) / 2);
  }

  function buildSeries(strategyInput, analysisInput, pointCount = 121) {
    const analysis = analysisInput || Engine.analyze(strategyInput);
    const strategy = analysis.strategy;
    const fordPrices = isFordSymbol(strategy.symbol) ? fordScenarioPrices(analysis.range) : null;
    const count = Math.max(21, Math.min(401, Number(pointCount) || 121));
    const span = analysis.range.max - analysis.range.min || 1;
    const prices = fordPrices?.length ? fordPrices : Array.from({ length: count }, (_, index) => analysis.range.min + (span * index) / (count - 1));
    const points = prices.map((price) => {
      return {
        price,
        expiration: Engine.expirationPL(strategy, price),
        selectedDate: Engine.strategyPLAtDate(strategy, price, strategy.analysisDate),
      };
    });
    return { strategy, analysis, points };
  }

  function scaleModel(series, comparisonSeries) {
    const all = [...series.points, ...(comparisonSeries?.points || [])];
    const minX = series.analysis.range.min;
    const maxX = series.analysis.range.max;
    const values = all.flatMap((point) => [point.expiration, point.selectedDate]).filter(Number.isFinite);
    let minY = Math.min(0, ...values);
    let maxY = Math.max(0, ...values);
    if (Math.abs(maxY - minY) < 0.01) { minY -= 1; maxY += 1; }
    const yPad = (maxY - minY) * 0.1;
    minY -= yPad;
    maxY += yPad;
    const x = (value) => PAD.left + ((value - minX) / Math.max(0.0001, maxX - minX)) * (WIDTH - PAD.left - PAD.right);
    const y = (value) => PAD.top + ((maxY - value) / Math.max(0.0001, maxY - minY)) * (HEIGHT - PAD.top - PAD.bottom);
    return { minX, maxX, minY, maxY, x, y };
  }

  function path(points, key, scale) {
    return points.map((point, index) => `${index ? "L" : "M"}${scale.x(point.price).toFixed(2)},${scale.y(point[key]).toFixed(2)}`).join(" ");
  }

  function renderChart(strategyInput, options = {}) {
    const series = buildSeries(strategyInput, options.analysis);
    const comparisonSeries = options.comparison ? buildSeries(options.comparison) : null;
    const scale = scaleModel(series, comparisonSeries);
    const xTicks = isFordSymbol(series.strategy.symbol)
      ? Array.from(new Set(Array.from({ length: Math.min(6, series.points.length) }, (_, index) => series.points[Math.round(((series.points.length - 1) * index) / Math.max(1, Math.min(6, series.points.length) - 1))].price)))
      : Array.from({ length: 6 }, (_, index) => scale.minX + ((scale.maxX - scale.minX) * index) / 5);
    const yTicks = Array.from({ length: 5 }, (_, index) => scale.minY + ((scale.maxY - scale.minY) * index) / 4);
    const grid = [
      ...xTicks.map((value) => `<line x1="${scale.x(value)}" y1="${PAD.top}" x2="${scale.x(value)}" y2="${HEIGHT - PAD.bottom}" class="studio-grid"/><text x="${scale.x(value)}" y="${HEIGHT - 22}" text-anchor="middle">${escapeHtml(value.toFixed(2))}</text>`),
      ...yTicks.map((value) => `<line x1="${PAD.left}" y1="${scale.y(value)}" x2="${WIDTH - PAD.right}" y2="${scale.y(value)}" class="studio-grid"/><text x="${PAD.left - 10}" y="${scale.y(value) + 4}" text-anchor="end">${escapeHtml(Math.round(value))}</text>`),
    ].join("");
    const zero = scale.minY <= 0 && scale.maxY >= 0 ? `<line x1="${PAD.left}" y1="${scale.y(0)}" x2="${WIDTH - PAD.right}" y2="${scale.y(0)}" class="studio-zero"/>` : "";
    const spot = `<line x1="${scale.x(series.strategy.underlyingPrice)}" y1="${PAD.top}" x2="${scale.x(series.strategy.underlyingPrice)}" y2="${HEIGHT - PAD.bottom}" class="studio-spot"/><text x="${scale.x(series.strategy.underlyingPrice) + 6}" y="${PAD.top + 14}" class="studio-spot-label">Cours actuel</text>`;
    const breakEvens = series.analysis.breakEvens.map((value) => `<line x1="${scale.x(value)}" y1="${PAD.top}" x2="${scale.x(value)}" y2="${HEIGHT - PAD.bottom}" class="studio-breakeven"/><text x="${scale.x(value) + 4}" y="${HEIGHT - PAD.bottom - 8}" class="studio-be-label">S.R. ${value.toFixed(2)}</text>`).join("");
    const comparison = comparisonSeries ? `<path d="${path(comparisonSeries.points, "expiration", scale)}" class="studio-curve comparison" aria-label="Stratégie originale"/>` : "";
    const capital = series.analysis.capital.amount;
    const points = series.points.filter((_, index) => index % 4 === 0).map((point) => `<circle cx="${scale.x(point.price)}" cy="${scale.y(point.expiration)}" r="8" class="studio-point" tabindex="0" data-price="${point.price.toFixed(4)}" data-pl="${point.expiration.toFixed(4)}" data-date-pl="${point.selectedDate.toFixed(4)}" data-return="${capital > 0 ? (point.expiration / capital).toFixed(6) : ""}" data-variation="${(point.price - series.strategy.underlyingPrice).toFixed(4)}"><title>Cours ${point.price.toFixed(2)}, P/L ${point.expiration.toFixed(2)}</title></circle>`).join("");
    return `<div class="studio-chart-wrap"><svg class="studio-chart" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="strategyChartTitle strategyChartDesc">
      <title id="strategyChartTitle">Profit et perte de la stratégie selon le cours du titre</title>
      <desc id="strategyChartDesc">Courbe à l’échéance, projection à la date choisie, cours actuel et seuils de rentabilité.</desc>
      ${grid}${zero}${spot}${breakEvens}${comparison}
      <path d="${path(series.points, "expiration", scale)}" class="studio-curve expiration"/>
      <path d="${path(series.points, "selectedDate", scale)}" class="studio-curve selected"/>
      ${points}
      <text x="${WIDTH / 2}" y="${HEIGHT - 3}" text-anchor="middle" class="axis-title">Cours du titre (${escapeHtml(series.strategy.currency)})</text>
      <text transform="translate(18 ${HEIGHT / 2}) rotate(-90)" text-anchor="middle" class="axis-title">Profit / perte (${escapeHtml(series.strategy.currency)})</text>
    </svg><output class="studio-chart-tooltip" id="chartTooltip" aria-live="polite">Survolez la courbe pour voir une valeur.</output>
    <div class="studio-legend" aria-label="Légende"><span><i class="legend-expiration"></i>À l’échéance</span><span><i class="legend-selected"></i>Date choisie</span>${comparisonSeries ? '<span><i class="legend-comparison"></i>Originale</span>' : ""}<span><i class="legend-zero"></i>Zéro</span><span><i class="legend-spot"></i>Cours actuel</span><span><i class="legend-be"></i>Seuil de rentabilité</span></div></div>`;
  }

  function buildTable(strategyInput, analysisInput) {
    const analysis = analysisInput || Engine.analyze(strategyInput);
    const strategy = analysis.strategy;
    const step = getScenarioPriceStep(strategy.symbol, strategy.tableStep);
    const rows = [];
    const fordPrices = isFordSymbol(strategy.symbol) ? fordScenarioPrices(analysis.range) : null;
    const prices = fordPrices || Array.from({ length: 500 }, (_, index) => analysis.range.min + index * step).filter((price) => price <= analysis.range.max + step / 2);
    for (const price of prices) {
      const expiration = Engine.expirationPL(strategy, price);
      const selectedDate = Engine.strategyPLAtDate(strategy, price, strategy.analysisDate);
      const h = Math.max(0.01, price * 0.001);
      const delta = (Engine.expirationPL(strategy, price + h) - Engine.expirationPL(strategy, Math.max(0, price - h))) / (price > h ? 2 * h : h);
      rows.push({ price: Engine.round(price, 4), expiration, selectedDate, returnOnCapital: analysis.capital.amount > 0 ? expiration / analysis.capital.amount : null, delta: Engine.round(delta, 6) });
    }
    return rows;
  }

  function selectRepresentativeRows(rowsInput, options = {}) {
    const maxRows = Math.max(1, Math.floor(Number(options.maxRows) || 10));
    const rows = [...(rowsInput || [])].sort((a, b) => a.price - b.price);
    if (rows.length <= maxRows) return rows;
    const selected = new Set([0, rows.length - 1]);
    const nearestIndex = (target) => rows.reduce((best, row, index) => Math.abs(row.price - target) < Math.abs(rows[best].price - target) ? index : best, 0);
    if (Number.isFinite(Number(options.currentPrice))) selected.add(nearestIndex(Number(options.currentPrice)));
    for (const value of options.breakEvens || []) {
      if (selected.size >= maxRows) break;
      if (Number.isFinite(Number(value))) selected.add(nearestIndex(Number(value)));
    }
    for (let slot = 0; selected.size < maxRows && slot < maxRows; slot += 1) {
      selected.add(Math.round(((rows.length - 1) * slot) / Math.max(1, maxRows - 1)));
    }
    for (let index = 0; selected.size < maxRows && index < rows.length; index += 1) selected.add(index);
    return [...selected].sort((a, b) => a - b).slice(0, maxRows).map((index) => rows[index]).sort((a, b) => a.price - b.price);
  }

  function tableToCsv(rows) {
    return ["Cours,P/L échéance,P/L date choisie,Rendement sur capital,Delta estimé", ...rows.map((row) => [row.price, row.expiration, row.selectedDate, row.returnOnCapital == null ? "" : row.returnOnCapital, row.delta].join(","))].join("\r\n");
  }

  const api = { getScenarioPriceStep, buildSeries, renderChart, buildTable, selectRepresentativeRows, tableToCsv, money };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.OptionsStrategyChart = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
