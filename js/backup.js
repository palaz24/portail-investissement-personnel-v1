(function initBackup(globalScope) {
  "use strict";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createPayload(state, reason = "MANUAL_EXPORT") {
    const payload = clone(state);
    payload.version = globalScope.PortalStorage?.APP_VERSION || state.version || "1.0.0";
    payload.backupCreatedAt = new Date().toISOString();
    payload.backupReason = reason;
    return payload;
  }

  function validatePayload(payload) {
    const storageValidation = globalScope.PortalStorage
      ? globalScope.PortalStorage.validateData(payload)
      : { valid: Boolean(payload && Array.isArray(payload.transactions)), errors: [] };
    const errors = [...storageValidation.errors];
    if (!payload.backupCreatedAt && payload.backupReason) {
      errors.push("La date de création de la sauvegarde est absente.");
    }
    return { valid: errors.length === 0, errors };
  }

  function formatFilename(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    return `Portail_Investissement_Sauvegarde_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}.json`;
  }

  function downloadPayload(payload, filename = formatFilename()) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result)));
        } catch {
          reject(new Error("Le fichier sélectionné n’est pas un JSON valide."));
        }
      };
      reader.onerror = () => reject(new Error("Le fichier n’a pas pu être lu."));
      reader.readAsText(file, "utf-8");
    });
  }

  const api = {
    createPayload,
    validatePayload,
    formatFilename,
    downloadPayload,
    parseFile
  };

  globalScope.PortalBackup = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
