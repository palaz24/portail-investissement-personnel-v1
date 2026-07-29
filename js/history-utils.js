(function initHistoryUtils(globalScope) {
  "use strict";

  function timestamp(value) {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  }

  function historicalDate(item) {
    return item?.date || item?.at || item?.updatedAt || item?.createdAt || "";
  }

  function compareHistoricalDescending(a, b) {
    const byDate = timestamp(historicalDate(b)) - timestamp(historicalDate(a));
    if (byDate) return byDate;
    const byCreatedAt = timestamp(b?.createdAt) - timestamp(a?.createdAt);
    if (byCreatedAt) return byCreatedAt;
    const byId = String(b?.id || "").localeCompare(String(a?.id || ""), "fr-CA", {
      numeric: true,
      sensitivity: "base"
    });
    if (byId) return byId;
    return Number(b?._recordIndex ?? -1) - Number(a?._recordIndex ?? -1);
  }

  function sortHistoricalDescending(records) {
    return (records || [])
      .map((item, index) => ({ ...item, _recordIndex: index }))
      .sort(compareHistoricalDescending)
      .map(({ _recordIndex, ...item }) => item);
  }

  function sortFutureExpirationsAscending(options) {
    return [...(options || [])].sort((a, b) => {
      const byExpiration = timestamp(a?.expiration) - timestamp(b?.expiration);
      if (byExpiration) return byExpiration;
      return String(a?.contractId || "").localeCompare(String(b?.contractId || ""));
    });
  }

  const api = {
    timestamp,
    historicalDate,
    compareHistoricalDescending,
    sortHistoricalDescending,
    sortFutureExpirationsAscending
  };

  globalScope.PortalHistory = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
