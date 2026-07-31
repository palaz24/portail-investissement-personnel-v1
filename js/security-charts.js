(function initSecurityCharts(globalScope) {
  "use strict";

  const LEAPS_MIN_DAYS = 365;

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function optionDisplayType(option, referenceDate = new Date()) {
    const expiration = new Date(`${String(option?.expiration || "").slice(0, 10)}T12:00:00Z`);
    const reference = new Date(referenceDate);
    const days = (expiration.getTime() - reference.getTime()) / 86400000;
    return Number.isFinite(days) && days >= LEAPS_MIN_DAYS
      ? "LEAPS"
      : String(option?.optionType || "").toUpperCase() === "PUT"
        ? "PUT"
        : "CALL";
  }

  function optionStrategyLabel(option) {
    return String(
      option?.strategy
      || option?.strategyName
      || option?.coverageTypeLabel
      || (option?.side === "LONG" ? "Jambe longue" : "Jambe courte")
    );
  }

  function positionLabel(distance) {
    if (distance > 0) return "au-dessus du cours";
    if (distance < 0) return "au-dessous du cours";
    return "au niveau du cours";
  }

  function normalizeHistory(priceHistory, symbol) {
    const points = Array.isArray(priceHistory?.[symbol]) ? priceHistory[symbol] : [];
    return points
      .filter((point) => (
        String(point?.symbol || "").toUpperCase() === symbol
        && number(point?.price) > 0
        && !Number.isNaN(new Date(point?.at).getTime())
        && point?.source === "Market Data"
      ))
      .slice()
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }

  function buildModel({
    symbol,
    currentPrice,
    currency = "USD",
    priceHistory = {},
    options = [],
    includeExpired = false,
    now = new Date(),
  }) {
    const normalizedSymbol = String(symbol || "").toUpperCase();
    const today = new Date(now).toISOString().slice(0, 10);
    const price = number(currentPrice);
    const history = normalizeHistory(priceHistory, normalizedSymbol);
    const activeOptions = options
      .filter((option) => number(option?.contractsOpen) > 0)
      .filter((option) => includeExpired || String(option?.expiration || "") >= today)
      .map((option) => {
        const strike = number(option.strike);
        const distanceDollars = price > 0 ? strike - price : null;
        const distancePercent = price > 0 ? (distanceDollars / price) * 100 : null;
        return {
          id: String(option.contractId || option.id || ""),
          type: optionDisplayType(option, now),
          optionType: String(option.optionType || "").toUpperCase(),
          side: String(option.side || ""),
          strike,
          expiration: String(option.expiration || ""),
          strategy: optionStrategyLabel(option),
          distanceDollars,
          distancePercent,
          position: distanceDollars == null ? "" : positionLabel(distanceDollars),
        };
      })
      .sort((a, b) => (
        a.expiration.localeCompare(b.expiration)
        || a.strike - b.strike
        || a.id.localeCompare(b.id)
      ));

    return {
      symbol: normalizedSymbol,
      currentPrice: price,
      currency,
      history,
      options: activeOptions,
      historyBuilding: history.length < 2,
    };
  }

  function money(value, currency = "USD", digits = 2) {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(number(value));
  }

  function dateLabel(value) {
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(date);
  }

  function optionLegendLabel(option, currency) {
    return `${option.type} · ${money(option.strike, currency)} · ${dateLabel(option.expiration)} · ${option.strategy}`;
  }

  function renderPriceChart(model, selectedId = "") {
    const width = 960;
    const height = Math.max(310, 235 + model.options.length * 12);
    const left = 76;
    const right = 24;
    const top = 24;
    const bottom = 48;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const values = [
      ...(model.currentPrice > 0 ? [model.currentPrice] : []),
      ...model.history.map((point) => number(point.price)),
      ...model.options.map((option) => option.strike),
    ].filter((value) => value > 0);
    const rawMin = values.length ? Math.min(...values) : 0;
    const rawMax = values.length ? Math.max(...values) : 1;
    const padding = Math.max((rawMax - rawMin) * 0.12, rawMax * 0.04, 1);
    const min = Math.max(0, rawMin - padding);
    const max = rawMax + padding;
    const range = Math.max(max - min, 1);
    const y = (value) => top + ((max - value) / range) * plotHeight;
    const historyTimes = model.history.map((point) => new Date(point.at).getTime());
    const minTime = historyTimes.length ? Math.min(...historyTimes) : 0;
    const maxTime = historyTimes.length ? Math.max(...historyTimes) : minTime + 1;
    const x = (point, index) => {
      if (maxTime === minTime) return left + (index / Math.max(model.history.length - 1, 1)) * plotWidth;
      return left + ((new Date(point.at).getTime() - minTime) / (maxTime - minTime)) * plotWidth;
    };
    const polyline = model.history.length >= 2
      ? model.history.map((point, index) => `${x(point, index).toFixed(2)},${y(number(point.price)).toFixed(2)}`).join(" ")
      : "";
    const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const value = max - range * ratio;
      const lineY = top + plotHeight * ratio;
      return `<line class="chart-grid-line" x1="${left}" y1="${lineY}" x2="${width - right}" y2="${lineY}"></line>
        <text class="chart-axis-label" x="${left - 10}" y="${lineY + 4}" text-anchor="end">${escapeHtml(money(value, model.currency))}</text>`;
    }).join("");
    const strikeLines = model.options.map((option) => {
      const lineY = y(option.strike);
      const selected = option.id === selectedId;
      return `<g class="chart-option-target strike-line ${selected ? "is-selected" : ""}" role="button" tabindex="0"
        data-chart-option="${escapeHtml(option.id)}" aria-pressed="${selected}">
        <line x1="${left}" y1="${lineY}" x2="${width - right}" y2="${lineY}"></line>
        <text x="${left + 8}" y="${lineY - 6}">${escapeHtml(`${option.type} ${money(option.strike, model.currency)}`)}</text>
        <text class="strike-expiration" x="${width - right - 8}" y="${lineY - 6}" text-anchor="end">${escapeHtml(dateLabel(option.expiration))}</text>
      </g>`;
    }).join("");
    const currentLine = model.currentPrice > 0
      ? `<g class="current-price-line">
          <line x1="${left}" y1="${y(model.currentPrice)}" x2="${width - right}" y2="${y(model.currentPrice)}"></line>
          <text x="${width - right - 8}" y="${y(model.currentPrice) + 18}" text-anchor="end">Cours actuel ${escapeHtml(money(model.currentPrice, model.currency))}</text>
        </g>`
      : "";
    const historyLine = polyline
      ? `<polyline class="price-history-line" points="${polyline}"></polyline>
        ${model.history.map((point, index) => `<circle class="price-history-point" cx="${x(point, index)}" cy="${y(number(point.price))}" r="4"><title>${escapeHtml(`${new Date(point.at).toLocaleString("fr-CA")} · ${money(point.price, model.currency)}`)}</title></circle>`).join("")}`
      : "";
    const legend = model.options.length
      ? model.options.map((option) => {
        const selected = option.id === selectedId;
        return `<button class="chart-legend-item chart-option-target ${selected ? "is-selected" : ""}" type="button"
          data-chart-option="${escapeHtml(option.id)}" aria-pressed="${selected}">
          <span class="chart-legend-swatch ${escapeHtml(option.type.toLowerCase())}"></span>
          ${escapeHtml(optionLegendLabel(option, model.currency))}
        </button>`;
      }).join("")
      : `<p class="chart-empty">Aucun strike actif pour ce titre.</p>`;
    return `
      ${model.historyBuilding ? `<p class="chart-building-message">Historique en cours de constitution</p>` : ""}
      <div class="chart-scroll">
        <svg class="price-strike-chart" viewBox="0 0 ${width} ${height}" role="img"
          aria-label="Cours du titre et strikes actifs de ${escapeHtml(model.symbol)}">
          ${grid}
          ${historyLine}
          ${strikeLines}
          ${currentLine}
        </svg>
      </div>
      <div class="chart-legend" aria-label="Légende des options actives">${legend}</div>`;
  }

  function renderDistanceChart(model, selectedId = "") {
    if (!model.options.length) return `<p class="chart-empty">Aucun strike actif pour ce titre.</p>`;
    if (model.currentPrice <= 0) {
      return `<p class="chart-building-message">Le prix actuel est requis pour calculer les distances.</p>`;
    }
    const maxDistance = Math.max(...model.options.map((option) => Math.abs(option.distancePercent)), 1);
    return `<div class="distance-chart">
      <div class="distance-zero-line" aria-hidden="true"></div>
      ${model.options.map((option) => {
        const selected = option.id === selectedId;
        const magnitude = Math.min(48, (Math.abs(option.distancePercent) / maxDistance) * 48);
        const sideClass = option.distanceDollars >= 0 ? "above" : "below";
        return `<button class="distance-row chart-option-target ${selected ? "is-selected" : ""}" type="button"
          data-chart-option="${escapeHtml(option.id)}" aria-pressed="${selected}">
          <span class="distance-label"><strong>${escapeHtml(option.type)} · ${escapeHtml(money(option.strike, model.currency))}</strong>
            <small>${escapeHtml(dateLabel(option.expiration))} · ${escapeHtml(option.strategy)}</small></span>
          <span class="distance-track" aria-hidden="true">
            <span class="distance-bar ${sideClass}" style="--distance-size:${magnitude.toFixed(2)}%"></span>
          </span>
          <span class="distance-values"><strong>${escapeHtml(money(option.distanceDollars, model.currency))}</strong>
            <small>${escapeHtml(`${option.distancePercent.toFixed(2)} % · ${option.position}`)}</small></span>
        </button>`;
      }).join("")}
    </div>`;
  }

  const api = {
    LEAPS_MIN_DAYS,
    optionDisplayType,
    optionStrategyLabel,
    positionLabel,
    normalizeHistory,
    buildModel,
    renderPriceChart,
    renderDistanceChart,
  };

  globalScope.PortalSecurityCharts = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
