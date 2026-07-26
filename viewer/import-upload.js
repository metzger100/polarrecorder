/**
 * Module: Import Upload
 * Documentation: documentation/architecture/import-restore.md
 * Depends: viewer.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  const IMPORT_CHUNK_CHARS = 4000;

  /** @typedef {{token: string}} ImportBeginResponse */
  /**
   * @typedef {{
   *   presets_restored?: number,
   *   bins_restored?: number,
   *   total_accepted?: number,
   *   migrated_from_version?: number
   * }} ImportRestoreResult
   */

  /**
   * @param {string} kind
   * @param {string} text
   * @param {(summary: string) => void} onSummary
   * @param {(message: string) => void} onError
   */
  function uploadBackup(kind, text, onSummary, onError) {
    let token = "";
    fetchJson("import/begin?kind=" + encodeURIComponent(kind))
      .then(function (begin) {
        token = begin.token;
        return sendChunks(token, text);
      })
      .then(function () {
        return fetchJson("import/commit?token=" + encodeURIComponent(token) + "&confirm=yes");
      })
      .then(function (data) {
        onSummary(summaryText(kind, data));
      })
      .catch(function (error) {
        abortQuietly(token);
        onError(error.message);
      });
  }

  /**
   * @param {string} token
   * @param {string} text
   * @returns {Promise<void>}
   */
  function sendChunks(token, text) {
    let chain = Promise.resolve();
    let seq = 0;
    for (let start = 0; start < text.length; start += IMPORT_CHUNK_CHARS) {
      const slice = text.slice(start, start + IMPORT_CHUNK_CHARS);
      const index = seq;
      chain = chain.then(function () {
        return fetchJson(
          "import/chunk?token=" +
            encodeURIComponent(token) +
            "&seq=" +
            String(index) +
            "&data=" +
            encodeURIComponent(slice)
        );
      });
      seq += 1;
    }
    return chain;
  }

  /** @param {string} token */
  function abortQuietly(token) {
    if (!token) return;
    fetchJson("import/abort?token=" + encodeURIComponent(token)).catch(reportAbortIssue);
  }

  /** @returns {undefined} */
  function reportAbortIssue() {
    // Abort is best-effort cleanup after the real error was already surfaced.
    return undefined;
  }

  /**
   * @param {string} kind
   * @param {ImportRestoreResult} data
   * @returns {string}
   */
  function summaryText(kind, data) {
    if (kind === "presets") {
      return "Restored " + String(data.presets_restored) + " user presets.";
    }
    return (
      "Restored " +
      String(data.bins_restored) +
      " bins, " +
      String(data.total_accepted) +
      " accepted samples (backup schema v" +
      String(data.migrated_from_version) +
      ")."
    );
  }

  /**
   * @param {string} endpoint
   * @returns {Promise<any>}
   */
  function fetchJson(endpoint) {
    const fn = Polarrecorder["FetchJson"];
    return fn(endpoint, { action: true });
  }

  Polarrecorder.ImportUpload = { UploadBackup: uploadBackup };
})();
