(function initOptionsStudio() {
  "use strict";

  const Engine = window.OptionsStrategyEngine;
  const Store = window.OptionsStrategyStorage;
  const Chart = window.OptionsStrategyChart;
  const THEME_KEY = "portailInvestissementV1Theme";
  const TEMPLATE_LABELS = {
    custom: "Stratégie personnalisée", "long-call": "Call long", "long-put": "Put long", "covered-call": "Call couvert",
    "cash-secured-put": "Put garanti en espèces", "covered-strangle": "Strangle couvert", "bull-call-spread": "Bull call spread",
    "bear-put-spread": "Bear put spread", "bull-put-spread": "Bull put spread", "bear-call-spread": "Bear call spread",
    "iron-condor": "Iron condor", "iron-butterfly": "Iron butterfly", "calendar-call": "Calendar call", "calendar-put": "Calendar put",
    "diagonal-call": "Diagonal call", "diagonal-put": "Diagonal put", "double-diagonal": "Double diagonal", pmcc: "Poor man’s covered call",
    "ford-wheel-csp": "Ford Wheel — put garanti", "ford-wheel-covered-call": "Ford Wheel — call couvert",
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const today = new Date().toISOString().slice(0, 10);
  let comparison = null;
  let renderTimer = null;
  let tableSort = { key: "price", direction: -1 };

  function resetTableSort() { tableSort = { key: "price", direction: -1 }; }

  function querySeed() {
    const params = new URLSearchParams(location.search);
    const symbol = String(params.get("symbol") || "F").toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12) || "F";
    const price = Number(params.get("price"));
    return {
      symbol,
      securityName: String(params.get("name") || (symbol === "SPY" ? "SPDR S&P 500 ETF Trust" : "Ford Motor Company")).slice(0, 120),
      underlyingPrice: Number.isFinite(price) && price > 0 ? price : (symbol === "SPY" ? 600 : 15),
      currency: String(params.get("currency") || "USD").toUpperCase().slice(0, 6),
      valuationDate: today,
      analysisDate: Engine.addDays(today, 30),
    };
  }

  let strategy = Engine.createTemplate("custom", querySeed());

  function money(value) {
    if (value == null) return "Non déterminable";
    if (value === Infinity) return "Illimité";
    if (value === -Infinity) return "Illimitée";
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency: strategy.currency || "USD", maximumFractionDigits: 2 }).format(Number(value) || 0);
  }
  function percent(value) { return value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(2)} %`; }
  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    $("#themeToggle").textContent = theme === "light" ? "Mode sombre" : "Mode clair";
  }

  function syncForm() {
    const form = $("#strategyForm");
    const values = { ...strategy, riskFreeRatePercent: Number((strategy.riskFreeRate * 100).toFixed(6)), dividendYieldPercent: Number((strategy.dividendYield * 100).toFixed(6)), impliedVolatilityPercent: Number((strategy.impliedVolatility * 100).toFixed(6)) };
    Object.entries(values).forEach(([name, value]) => { if (form.elements[name]) form.elements[name].value = value ?? ""; });
  }

  function legHtml(leg, index) {
    const option = leg.instrumentType === "option";
    return `<article class="leg-card${leg.enabled ? "" : " disabled"}" data-leg-id="${escapeHtml(leg.id)}">
      <div class="leg-head"><label><input type="checkbox" name="enabled" ${leg.enabled ? "checked" : ""}> Jambe ${index + 1} active</label><div class="leg-actions"><button type="button" class="icon-button" data-leg-action="up" aria-label="Monter la jambe">↑</button><button type="button" class="icon-button" data-leg-action="down" aria-label="Descendre la jambe">↓</button><button type="button" class="icon-button" data-leg-action="duplicate" aria-label="Dupliquer la jambe">⧉</button><button type="button" class="icon-button" data-leg-action="delete" aria-label="Supprimer la jambe">×</button></div></div>
      <div class="leg-form">
        <div class="leg-inline"><label>Instrument<select name="instrumentType"><option value="option" ${option ? "selected" : ""}>Option</option><option value="stock" ${!option ? "selected" : ""}>Action</option></select></label><label>Sens<select name="side"><option value="long" ${leg.side === "long" ? "selected" : ""}>Long</option><option value="short" ${leg.side === "short" ? "selected" : ""}>Court</option></select></label></div>
        ${option ? `<div class="leg-inline"><label>Type<select name="optionType"><option value="call" ${leg.optionType === "call" ? "selected" : ""}>CALL</option><option value="put" ${leg.optionType === "put" ? "selected" : ""}>PUT</option></select></label><label>Strike<input name="strike" type="number" min="0.01" step="0.01" value="${leg.strike}"></label></div><label>Échéance<input name="expiration" type="date" value="${leg.expiration}"></label>` : ""}
        <div class="leg-inline"><label>Quantité<input name="quantity" type="number" min="0.01" step="0.01" value="${leg.quantity}"></label><label>${option ? "Prime d’entrée" : "Prix d’entrée"}<input name="entryPrice" type="number" min="0" step="0.0001" value="${leg.entryPrice}"></label></div>
        ${option ? `<div class="leg-inline"><label>Prix actuel facultatif<input name="currentMark" type="number" min="0" step="0.0001" value="${leg.currentMark ?? ""}"></label><label>Volatilité (%)<input name="impliedVolatilityPercent" type="number" min="0" step="0.1" value="${leg.impliedVolatility * 100}"></label></div><label>Multiplicateur<input name="multiplier" type="number" min="1" step="1" value="${leg.multiplier}"></label>` : ""}
        <div class="leg-inline"><label>Commission<input name="commission" type="number" min="0" step="0.01" value="${leg.commission}"></label><label>Libellé<input name="label" maxlength="100" value="${escapeHtml(leg.label)}"></label></div>
        <label>Notes privées<textarea name="notes" rows="2" maxlength="2000">${escapeHtml(leg.notes)}</textarea></label>
      </div></article>`;
  }

  function renderLegs() {
    $("#legCount").textContent = String(strategy.legs.length);
    $("#legsList").innerHTML = strategy.legs.length ? strategy.legs.map(legHtml).join("") : '<p class="muted">Ajoutez une action, un call ou un put.</p>';
  }

  function renderAnalysis() {
    let analysis;
    try { analysis = Engine.analyze(strategy); } catch (error) { $("#analysisWarnings").textContent = `Calcul interrompu : ${error.message}`; return; }
    const metric = (label, value, tone = "") => `<div class="studio-metric"><span>${escapeHtml(label)}</span><strong class="${tone}">${escapeHtml(value)}</strong></div>`;
    $("#strategyMetrics").innerHTML = [
      metric(analysis.flowType, money(Math.abs(analysis.initialCashFlow))), metric("Profit maximal", money(analysis.maxProfit), "positive"),
      metric("Perte maximale", money(analysis.maxLoss), "negative"), metric("Seuil(s) de rentabilité", analysis.breakEvens.length ? analysis.breakEvens.map((value) => money(value)).join(" · ") : "—"),
      metric("Capital requis", analysis.capital.amount == null ? "À confirmer" : money(analysis.capital.amount)), metric("P/L à la date choisie", money(analysis.currentPL), analysis.currentPL >= 0 ? "positive" : "negative"),
      metric("Rendement sur capital", percent(analysis.returnOnCapital)), metric("Delta / Gamma", `${analysis.greeks.delta.toFixed(3)} / ${analysis.greeks.gamma.toFixed(3)}`),
      metric("Theta / Vega / Rho", `${analysis.greeks.theta.toFixed(3)} / ${analysis.greeks.vega.toFixed(3)} / ${analysis.greeks.rho.toFixed(3)}`), metric("Échéances", analysis.expirations.length ? analysis.expirations.join(" · ") : "—"),
    ].join("");
    $("#studioReference").textContent = `${strategy.symbol} — ${strategy.securityName} — ${money(strategy.underlyingPrice)} — évaluation ${strategy.valuationDate}`;
    const offsetDays = Math.max(0, Math.round(Engine.yearFraction(strategy.valuationDate, strategy.analysisDate) * 365));
    $("#analysisDateSlider").value = String(Math.min(730, offsetDays));
    $("#analysisDateLabel").textContent = strategy.analysisDate;
    $("#volatilitySlider").value = String(Math.min(200, Math.round(strategy.impliedVolatility * 100)));
    $("#volatilityLabel").textContent = `${(strategy.impliedVolatility * 100).toFixed(1)} %`;
    const comparisonBox = $("#comparisonMetrics");
    if (comparison) {
      const original = Engine.analyze(comparison);
      comparisonBox.hidden = false;
      comparisonBox.innerHTML = `<h3>Originale comparée à l’ajustée</h3><div class="comparison-grid"><span>Flux initial</span><strong>${money(original.initialCashFlow)}</strong><strong>${money(analysis.initialCashFlow)}</strong><span>Capital requis</span><strong>${original.capital.amount == null ? "À confirmer" : money(original.capital.amount)}</strong><strong>${analysis.capital.amount == null ? "À confirmer" : money(analysis.capital.amount)}</strong><span>Profit maximal</span><strong>${money(original.maxProfit)}</strong><strong>${money(analysis.maxProfit)}</strong><span>Perte maximale</span><strong>${money(original.maxLoss)}</strong><strong>${money(analysis.maxLoss)}</strong><span>Seuils</span><strong>${original.breakEvens.join(" / ") || "—"}</strong><strong>${analysis.breakEvens.join(" / ") || "—"}</strong><span>Delta</span><strong>${original.greeks.delta.toFixed(3)}</strong><strong>${analysis.greeks.delta.toFixed(3)}</strong><span>Theta</span><strong>${original.greeks.theta.toFixed(3)}</strong><strong>${analysis.greeks.theta.toFixed(3)}</strong><span>Vega</span><strong>${original.greeks.vega.toFixed(3)}</strong><strong>${analysis.greeks.vega.toFixed(3)}</strong></div>`;
    } else { comparisonBox.hidden = true; comparisonBox.innerHTML = ""; }
    const notices = [...analysis.errors, analysis.warning, analysis.multiExpiration ? "Stratégie multiéchéance : les profits maximaux, pertes maximales et projections intermédiaires sont des estimations dépendantes des hypothèses." : ""].filter(Boolean);
    $("#analysisWarnings").innerHTML = notices.map((item) => `<p>${escapeHtml(item)}</p>`).join("");
    $("#strategyChart").innerHTML = Chart.renderChart(strategy, { analysis, comparison });
    const completeRows = Chart.buildTable(strategy, analysis);
    const rows = Chart.sortRows(Chart.selectRepresentativeRows(completeRows, { maxRows: 10, currentPrice: strategy.underlyingPrice, breakEvens: analysis.breakEvens }), tableSort.key, tableSort.direction);
    $("#analysisTable").innerHTML = rows.map((row) => `<tr><td>${money(row.price)}</td><td class="${row.expiration >= 0 ? "positive" : "negative"}">${money(row.expiration)}</td><td class="${row.selectedDate >= 0 ? "positive" : "negative"}">${money(row.selectedDate)}</td><td>${percent(row.returnOnCapital)}</td><td>${row.delta.toFixed(3)}</td></tr>`).join("");
    $("#clearComparison").hidden = !comparison;
  }

  function scheduleRender(full = false) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => { if (full) renderLegs(); renderAnalysis(); }, 120);
  }

  function readStrategyForm(event) {
    const data = new FormData($("#strategyForm"));
    const value = Object.fromEntries(data.entries());
    if (["symbol", "rangeMode", "rangeMin", "rangeMax"].includes(event?.target?.name)) resetTableSort();
    strategy = Engine.normalizeStrategy({ ...strategy, ...value, riskFreeRate: Number(value.riskFreeRatePercent) / 100, dividendYield: Number(value.dividendYieldPercent) / 100, impliedVolatility: Number(value.impliedVolatilityPercent) / 100 });
    scheduleRender();
  }

  function updateLeg(event) {
    const card = event.target.closest("[data-leg-id]"); if (!card) return;
    const index = strategy.legs.findIndex((leg) => leg.id === card.dataset.legId); if (index < 0) return;
    const name = event.target.name; if (!name) return;
    let value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    if (["quantity", "strike", "entryPrice", "currentMark", "commission", "multiplier"].includes(name)) value = value === "" && name === "currentMark" ? null : Number(value);
    if (name === "impliedVolatilityPercent") { name === "unused"; strategy.legs[index].impliedVolatility = Number(value) / 100; }
    else strategy.legs[index][name] = value;
    strategy.legs[index] = Engine.normalizeLeg(strategy.legs[index]);
    scheduleRender(name === "instrumentType" || name === "enabled");
  }

  function addLeg(kind) {
    const option = kind !== "stock";
    strategy.legs.push(Engine.normalizeLeg({ instrumentType: option ? "option" : "stock", optionType: kind === "put" ? "put" : "call", side: "long", quantity: option ? 1 : 100, multiplier: strategy.multiplier, strike: strategy.underlyingPrice, expiration: Engine.addDays(strategy.valuationDate, 60), entryPrice: option ? 1 : strategy.underlyingPrice, impliedVolatility: strategy.impliedVolatility, commission: option ? strategy.optionCommission : strategy.stockCommission }));
    renderLegs(); renderAnalysis();
  }

  function legAction(event) {
    const action = event.target.closest("[data-leg-action]")?.dataset.legAction; if (!action) return;
    const card = event.target.closest("[data-leg-id]"); const index = strategy.legs.findIndex((leg) => leg.id === card?.dataset.legId); if (index < 0) return;
    if (action === "delete") strategy.legs.splice(index, 1);
    if (action === "duplicate") strategy.legs.splice(index + 1, 0, Engine.normalizeLeg({ ...strategy.legs[index], id: "" }));
    if (action === "up" && index > 0) [strategy.legs[index - 1], strategy.legs[index]] = [strategy.legs[index], strategy.legs[index - 1]];
    if (action === "down" && index < strategy.legs.length - 1) [strategy.legs[index + 1], strategy.legs[index]] = [strategy.legs[index], strategy.legs[index + 1]];
    renderLegs(); renderAnalysis();
  }

  function loadTemplate() {
    if (strategy.legs.length && !confirm("Remplacer les jambes actuelles par ce modèle?")) return;
    strategy = Engine.createTemplate($("#templateSelect").value, strategy); comparison = null; resetTableSort(); syncForm(); renderLegs(); renderAnalysis();
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => { const result = Store.importDocument(reader.result); if (!result.valid) { alert(result.errors.join("\n")); return; } if (!confirm(`Importer « ${result.value.name} » et remplacer la stratégie affichée?`)) return; strategy = result.value; comparison = null; resetTableSort(); syncForm(); renderLegs(); renderAnalysis(); };
    reader.readAsText(file);
  }

  function initializeShared() {
    if (!location.hash.includes("strategy=")) return;
    const result = Store.parseShareFragment(location.hash);
    if (result.valid && confirm(`Charger la stratégie partagée « ${result.value.name} »?`)) { strategy = result.value; history.replaceState(null, "", `${location.pathname}${location.search}`); }
  }

  function renderSavedStrategies() {
    const saved = Store.load().strategies;
    $("#savedStrategySelect").innerHTML = '<option value="">Aucune</option>' + saved.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} — ${escapeHtml(item.symbol)}</option>`).join("");
  }

  function bind() {
    $("#strategyForm").addEventListener("input", readStrategyForm);
    $("#legsList").addEventListener("input", updateLeg); $("#legsList").addEventListener("change", updateLeg); $("#legsList").addEventListener("click", legAction);
    $$('[data-add-leg]').forEach((button) => button.addEventListener("click", () => addLeg(button.dataset.addLeg)));
    $("#loadTemplate").addEventListener("click", loadTemplate);
    $("#saveStrategy").addEventListener("click", () => { Store.saveStrategy(strategy); renderSavedStrategies(); $("#saveState").textContent = "● Stratégie enregistrée localement"; });
    $("#loadSavedStrategy").addEventListener("click", () => { const saved = Store.load().strategies.find((item) => item.id === $("#savedStrategySelect").value); if (!saved) return; if (strategy.legs.length && !confirm(`Ouvrir « ${saved.name} » et remplacer la stratégie affichée?`)) return; strategy = saved; comparison = null; resetTableSort(); syncForm(); renderLegs(); renderAnalysis(); });
    $("#duplicateStrategy").addEventListener("click", () => { strategy = Engine.normalizeStrategy({ ...strategy, id: "", name: `${strategy.name} — copie` }); syncForm(); renderLegs(); renderAnalysis(); });
    $("#resetStrategy").addEventListener("click", () => { if (confirm("Réinitialiser cette stratégie?")) { strategy = Engine.createTemplate("custom", querySeed()); comparison = null; resetTableSort(); syncForm(); renderLegs(); renderAnalysis(); } });
    $("#exportJson").addEventListener("click", () => { const artifact = Store.createExportArtifact(strategy); download(artifact.filename, artifact.content, artifact.type); });
    $("#importJson").addEventListener("click", () => $("#importFile").click()); $("#importFile").addEventListener("change", (event) => event.target.files[0] && importJson(event.target.files[0]));
    $("#exportCsv").addEventListener("click", () => download(`${strategy.symbol}-analyse-options.csv`, `\ufeff${Chart.tableToCsv(Chart.buildTable(strategy))}`, "text/csv;charset=utf-8"));
    $("#setComparison").addEventListener("click", () => { comparison = Store.clone(strategy); $("#setComparison").textContent = "Originale mémorisée"; renderAnalysis(); });
    $("#clearComparison").addEventListener("click", () => { comparison = null; $("#setComparison").textContent = "Définir comme originale"; renderAnalysis(); });
    $("#shareStrategy").addEventListener("click", () => { const url = `${location.origin}${location.pathname}${Store.createShareFragment(strategy)}`; $("#sharePreview").value = url; $("#shareLength").textContent = `${url.length} caractères${url.length > 6000 ? " — lien très long; privilégiez le fichier JSON." : ""}`; $("#shareDialog").showModal(); });
    $("#copyShare").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#sharePreview").value); $("#copyShare").textContent = "Lien copié"; } catch { $("#sharePreview").select(); document.execCommand("copy"); } });
    $("#strategyChart").addEventListener("pointerover", (event) => { const point = event.target.closest("[data-price]"); if (point) $("#chartTooltip").textContent = `Cours ${money(point.dataset.price)} — P/L échéance ${money(point.dataset.pl)} — P/L date choisie ${money(point.dataset.datePl)} — rendement ${point.dataset.return ? percent(Number(point.dataset.return)) : "—"} — variation ${money(point.dataset.variation)}`; });
    $("#analysisDateSlider").addEventListener("input", (event) => { strategy.analysisDate = Engine.addDays(strategy.valuationDate, Number(event.target.value)); syncForm(); scheduleRender(); });
    $("#volatilitySlider").addEventListener("input", (event) => { strategy.impliedVolatility = Number(event.target.value) / 100; strategy.legs = strategy.legs.map((leg) => leg.instrumentType === "option" ? { ...leg, impliedVolatility: strategy.impliedVolatility } : leg); syncForm(); renderLegs(); scheduleRender(); });
    $$('[data-table-sort]').forEach((button) => button.addEventListener("click", () => { tableSort = tableSort.key === button.dataset.tableSort ? { key: tableSort.key, direction: -tableSort.direction } : { key: button.dataset.tableSort, direction: 1 }; renderAnalysis(); }));
    $("#themeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"));
    $("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.add("open")); $("#sidebarClose").addEventListener("click", () => $("#sidebar").classList.remove("open"));
  }

  function init() {
    $("#templateSelect").innerHTML = Engine.TEMPLATE_NAMES.map((name) => `<option value="${name}">${escapeHtml(TEMPLATE_LABELS[name])}</option>`).join("");
    initializeShared(); setTheme(localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"); syncForm(); renderSavedStrategies(); renderLegs(); renderAnalysis(); bind();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
