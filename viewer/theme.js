/**
 * Module: Viewer Theme Bridge
 * Documentation: documentation/architecture/ui.md
 * Depends: none
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const TOKEN_MAP = [
    ["--avnav-fore-color", "--polarrecorder-fore-color"],
    ["--avnav-back-color", "--polarrecorder-back-color"],
    ["--avnav-main-color", "--polarrecorder-main-color"],
    ["--avnav-second-color", "--polarrecorder-second-color"],
    ["--avnav-attention-color", "--polarrecorder-attention-color"],
    ["--avnav-active-color", "--polarrecorder-active-color"],
    ["--avnav-border-color", "--polarrecorder-border-color"],
    ["--avnav-widget-head-color", "--polarrecorder-widget-head-color"],
    ["--avnav-back-color", "--polarrecorder-surface-color"],
    ["--avnav-second-color", "--polarrecorder-surface-variant"],
    ["--avnav-active-color", "--polarrecorder-accepted-color"],
    ["--avnav-attention-color", "--polarrecorder-rejected-color"]
  ];

  document.addEventListener("DOMContentLoaded", start);

  function start() {
    syncTheme();
    window.setInterval(syncTheme, 1000);
  }

  function syncTheme() {
    const source = avNavThemeSource();
    document.body.classList.toggle("nightMode", !!(source && source.nightMode));
    if (!source) {
      clearTokens();
      return;
    }
    copyTokens(source);
  }

  function avNavThemeSource() {
    const sourceDocument = avNavDocument();
    if (!sourceDocument) return null;
    const nightElement = sourceDocument.querySelector(".nightMode");
    return {
      element: nightElement || sourceDocument.documentElement,
      fontElement: sourceDocument.body || sourceDocument.documentElement,
      nightMode: !!nightElement,
      window: sourceDocument.defaultView || window.parent
    };
  }

  function avNavDocument() {
    try {
      return window.parent && window.parent !== window ? window.parent.document : null;
    } catch (_error) {
      return null;
    }
  }

  function copyTokens(source) {
    const sourceStyle = source.window.getComputedStyle(source.element);
    TOKEN_MAP.forEach(function (entry) {
      const value = sourceStyle.getPropertyValue(entry[0]).trim();
      if (value) document.body.style.setProperty(entry[1], value);
    });
    const fontFamily = source.window.getComputedStyle(source.fontElement).fontFamily;
    if (fontFamily) {
      document.body.style.setProperty("--polarrecorder-font-stack", fontFamily);
    }
  }

  function clearTokens() {
    TOKEN_MAP.forEach(function (entry) {
      document.body.style.removeProperty(entry[1]);
    });
    document.body.style.removeProperty("--polarrecorder-font-stack");
  }
}());
