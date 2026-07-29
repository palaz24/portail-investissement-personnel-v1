(function initApp() {
  "use strict";

  const Calc = window.PortalCalculations;
  const Storage = window.PortalStorage;
  const Forms = window.PortalForms;
  const Backup = window.PortalBackup;
  const History = window.PortalHistory;
  const Market = window.PortalMarketData;

  let state = Storage.load();
  let derived = Calc.calculatePortfolio(state);
  let currentView = "dashboard";
  let selectedSymbol = state.securities.find((security) => security.active !== false)?.symbol || "F";
  let marketMeta = Market.readMeta();
  let marketRefreshPromise = null;
  let automaticRefreshTimer = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const VIEW_TITLES = {
    dashboard: "Tableau de bord",
    security: "Fiche du titre",
    operations: "Opérations",
    prices: "Mise à jour des prix",
    securities: "Gestion des titres",
    backup: "Sauvegarde et restauration",
    settings: "Paramètres"
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatMoney(value, digits = 2) {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(Number(value) || 0);
  }

  function formatNumber(value, digits = 2) {
    return new Intl.NumberFormat("fr-CA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    }).format(Number(value) || 0);
  }

  function formatPercent(value) {
    return `${formatNumber(value, 2)} %`;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(date);
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("fr-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
  }

  function localDateTimeValue(value = new Date().toISOString()) {
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function valueClass(value) {
    const number = Number(value) || 0;
    return number > 0 ? "positive" : number < 0 ? "negative" : "";
  }

  function toast(message, type = "success") {
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    $("#toastRegion").appendChild(item);
    window.setTimeout(() => item.remove(), 4200);
  }

  function showErrors(container, errors) {
    container.hidden = errors.length === 0;
    container.innerHTML = errors.length
      ? `<strong>Veuillez corriger :</strong><ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`
      : "";
  }

  function getMarketSettings() {
    const configured = state.accountSettings?.marketData || {};
    return {
      enabled: configured.enabled !== false,
      workerUrl: String(configured.workerUrl || Market.DEFAULT_WORKER_URL || "").trim(),
      frequencyMinutes: 60,
      provider: "Market Data"
    };
  }

  function marketStatusView() {
    const settings = getMarketSettings();
    if (!settings.enabled) {
      return { tone: "warning", label: "Prix automatiques désactivés", detail: "Prix manuel conservé" };
    }
    if (!settings.workerUrl) {
      return { tone: "warning", label: "Prix manuel conservé", detail: "Le service automatique n’est pas encore configuré." };
    }
    const states = {
      loading: { tone: "loading", label: "Mise à jour en cours" },
      success: { tone: "success", label: "À jour" },
      delayed: { tone: "warning", label: "Données retardées" },
      partial: { tone: "warning", label: "Prix partiellement mis à jour" },
      unavailable: { tone: "error", label: "Service temporairement indisponible" },
      manual: { tone: "warning", label: "Prix manuel conservé" }
    };
    return {
      ...(states[marketMeta.status] || states.manual),
      detail: marketMeta.message || "Données en temps réel ou retardées selon le forfait."
    };
  }

  function renderMarketStatus() {
    const view = marketStatusView();
    const lastSuccess = marketMeta.lastSuccess ? formatDateTime(marketMeta.lastSuccess) : "—";
    const lastAttempt = marketMeta.lastAttempt ? formatDateTime(marketMeta.lastAttempt) : "—";
    const html = `
      <div class="market-status-main">
        <span class="market-status-dot" aria-hidden="true"></span>
        <div>
          <strong>${escapeHtml(view.label)}</strong>
          <small>${escapeHtml(view.detail)}</small>
        </div>
      </div>
      <div class="market-status-meta">
        <span>Source : Market Data</span>
        <span>Dernière réussite : ${escapeHtml(lastSuccess)}</span>
      </div>`;
    ["marketStatusDashboard", "marketStatusSecurity", "marketStatusPrices"].forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.className = `market-status-card ${id === "marketStatusSecurity" ? "compact-status " : ""}${view.tone}`;
      element.innerHTML = html;
    });
    const summary = $("#marketSettingsSummary");
    if (summary) {
      summary.innerHTML = `
        <strong>Source : Market Data</strong><br>
        Dernière réussite : ${escapeHtml(lastSuccess)}<br>
        Dernière tentative : ${escapeHtml(lastAttempt)}<br>
        Données en temps réel ou retardées selon le forfait.`;
    }
  }

  function saveState(action) {
    try {
      state = Storage.save(state, action);
      derived = Calc.calculatePortfolio(state);
      renderAll();
      $("#saveState").textContent = "● Sauvegarde locale à jour";
      return true;
    } catch (error) {
      toast(error.message, "error");
      $("#saveState").textContent = "● Erreur de sauvegarde";
      return false;
    }
  }

  async function refreshMarketPrices({ manual = false } = {}) {
    const settings = getMarketSettings();
    const now = Date.now();
    if (!settings.enabled || !settings.workerUrl) {
      marketMeta = {
        ...marketMeta,
        status: "manual",
        message: settings.enabled
          ? "Le service automatique n’est pas encore configuré."
          : "La saisie manuelle demeure disponible."
      };
      Market.writeMeta(marketMeta);
      renderMarketStatus();
      if (manual) toast(marketMeta.message, "error");
      return false;
    }
    if (manual && marketMeta.lastManualAttempt
      && now - new Date(marketMeta.lastManualAttempt).getTime() < Market.MANUAL_COOLDOWN_MS) {
      const remaining = Math.ceil((Market.MANUAL_COOLDOWN_MS - (now - new Date(marketMeta.lastManualAttempt).getTime())) / 60000);
      toast(`Veuillez attendre encore ${remaining} minute(s) avant une nouvelle actualisation manuelle.`, "error");
      return false;
    }
    if (marketRefreshPromise) return marketRefreshPromise;
    if (document.hidden) return false;

    const request = Market.buildQuoteRequest(state, derived);
    if (!request.stocks.length && !request.options.length) {
      marketMeta = { ...marketMeta, status: "manual", message: "Aucun symbole admissible à actualiser." };
      Market.writeMeta(marketMeta);
      renderMarketStatus();
      return false;
    }

    const attemptedAt = new Date().toISOString();
    marketMeta = {
      ...marketMeta,
      status: "loading",
      message: "Prix actualisés automatiquement en cours.",
      lastAttempt: attemptedAt,
      ...(manual ? { lastManualAttempt: attemptedAt } : {})
    };
    Market.writeMeta(marketMeta);
    renderMarketStatus();

    marketRefreshPromise = (async () => {
      try {
        const response = await Market.fetchQuotes(settings.workerUrl, request);
        const applied = Market.applyQuoteResponse(state, derived, response);
        const expected = request.stocks.length + request.options.length;
        const updated = applied.stocksUpdated + applied.optionsUpdated;
        if (updated > 0) {
          state = Storage.savePriceUpdate(applied.next);
          derived = Calc.calculatePortfolio(state);
        }
        const partial = updated < expected || applied.errors.length > 0;
        marketMeta = {
          ...marketMeta,
          status: updated === 0 ? "unavailable" : partial ? "partial" : "success",
          message: updated === 0
            ? "Aucun prix fiable reçu; anciens prix conservés."
            : partial
              ? `${updated} prix sur ${expected} mis à jour; anciens prix conservés pour les autres.`
              : "Prix actualisés automatiquement.",
          lastSuccess: updated > 0 ? (response.retrievedAt || new Date().toISOString()) : marketMeta.lastSuccess,
          provider: response.provider || "Market Data",
          dataType: response.dataType || "REALTIME_OR_DELAYED",
          errors: applied.errors
        };
        Market.writeMeta(marketMeta);
        renderAll();
        if (manual) toast(marketMeta.message, partial ? "error" : "success");
        return updated > 0;
      } catch {
        marketMeta = {
          ...marketMeta,
          status: "unavailable",
          message: "Service temporairement indisponible; anciens prix conservés."
        };
        Market.writeMeta(marketMeta);
        renderMarketStatus();
        if (manual) toast(marketMeta.message, "error");
        return false;
      } finally {
        marketRefreshPromise = null;
      }
    })();
    return marketRefreshPromise;
  }

  function switchView(view) {
    currentView = VIEW_TITLES[view] ? view : "dashboard";
    $$(".view").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === currentView));
    $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === currentView));
    $("#pageTitle").textContent = VIEW_TITLES[currentView];
    closeSidebar();
    if (currentView === "security") renderSecurity();
    if (currentView === "prices") renderPrices();
    if (currentView === "operations") renderTransactions();
    $("#mainContent").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openSidebar() {
    $("#sidebar").classList.add("open");
    $("#sidebarOverlay").hidden = false;
  }

  function closeSidebar() {
    $("#sidebar").classList.remove("open");
    $("#sidebarOverlay").hidden = true;
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    modal.hidden = false;
    document.body.classList.add("modal-open");
    window.setTimeout(() => $("input, select, button", modal)?.focus(), 0);
  }

  function closeModal(id) {
    document.getElementById(id).hidden = true;
    document.body.classList.remove("modal-open");
  }

  function kpiCard(label, value, options = {}) {
    return `
      <article class="kpi-card ${options.tone || ""}">
        <div class="kpi-label"><span>${escapeHtml(label)}</span>${options.hint ? `<small>${escapeHtml(options.hint)}</small>` : ""}</div>
        <strong class="${options.valueClass || ""}">${escapeHtml(value)}</strong>
        ${options.caption ? `<p>${escapeHtml(options.caption)}</p>` : ""}
      </article>`;
  }

  function renderDashboard() {
    const account = derived.account;
    $("#dashboardKpis").innerHTML = [
      kpiCard("Capital net déposé", formatMoney(account.netDeposits), { hint: "Dépôts − retraits", tone: "accent" }),
      kpiCard("Valeur totale", formatMoney(account.totalValue), { hint: "Portefeuille", tone: "accent" }),
      kpiCard("Liquidités", formatMoney(account.cash), { valueClass: valueClass(account.cash) }),
      kpiCard("Marge utilisée", formatMoney(account.marginUsed), { hint: "Liquidités négatives" }),
      kpiCard("Garantie requise", formatMoney(account.guaranteeRequired)),
      kpiCard("Marge disponible", formatMoney(account.marginAvailable), { valueClass: valueClass(account.marginAvailable) }),
      kpiCard("Primes reçues", formatMoney(account.premiumsReceived), { valueClass: "positive" }),
      kpiCard("Dividendes nets", formatMoney(account.dividendsNet), { valueClass: "positive" }),
      kpiCard("P/L réalisé", formatMoney(account.realizedPL), { valueClass: valueClass(account.realizedPL) }),
      kpiCard("P/L non réalisé", formatMoney(account.unrealizedPL), { valueClass: valueClass(account.unrealizedPL) }),
      kpiCard("P/L économique", formatMoney(account.economicPL), { valueClass: valueClass(account.economicPL), tone: "highlight" }),
      kpiCard("Rendement global", formatPercent(account.returnPercent), { valueClass: valueClass(account.returnPercent), tone: "highlight" })
    ].join("");

    const activeSecurities = derived.securities.filter((security) => security.active);
    $("#portfolioBody").innerHTML = activeSecurities.length
      ? activeSecurities.map((security) => `
        <tr class="clickable-row" data-security-row="${escapeHtml(security.symbol)}" tabindex="0">
          <td><div class="symbol-cell"><span>${escapeHtml(security.symbol)}</span><div><strong>${escapeHtml(security.name)}</strong><small>${escapeHtml(typeLabel(security.type))}</small></div></div></td>
          <td>${formatMoney(security.capitalEngaged)}</td>
          <td>${formatMoney(security.currentValue)}</td>
          <td class="positive">${formatMoney(security.revenues)}</td>
          <td class="${valueClass(security.realizedPL)}">${formatMoney(security.realizedPL)}</td>
          <td class="${valueClass(security.unrealizedPL)}">${formatMoney(security.unrealizedPL)}</td>
          <td class="${valueClass(security.economicPL)}"><strong>${formatMoney(security.economicPL)}</strong></td>
        </tr>`).join("")
      : emptyRow(7, "Aucun titre actif.");

    const allocationTotal = activeSecurities.reduce((sum, security) => sum + Math.max(0, security.capitalEngaged), 0);
    $("#allocationChart").innerHTML = allocationTotal > 0
      ? activeSecurities.map((security, index) => {
        const percentage = security.capitalEngaged / allocationTotal * 100;
        return `
          <div class="allocation-row">
            <div><span class="chart-dot tone-${index % 5}"></span><strong>${escapeHtml(security.symbol)}</strong><small>${formatMoney(security.capitalEngaged)}</small></div>
            <div class="bar-track"><span class="bar-fill tone-${index % 5}" style="width:${Math.max(2, percentage)}%"></span></div>
            <b>${formatNumber(percentage, 1)} %</b>
          </div>`;
      }).join("")
      : emptyState("Aucun capital engagé pour le moment.");

    const alerts = buildAlerts();
    $("#alertCount").textContent = alerts.length;
    $("#alertsList").innerHTML = alerts.length
      ? alerts.map((alert) => `<div class="alert-item ${alert.level}"><span aria-hidden="true">${alert.icon}</span><div><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.message)}</small></div></div>`).join("")
      : `<div class="all-good"><span aria-hidden="true">✓</span><div><strong>Aucune alerte importante</strong><small>Les données saisies sont cohérentes.</small></div></div>`;

    const todayKey = new Date().toISOString().slice(0, 10);
    const futureExpirations = History.sortFutureExpirationsAscending(
      derived.openOptions.filter((option) => option.expiration >= todayKey)
    );
    const pastExpirations = History.sortHistoricalDescending(
      derived.openOptions
        .filter((option) => option.expiration < todayKey)
        .map((option) => ({ ...option, date: option.expiration, id: option.contractId }))
    );
    $("#upcomingExpirations").innerHTML = futureExpirations.length
      ? futureExpirations.slice(0, 6).map((option) => `
        <div class="expiry-card">
          <span class="option-side ${option.side.toLowerCase()}">${option.side === "SHORT" ? "COURTE" : "LONGUE"}</span>
          <strong>${escapeHtml(option.symbol)} ${escapeHtml(option.optionType)} ${formatMoney(option.strike)}</strong>
          <small>${formatDate(option.expiration)} · ${option.contractsOpen} contrat(s)</small>
        </div>`).join("")
      : emptyState("Aucune option ouverte.");
    $("#pastExpirations").innerHTML = pastExpirations.length
      ? `<h4>Échéances passées à régulariser — plus récentes en premier</h4>
        <div class="past-expirations-list">${pastExpirations.map((option) => `
          <div><span>${escapeHtml(option.symbol)} ${escapeHtml(option.optionType)} ${formatMoney(option.strike)}</span><strong>${formatDate(option.expiration)}</strong></div>`).join("")}</div>`
      : "";

    const updates = Object.values(state.prices || {})
      .map((item) => item.updatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    $("#dashboardUpdated").textContent = updates.length
      ? `Dernière mise à jour des prix : ${formatDateTime(updates[0])}`
      : "Aucun prix n’a encore été saisi.";
  }

  function buildAlerts() {
    const alerts = [];
    if (derived.account.marginAvailable < 0) {
      alerts.push({ level: "danger", icon: "!", title: "Marge disponible négative", message: "Vérifiez rapidement le compte et les exigences de garantie." });
    }
    for (const security of derived.securities.filter((item) => item.active)) {
      const updatedAt = state.prices?.[security.symbol]?.updatedAt;
      if (!updatedAt) {
        alerts.push({ level: "warning", icon: "○", title: `Prix manquant — ${security.symbol}`, message: "Ajoutez un prix pour calculer la valeur actuelle." });
      } else {
        const ageDays = (Date.now() - new Date(updatedAt).getTime()) / 86400000;
        if (ageDays > 7) alerts.push({ level: "warning", icon: "◷", title: `Prix ancien — ${security.symbol}`, message: `Dernière saisie le ${formatDate(updatedAt)}.` });
      }
    }
    const today = new Date();
    for (const option of derived.openOptions) {
      const days = Math.ceil((new Date(`${option.expiration}T12:00:00`) - today) / 86400000);
      if (days >= 0 && days <= 7) {
        alerts.push({ level: "warning", icon: "◷", title: `Échéance proche — ${option.symbol}`, message: `${option.optionType} ${formatMoney(option.strike)} dans ${days} jour(s).` });
      }
      if (days < 0) {
        alerts.push({ level: "danger", icon: "!", title: `Option échue — ${option.symbol}`, message: "Enregistrez l’expiration, l’assignation ou l’exercice." });
      }
    }
    for (const error of derived.errors) {
      alerts.push({ level: "danger", icon: "!", title: "Transaction à vérifier", message: error.message });
    }
    return alerts;
  }

  function renderSecurityPicker() {
    const securities = state.securities.filter((security) => security.active !== false);
    if (!securities.some((security) => security.symbol === selectedSymbol)) {
      selectedSymbol = securities[0]?.symbol || "";
    }
    $("#securityPicker").innerHTML = securities.map((security) => `<option value="${escapeHtml(security.symbol)}">${escapeHtml(security.symbol)} — ${escapeHtml(security.name)}</option>`).join("");
    $("#securityPicker").value = selectedSymbol;
  }

  function renderSecurity() {
    renderSecurityPicker();
    const security = derived.securities.find((item) => item.symbol === selectedSymbol);
    if (!security) return;
    const source = state.securities.find((item) => item.symbol === selectedSymbol);
    const priceInfo = state.prices?.[selectedSymbol];
    $("#securityMonogram").textContent = selectedSymbol.slice(0, 3);
    $("#securityName").textContent = security.name;
    $("#securityType").textContent = typeLabel(security.type);
    $("#securityPrice").textContent = formatMoney(security.currentPrice);
    $("#securityPriceDate").textContent = priceInfo?.updatedAt
      ? `${priceInfo.source === "Market Data" ? "● Market Data · " : "Prix manuel · "}mis à jour ${formatDateTime(priceInfo.updatedAt)}`
      : "prix non saisi";

    $("#securityKpis").innerHTML = [
      kpiCard("Actions détenues", formatNumber(security.shares, 6)),
      kpiCard("Coût moyen", formatMoney(security.averageCost)),
      kpiCard("Valeur actuelle", formatMoney(security.currentValue), { tone: "accent" }),
      kpiCard("Capital engagé", formatMoney(security.capitalEngaged)),
      kpiCard("Garantie requise", formatMoney(security.guaranteeRequired)),
      kpiCard("Primes reçues", formatMoney(security.premiumsReceived), { valueClass: "positive" }),
      kpiCard("Dividendes nets", formatMoney(security.dividendsNet), { valueClass: "positive" }),
      kpiCard("P/L économique", formatMoney(security.economicPL), { valueClass: valueClass(security.economicPL), tone: "highlight" })
    ].join("");

    const details = [
      ["Symbole", security.symbol],
      ["Type", typeLabel(security.type)],
      ["Devise", security.currency],
      ["Prix actuel", formatMoney(security.currentPrice)],
      ["Quantité d’actions", formatNumber(security.shares, 6)],
      ["Valeur comptable", formatMoney(security.stockBookValue)],
      ["P/L réalisé", formatMoney(security.realizedPL)],
      ["P/L non réalisé", formatMoney(security.unrealizedPL)],
      ["Options ouvertes", String(security.optionsOpen.length)],
      ["Exigence de garantie", formatPercent((source?.marginRequirement || 0) * 100)]
    ];
    $("#securityDetails").innerHTML = details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");

    const riskTone = security.riskLevel === "Élevé" ? "danger" : security.riskLevel === "Modéré" ? "warning" : "success";
    $("#securityRisk").innerHTML = `
      <span class="risk-indicator ${riskTone}">${escapeHtml(security.riskLevel)}</span>
      <p>${security.riskLevel === "Élevé"
        ? "Une exigence de marge manuelle est associée à une option courte."
        : security.riskLevel === "Modéré"
          ? "Une ou plusieurs options sont ouvertes. Surveillez leurs échéances."
          : "Aucune option ouverte ni exigence particulière n’est détectée."}</p>`;

    $("#securityOptionsBody").innerHTML = security.optionsOpen.length
      ? security.optionsOpen.map((option) => `
        <tr><td><code>${escapeHtml(option.contractId)}</code></td><td>${option.side === "SHORT" ? "Courte" : "Longue"} ${escapeHtml(option.optionType)}</td><td>${formatDate(option.expiration)}</td><td>${formatMoney(option.strike)}</td><td>${option.contractsOpen}</td><td>${formatMoney(option.currentPrice)}</td><td class="${valueClass(option.unrealizedPL)}">${formatMoney(option.unrealizedPL)}</td></tr>`).join("")
      : emptyRow(7, "Aucune option ouverte pour ce titre.");

    const transactions = History.sortHistoricalDescending(
      state.transactions.filter((transaction) => transaction.symbol === selectedSymbol)
    ).slice(0, 12);
    $("#securityTransactionsBody").innerHTML = transactions.length
      ? transactions.map((transaction) => `<tr><td>${formatDate(transaction.date)}</td><td>${escapeHtml(Forms.TYPE_LABELS[transaction.type] || transaction.type)}</td><td>${transactionDetails(transaction)}</td><td>${escapeHtml(transaction.note || "—")}</td></tr>`).join("")
      : emptyRow(4, "Aucune transaction pour ce titre.");
  }

  function renderTransactions() {
    const search = $("#transactionSearch").value.trim().toLowerCase();
    const symbolFilter = $("#transactionSymbolFilter").value;
    const rows = History.sortHistoricalDescending(state.transactions).filter((transaction) => {
      if (symbolFilter && transaction.symbol !== symbolFilter) return false;
      const haystack = `${transaction.symbol || ""} ${Forms.TYPE_LABELS[transaction.type] || transaction.type} ${transaction.note || ""}`.toLowerCase();
      return !search || haystack.includes(search);
    });
    $("#transactionsBody").innerHTML = rows.length
      ? rows.map((transaction) => {
        const flow = displayCashFlow(transaction);
        return `<tr><td>${formatDate(transaction.date)}</td><td>${escapeHtml(transaction.symbol || "Compte")}</td><td>${escapeHtml(Forms.TYPE_LABELS[transaction.type] || transaction.type)}</td><td>${transactionDetails(transaction)}</td><td class="${valueClass(flow)}">${flow == null ? "—" : formatMoney(flow)}</td><td>${escapeHtml(transaction.note || "—")}</td></tr>`;
      }).join("")
      : emptyRow(6, "Aucune opération ne correspond aux filtres.");
  }

  function transactionDetails(transaction) {
    if (Forms.STOCK_TYPES.has(transaction.type)) return `${formatNumber(transaction.quantity, 6)} action(s) à ${formatMoney(transaction.price)}`;
    if (Forms.OPTION_OPEN_TYPES.has(transaction.type)) return `${transaction.contracts} ${escapeHtml(transaction.optionType)} · strike ${formatMoney(transaction.strike)} · ${formatDate(transaction.expiration)}`;
    if (Forms.OPTION_CLOSE_TYPES.has(transaction.type)) return `${transaction.contracts} contrat(s) · prime ${formatMoney(transaction.premium)}`;
    if (Forms.OPTION_EVENT_TYPES.has(transaction.type)) return `${transaction.contracts} contrat(s) · ${escapeHtml(transaction.contractId || "")}`;
    if (transaction.type === "DIVIDEND") return `Brut ${formatMoney(transaction.grossAmount)} · retenue ${formatMoney(transaction.taxWithheld)}`;
    if (Forms.ACCOUNT_TYPES.has(transaction.type)) return formatMoney(transaction.amount);
    return "—";
  }

  function displayCashFlow(transaction) {
    if (["OPTION_ASSIGNMENT", "OPTION_EXERCISE"].includes(transaction.type)) {
      const opening = state.transactions.find((item) => item.contractId === transaction.contractId && Forms.OPTION_OPEN_TYPES.has(item.type));
      if (!opening) return null;
      const shares = (Number(transaction.contracts) || 0) * 100;
      if (opening.optionType === "PUT") return transaction.type === "OPTION_ASSIGNMENT" ? -shares * opening.strike : shares * opening.strike;
      return transaction.type === "OPTION_ASSIGNMENT" ? shares * opening.strike : -shares * opening.strike;
    }
    return Calc.transactionCashFlow(transaction);
  }

  function renderPrices() {
    const now = localDateTimeValue();
    $("#securityPriceForms").innerHTML = state.securities.filter((security) => security.active !== false).map((security) => {
      const existing = state.prices?.[security.symbol] || {};
      return `
        <form class="price-row" data-security-price="${escapeHtml(security.symbol)}">
          <div class="price-title"><span>${escapeHtml(security.symbol)}</span><div><strong>${escapeHtml(security.name)}</strong><small>${existing.updatedAt ? `${existing.source === "Market Data" ? "Market Data" : "Prix manuel"} · ${formatDateTime(existing.updatedAt)}` : "Aucun prix saisi"}</small></div></div>
          <label>Prix actuel (USD)<input name="price" type="number" min="0" step="0.0001" value="${escapeHtml(existing.price ?? "")}" required></label>
          <label>Date et heure<input name="updatedAt" type="datetime-local" value="${escapeHtml(existing.updatedAt ? localDateTimeValue(existing.updatedAt) : now)}" required></label>
          <button class="button button-secondary compact" type="submit">Enregistrer</button>
        </form>`;
    }).join("");

    $("#optionPriceForms").innerHTML = derived.openOptions.length
      ? derived.openOptions.map((option) => {
        const existing = state.optionPrices?.[option.contractId] || {};
        return `
          <form class="price-row" data-option-price="${escapeHtml(option.contractId)}">
            <div class="price-title"><span>${escapeHtml(option.symbol)}</span><div><strong>${escapeHtml(option.optionType)} ${formatMoney(option.strike)} · ${option.side === "SHORT" ? "courte" : "longue"}</strong><small>${existing.source === "Market Data" ? "Market Data · " : ""}Échéance ${formatDate(option.expiration)}</small></div></div>
            <label>Prix actuel par action<input name="price" type="number" min="0" step="0.0001" value="${escapeHtml(existing.price ?? "")}" required></label>
            <label>Date et heure<input name="updatedAt" type="datetime-local" value="${escapeHtml(existing.updatedAt ? localDateTimeValue(existing.updatedAt) : now)}" required></label>
            <button class="button button-secondary compact" type="submit">Enregistrer</button>
          </form>`;
      }).join("")
      : emptyState("Aucune option ouverte à mettre à jour.");
  }

  function renderSecurities() {
    $("#securitiesBody").innerHTML = state.securities.map((security) => `
      <tr>
        <td><strong>${escapeHtml(security.symbol)}</strong></td>
        <td>${escapeHtml(security.name)}</td>
        <td>${escapeHtml(typeLabel(security.type))}</td>
        <td>${escapeHtml(security.currency)}</td>
        <td>${security.marginEligible ? "Admissible" : "Non admissible"}</td>
        <td>${formatPercent(Number(security.marginRequirement) * 100)}</td>
        <td><span class="status-badge ${security.active ? "active" : "inactive"}">${security.active ? "Actif" : "Désactivé"}</span></td>
        <td><button class="text-button" type="button" data-edit-security="${escapeHtml(security.id)}">Modifier</button></td>
      </tr>`).join("");
  }

  function renderFilters() {
    const options = state.securities.map((security) => `<option value="${escapeHtml(security.symbol)}">${escapeHtml(security.symbol)}</option>`).join("");
    const current = $("#transactionSymbolFilter").value;
    $("#transactionSymbolFilter").innerHTML = `<option value="">Tous les titres</option>${options}`;
    $("#transactionSymbolFilter").value = current;
  }

  function renderSettings() {
    const marketSettings = getMarketSettings();
    $("#accountName").value = state.accountSettings.accountName || "";
    $("#baseCurrency").value = state.accountSettings.baseCurrency || "USD";
    $("#marginInterestRate").value = Number(state.accountSettings.marginInterestRate) || 0;
    $("#automaticPricesEnabled").checked = marketSettings.enabled;
    $("#marketDataWorkerUrl").value = marketSettings.workerUrl;
  }

  function renderAll() {
    derived = Calc.calculatePortfolio(state);
    $("#demoBanner").hidden = !state.demoMode;
    renderDashboard();
    renderSecurity();
    renderFilters();
    renderTransactions();
    renderPrices();
    renderSecurities();
    renderSettings();
    renderMarketStatus();
  }

  function typeLabel(type) {
    return type === "FNB" ? "FNB" : type === "ACTION" ? "Action" : "Autre";
  }

  function emptyRow(columns, message) {
    return `<tr><td colspan="${columns}"><div class="empty-inline">${escapeHtml(message)}</div></td></tr>`;
  }

  function emptyState(message) {
    return `<div class="empty-state"><span aria-hidden="true">○</span><p>${escapeHtml(message)}</p></div>`;
  }

  function populateOperationSelects() {
    $("#operationType").innerHTML = Object.entries(Forms.TYPE_LABELS)
      .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join("");
    $("#operationSymbol").innerHTML = state.securities.filter((security) => security.active !== false)
      .map((security) => `<option value="${escapeHtml(security.symbol)}">${escapeHtml(security.symbol)} — ${escapeHtml(security.name)}</option>`).join("");
  }

  function openOperationModal() {
    populateOperationSelects();
    $("#operationForm").reset();
    $("#operationDate").value = new Date().toISOString().slice(0, 10);
    $("#operationType").value = "DEPOSIT";
    $("#operationFees").value = "0";
    $("#dividendTax").value = "0";
    $("#shortMarginRequirement").value = "0";
    showErrors($("#operationErrors"), []);
    updateOperationFields();
    openModal("operationModal");
  }

  function filteredOptionsForType(type) {
    return derived.openOptions.filter((option) => {
      if (type === "OPTION_BUY_CLOSE") return option.side === "SHORT";
      if (type === "OPTION_SELL_CLOSE") return option.side === "LONG";
      if (type === "OPTION_ASSIGNMENT") return option.side === "SHORT";
      if (type === "OPTION_EXERCISE") return option.side === "LONG";
      return true;
    });
  }

  function updateOperationFields() {
    const type = $("#operationType").value;
    const account = Forms.ACCOUNT_TYPES.has(type);
    const stock = Forms.STOCK_TYPES.has(type);
    const open = Forms.OPTION_OPEN_TYPES.has(type);
    const close = Forms.OPTION_CLOSE_TYPES.has(type);
    const event = Forms.OPTION_EVENT_TYPES.has(type);
    const option = open || close || event;

    $$("[data-operation-group]").forEach((field) => {
      const group = field.dataset.operationGroup;
      const visible =
        (group === "security" && !account)
        || (group === "amount" && account)
        || (group === "stock" && stock)
        || (group === "option-open" && open)
        || (group === "option-existing" && (close || event))
        || (group === "option" && option)
        || (group === "option-premium" && (open || close))
        || (group === "short-margin" && type === "OPTION_SELL_OPEN")
        || (group === "dividend" && type === "DIVIDEND")
        || (group === "fees" && (stock || option));
      field.hidden = !visible;
      $$("input, select", field).forEach((input) => { input.disabled = !visible; });
    });

    if (close || event) {
      const options = filteredOptionsForType(type);
      $("#existingContract").innerHTML = options.length
        ? options.map((item) => `<option value="${escapeHtml(item.contractId)}">${escapeHtml(item.symbol)} · ${item.optionType} ${formatMoney(item.strike)} · ${formatDate(item.expiration)} · ${item.contractsOpen} contrat(s)</option>`).join("")
        : `<option value="">Aucun contrat compatible</option>`;
      syncExistingContract();
    }
    updateOperationPreview();
  }

  function syncExistingContract() {
    const option = derived.openOptions.find((item) => item.contractId === $("#existingContract").value);
    if (!option) return;
    $("#operationSymbol").value = option.symbol;
    $("#optionContracts").value = option.contractsOpen;
    $("#optionContracts").max = option.contractsOpen;
  }

  function updateOperationPreview() {
    const type = $("#operationType").value;
    let message = "Le montant sera calculé automatiquement.";
    if (Forms.STOCK_TYPES.has(type)) {
      const amount = (Number($("#stockQuantity").value) || 0) * (Number($("#stockPrice").value) || 0) + (Number($("#operationFees").value) || 0);
      message = `${type === "STOCK_BUY" ? "Débours" : "Produit"} estimé : ${formatMoney(type === "STOCK_BUY" ? amount : Math.max(0, amount - 2 * (Number($("#operationFees").value) || 0)))}`;
    } else if (Forms.OPTION_OPEN_TYPES.has(type) || Forms.OPTION_CLOSE_TYPES.has(type)) {
      const amount = (Number($("#optionContracts").value) || 0) * (Number($("#optionPremium").value) || 0) * 100;
      message = `Flux brut estimé : ${formatMoney(amount)} (${formatNumber(Number($("#optionPremium").value) || 0, 4)} × 100 × ${Number($("#optionContracts").value) || 0})`;
    } else if (type === "DIVIDEND") {
      const net = (Number($("#dividendGross").value) || 0) - (Number($("#dividendTax").value) || 0);
      message = `Dividende net estimé : ${formatMoney(net)}`;
    } else if (Forms.ACCOUNT_TYPES.has(type)) {
      message = `Montant saisi : ${formatMoney(Number($("#operationAmount").value) || 0)}`;
    }
    $("#operationPreview").textContent = message;
  }

  function buildOperationFromForm() {
    const type = $("#operationType").value;
    const transaction = {
      id: `TX-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      date: $("#operationDate").value,
      type,
      note: $("#operationNote").value.trim()
    };
    if (!Forms.ACCOUNT_TYPES.has(type)) transaction.symbol = $("#operationSymbol").value;
    if (Forms.ACCOUNT_TYPES.has(type)) transaction.amount = Number($("#operationAmount").value);
    if (Forms.STOCK_TYPES.has(type)) {
      transaction.quantity = Number($("#stockQuantity").value);
      transaction.price = Number($("#stockPrice").value);
      transaction.fees = Number($("#operationFees").value || 0);
    }
    if (type === "DIVIDEND") {
      transaction.grossAmount = Number($("#dividendGross").value);
      transaction.taxWithheld = Number($("#dividendTax").value || 0);
    }
    if (Forms.OPTION_OPEN_TYPES.has(type)) {
      transaction.optionType = $("#optionType").value;
      transaction.expiration = $("#optionExpiration").value;
      transaction.strike = Number($("#optionStrike").value);
      transaction.contracts = Number($("#optionContracts").value);
      transaction.premium = Number($("#optionPremium").value);
      transaction.fees = Number($("#operationFees").value || 0);
      transaction.shortMarginRequirement = type === "OPTION_SELL_OPEN" ? Number($("#shortMarginRequirement").value || 0) : 0;
      transaction.contractId = Forms.makeContractId(transaction);
    }
    if (Forms.OPTION_CLOSE_TYPES.has(type) || Forms.OPTION_EVENT_TYPES.has(type)) {
      const option = derived.openOptions.find((item) => item.contractId === $("#existingContract").value);
      transaction.contractId = $("#existingContract").value;
      transaction.contracts = Number($("#optionContracts").value);
      transaction.symbol = option?.symbol || transaction.symbol;
      transaction.fees = Number($("#operationFees").value || 0);
      if (Forms.OPTION_CLOSE_TYPES.has(type)) transaction.premium = Number($("#optionPremium").value);
    }
    return transaction;
  }

  function submitOperation(event) {
    event.preventDefault();
    const transaction = buildOperationFromForm();
    const validation = Forms.validateOperation(transaction, state, derived);
    showErrors($("#operationErrors"), validation.errors);
    if (!validation.valid) return;

    if (transaction.type === "OPTION_ASSIGNMENT") {
      const option = derived.openOptions.find((item) => item.contractId === transaction.contractId);
      const shares = transaction.contracts * 100;
      const action = option.optionType === "PUT" ? "acheter" : "vendre";
      const confirmed = window.confirm(
        `Confirmer l’assignation?\n\nLe contrat sera fermé et le portail enregistrera automatiquement ${action} ${shares} actions ${option.symbol} au prix d’exercice de ${formatMoney(option.strike)}.\n\nLa prime de l’option sera conservée dans le résultat.`
      );
      if (!confirmed) return;
    }

    state.transactions.push(validation.value);
    if (saveState("TRANSACTION_ADDED")) {
      closeModal("operationModal");
      toast("L’opération a été enregistrée.");
    } else {
      state.transactions.pop();
    }
  }

  function openSecurityModal(security = null) {
    $("#securityForm").reset();
    showErrors($("#securityErrors"), []);
    $("#securityId").value = security?.id || "";
    $("#securityModalTitle").textContent = security ? "Modifier le titre" : "Ajouter un titre";
    $("#securitySymbol").value = security?.symbol || "";
    $("#securitySymbol").disabled = Boolean(security);
    $("#securityFullName").value = security?.name || "";
    $("#securityFormType").value = security?.type || "ACTION";
    $("#securityCurrency").value = security?.currency || "USD";
    $("#securityMarginEligible").checked = security?.marginEligible ?? true;
    $("#securityMarginRequirement").value = (security?.marginRequirement ?? 0.30) * 100;
    $("#securityActive").checked = security?.active ?? true;
    openModal("securityModal");
  }

  function submitSecurity(event) {
    event.preventDefault();
    const id = $("#securityId").value || `SEC-${Date.now()}`;
    const security = {
      id,
      symbol: $("#securitySymbol").value.trim().toUpperCase(),
      name: $("#securityFullName").value.trim(),
      type: $("#securityFormType").value,
      currency: $("#securityCurrency").value,
      marginEligible: $("#securityMarginEligible").checked,
      marginRequirement: Number($("#securityMarginRequirement").value) / 100,
      active: $("#securityActive").checked
    };
    const validation = Forms.validateSecurity(security, state, $("#securityId").value || null);
    showErrors($("#securityErrors"), validation.errors);
    if (!validation.valid) return;
    const index = state.securities.findIndex((item) => item.id === id);
    if (index >= 0) state.securities[index] = validation.value;
    else state.securities.push(validation.value);
    if (saveState(index >= 0 ? "SECURITY_UPDATED" : "SECURITY_ADDED")) {
      closeModal("securityModal");
      toast("Le titre a été enregistré.");
    }
  }

  function submitPrice(event) {
    const securityForm = event.target.closest("[data-security-price]");
    const optionForm = event.target.closest("[data-option-price]");
    if (!securityForm && !optionForm) return;
    event.preventDefault();
    const form = securityForm || optionForm;
    const price = {
      price: Number(form.elements.price.value),
      updatedAt: new Date(form.elements.updatedAt.value).toISOString(),
      source: "Manuel",
      dataType: "MANUAL"
    };
    const validation = Forms.validatePrice(price);
    if (!validation.valid) {
      toast(validation.errors.join(" "), "error");
      return;
    }
    if (securityForm) {
      state.prices[securityForm.dataset.securityPrice] = price;
    } else {
      state.optionPrices[optionForm.dataset.optionPrice] = price;
    }
    if (saveState("PRICE_UPDATED")) {
      marketMeta = { ...marketMeta, status: "manual", message: "Prix manuel conservé." };
      Market.writeMeta(marketMeta);
      renderMarketStatus();
      toast("Le prix a été mis à jour.");
    }
  }

  function exportBackup() {
    const payload = Backup.createPayload(state);
    Backup.downloadPayload(payload);
    toast("La sauvegarde privée a été téléchargée.");
  }

  async function restoreBackup(file) {
    if (!file) return;
    try {
      const payload = await Backup.parseFile(file);
      const validation = Backup.validatePayload(payload);
      if (!validation.valid) throw new Error(validation.errors.join(" "));

      const rescue = Backup.createPayload(state, "AUTOMATIC_RESCUE_BEFORE_RESTORE");
      Backup.downloadPayload(rescue, `SECOURS_AVANT_RESTAURATION_${Backup.formatFilename()}`);
      const confirmed = window.confirm(
        `Le fichier est valide et contient ${payload.transactions.length} transaction(s).\n\nUne sauvegarde de secours vient d’être téléchargée. Voulez-vous remplacer les données actuelles?`
      );
      if (!confirmed) return;
      state = Storage.clone(payload);
      delete state.backupCreatedAt;
      delete state.backupReason;
      if (saveState("BACKUP_RESTORED")) {
        selectedSymbol = state.securities.find((security) => security.active)?.symbol || "";
        toast("La sauvegarde a été restaurée.");
        switchView("dashboard");
      }
    } catch (error) {
      toast(`Restauration impossible : ${error.message}`, "error");
    } finally {
      $("#restoreBackupInput").value = "";
    }
  }

  function removeDemo() {
    if (!window.confirm("Supprimer toutes les données fictives et commencer avec un portefeuille vide?")) return;
    state = Storage.getEmptyData();
    selectedSymbol = "F";
    if (saveState("DEMO_REMOVED")) {
      toast("Le portefeuille est maintenant vide.");
      switchView("dashboard");
    }
  }

  function eraseAllData() {
    if (!window.confirm("Première confirmation : voulez-vous vraiment effacer toutes les données locales?")) return;
    if (!window.confirm("Deuxième confirmation : cette action est irréversible sans sauvegarde. Continuer?")) return;
    state = Storage.getEmptyData();
    selectedSymbol = "F";
    if (saveState("ALL_DATA_ERASED")) {
      toast("Toutes les données ont été effacées.");
      switchView("dashboard");
    }
  }

  function submitSettings(event) {
    event.preventDefault();
    const rate = Number($("#marginInterestRate").value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast("Le taux d’intérêt doit être entre 0 % et 100 %.", "error");
      return;
    }
    const workerUrl = $("#marketDataWorkerUrl").value.trim();
    if (workerUrl && !/^https:\/\/[a-z0-9.-]+$/i.test(workerUrl)
      && !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(workerUrl)) {
      toast("L’URL du Worker doit être une adresse HTTPS valide.", "error");
      return;
    }
    state.accountSettings.accountName = $("#accountName").value.trim() || "Mon compte sur marge";
    state.accountSettings.baseCurrency = "USD";
    state.accountSettings.marginInterestRate = rate;
    state.accountSettings.stockCommission = 0;
    state.accountSettings.optionCommission = 0;
    state.accountSettings.assignmentFee = 0;
    state.accountSettings.marketData = {
      enabled: $("#automaticPricesEnabled").checked,
      workerUrl,
      frequencyMinutes: 60,
      provider: "Market Data"
    };
    if (saveState("SETTINGS_UPDATED")) {
      toast("Les paramètres ont été enregistrés.");
      if (state.accountSettings.marketData.enabled && workerUrl) refreshMarketPrices({ manual: false });
    }
  }

  function setupAutomaticRefresh() {
    if (automaticRefreshTimer) window.clearInterval(automaticRefreshTimer);
    automaticRefreshTimer = window.setInterval(() => {
      if (!document.hidden) refreshMarketPrices({ manual: false });
    }, Market.AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      const lastAttempt = marketMeta.lastAttempt ? new Date(marketMeta.lastAttempt).getTime() : 0;
      if (!lastAttempt || Date.now() - lastAttempt >= Market.AUTO_REFRESH_MS) {
        refreshMarketPrices({ manual: false });
      }
    });
    window.setTimeout(() => refreshMarketPrices({ manual: false }), 0);
  }

  function bindEvents() {
    $$(".nav-item").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
    $("#mobileMenu").addEventListener("click", openSidebar);
    $("#sidebarClose").addEventListener("click", closeSidebar);
    $("#sidebarOverlay").addEventListener("click", closeSidebar);
    $$("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
    $$(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) closeModal(backdrop.id);
    }));

    ["topAddOperation", "dashboardAdd", "operationsAdd"].forEach((id) => document.getElementById(id).addEventListener("click", openOperationModal));
    $("#dashboardPrices").addEventListener("click", () => switchView("prices"));
    $("#refreshMarketPrices").addEventListener("click", () => refreshMarketPrices({ manual: true }));
    $("#removeDemoButton").addEventListener("click", removeDemo);
    $("#operationType").addEventListener("change", updateOperationFields);
    $("#existingContract").addEventListener("change", () => { syncExistingContract(); updateOperationPreview(); });
    $("#operationForm").addEventListener("input", updateOperationPreview);
    $("#operationForm").addEventListener("submit", submitOperation);
    $("#addSecurityButton").addEventListener("click", () => openSecurityModal());
    $("#securityForm").addEventListener("submit", submitSecurity);
    $("#securitiesBody").addEventListener("click", (event) => {
      const button = event.target.closest("[data-edit-security]");
      if (button) openSecurityModal(state.securities.find((security) => security.id === button.dataset.editSecurity));
    });
    $("#securityPicker").addEventListener("change", (event) => {
      selectedSymbol = event.target.value;
      renderSecurity();
    });
    $("#portfolioBody").addEventListener("click", selectSecurityRow);
    $("#portfolioBody").addEventListener("keydown", (event) => {
      if (["Enter", " "].includes(event.key)) selectSecurityRow(event);
    });
    $("#transactionSearch").addEventListener("input", renderTransactions);
    $("#transactionSymbolFilter").addEventListener("change", renderTransactions);
    $("[data-view-panel='prices']").addEventListener("submit", submitPrice);
    $("#exportBackupButton").addEventListener("click", exportBackup);
    $("#restoreBackupInput").addEventListener("change", (event) => restoreBackup(event.target.files[0]));
    $("#settingsForm").addEventListener("submit", submitSettings);
    $("#eraseAllButton").addEventListener("click", eraseAllData);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const open = $$(".modal-backdrop").find((modal) => !modal.hidden);
      if (open) closeModal(open.id);
      else closeSidebar();
    });
  }

  function selectSecurityRow(event) {
    const row = event.target.closest("[data-security-row]");
    if (!row) return;
    selectedSymbol = row.dataset.securityRow;
    switchView("security");
  }

  function initialize() {
    populateOperationSelects();
    bindEvents();
    renderAll();
    setupAutomaticRefresh();
    window.__PORTAL_READY__ = true;
    window.__PORTAL_STATE__ = () => Storage.clone(state);
    window.__PORTAL_DERIVED__ = () => Calc.calculatePortfolio(state);
  }

  initialize();
})();
