/**
 * Module: DOM Helpers
 * Documentation: documentation/architecture/ui.md
 * Depends: (none)
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;

  function button(text, handler, className) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className + " state-layer";
    node.textContent = text;
    node.addEventListener("click", handler);
    return node;
  }

  function actionRow(buttons) {
    const row = document.createElement("div");
    row.className = "action-row";
    buttons.forEach(function (item) {
      row.appendChild(item);
    });
    return row;
  }

  function node(tag, className, text) {
    const created = document.createElement(tag);
    created.className = className || "";
    if (text !== undefined && text !== null) {
      created.textContent = String(text);
    }
    return created;
  }

  function download(filename, text, type) {
    const blob = new Blob([text], { type: type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  Polarrecorder.Dom = {
    ActionRow: actionRow,
    Button: button,
    Download: download,
    Node: node
  };
})();
