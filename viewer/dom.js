/**
 * Module: DOM Helpers
 * Documentation: documentation/architecture/ui.md
 * Depends: (none)
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;

  /**
   * @param {string} text
   * @param {(event: MouseEvent) => void} handler
   * @param {string} className
   * @returns {HTMLButtonElement}
   */
  function button(text, handler, className) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className + " state-layer";
    node.textContent = text;
    node.addEventListener("click", handler);
    return node;
  }

  /**
   * @param {HTMLElement[]} buttons
   * @returns {HTMLDivElement}
   */
  function actionRow(buttons) {
    const row = document.createElement("div");
    row.className = "action-row";
    buttons.forEach(function (item) {
      row.appendChild(item);
    });
    return row;
  }

  /**
   * @param {string} tag
   * @param {string} [className]
   * @param {string} [text]
   * @returns {HTMLElement}
   */
  function node(tag, className, text) {
    const created = document.createElement(tag);
    created.className = className || "";
    if (text !== undefined && text !== null) {
      created.textContent = String(text);
    }
    return created;
  }

  /** @param {HTMLElement} node */
  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  /**
   * @param {string} filename
   * @param {string} text
   * @param {string} type
   */
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

  /**
   * @param {number} x
   * @param {number} y
   * @param {string} textValue
   * @param {string} fontSize
   * @param {string} [textAnchor]
   * @returns {SVGTextElement}
   */
  function svgText(x, y, textValue, fontSize, textAnchor) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y));
    text.setAttribute("fill", "var(--polarrecorder-fore-color)");
    text.setAttribute("font-size", String(fontSize));
    if (textAnchor) text.setAttribute("text-anchor", textAnchor);
    text.textContent = textValue;
    return text;
  }

  /**
   * @param {string} id
   * @returns {HTMLElement}
   */
  function requireById(id) {
    const found = document.getElementById(id);
    if (!found) throw new Error("Missing required element: #" + id);
    return found;
  }

  /**
   * @param {string} text
   * @param {number} x
   * @param {number} y
   */
  function showTooltip(text, x, y) {
    const existing = document.querySelector(".tooltip");
    if (existing) existing.remove();
    const tip = node("div", "tooltip", text);
    if (x > window.innerWidth * 0.7) tip.classList.add("is-left");
    if (y < window.innerHeight * 0.2) tip.classList.add("is-below");
    tip.style.left = String((x / window.innerWidth) * 100) + "%";
    tip.style.top = String((y / window.innerHeight) * 100) + "%";
    document.body.appendChild(tip);
    window.setTimeout(function () {
      tip.remove();
    }, 2400);
  }

  Polarrecorder.Dom = {
    ActionRow: actionRow,
    Button: button,
    Clear: clear,
    Download: download,
    Node: node,
    RequireById: requireById,
    ShowTooltip: showTooltip,
    SvgText: svgText
  };
})();
