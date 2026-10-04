/**
 * @file Import Upload
 * Documentation: documentation/architecture/import-restore.md
 * Depends: viewer.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  const IMPORT_CHUNK_CHARS = 4000;
  const BYTES_PER_MIB = 1024 * 1024;

  /** @typedef {{token: string, max_bytes: number, max_chunks: number}} ImportBeginResponse */
  /**
   * @typedef {{
   *   presets_restored?: number,
   *   bins_restored?: number,
   *   total_accepted?: number,
   *   migrated_from_version?: number
   * }} ImportRestoreResult
   */

  /**
   * Uploads one backup; an oversized file is rejected after `import/begin` and before any chunk is sent.
   * @param {string} kind
   * @param {string} text
   * @param {(summary: string) => void} onSummary
   * @param {(message: string) => void} onError
   * @param {(sent: number, total: number) => void} onProgress
   */
  function uploadBackup(kind, text, onSummary, onError, onProgress) {
    let token = "";
    fetchJson("import/begin?kind=" + encodeURIComponent(kind))
      .then(function (/** @type {ImportBeginResponse} */ begin) {
        token = begin.token;
        const total = Math.ceil(text.length / IMPORT_CHUNK_CHARS);
        const bytes = new TextEncoder().encode(text).length;
        if (bytes > begin.max_bytes || total > begin.max_chunks) {
          throw new Error(
            "Backup file is " + mebibytes(bytes) + ", above the " + mebibytes(begin.max_bytes) + " restore limit."
          );
        }
        return sendChunks(token, text, total, onProgress);
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
   * @param {number} total
   * @param {(sent: number, total: number) => void} onProgress
   * @returns {Promise<void>}
   */
  function sendChunks(token, text, total, onProgress) {
    let chain = Promise.resolve();
    for (let index = 0; index < total; index += 1) {
      const start = index * IMPORT_CHUNK_CHARS;
      const slice = text.slice(start, start + IMPORT_CHUNK_CHARS);
      chain = chain
        .then(function () {
          return fetchJson(
            "import/chunk?token=" +
              encodeURIComponent(token) +
              "&seq=" +
              String(index) +
              "&data=" +
              encodeURIComponent(slice)
          );
        })
        .then(function () {
          onProgress(index + 1, total);
        });
    }
    return chain;
  }

  /**
   * @param {number} bytes
   * @returns {string}
   */
  function mebibytes(bytes) {
    return (bytes / BYTES_PER_MIB).toFixed(1) + " MiB";
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
