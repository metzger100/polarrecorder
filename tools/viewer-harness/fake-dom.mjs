/**
 * @typedef {{
 *   add: (name: string) => void,
 *   contains: (name: string) => boolean,
 *   remove: (name: string) => void,
 *   toggle: (name: string, enabled: boolean) => void
 * }} FakeClassList
 */

/**
 * @typedef {{
 *   background: string,
 *   left: string,
 *   top: string,
 *   getPropertyValue: (name: string) => string,
 *   removeProperty: (name: string) => void,
 *   setProperty: (name: string, value: unknown) => void
 * }} FakeStyle
 */

/**
 * @typedef {{ clientX: number, clientY: number }} FakeClickEvent
 */

/**
 * A fake DOM node produced by element(). Every node produced by the harness
 * carries all of these members; classList and firstChild are populated by
 * element() itself before the node is ever handed to a caller. id, onclick,
 * onfocus, and checked are genuinely absent until the harness (or the
 * vm-loaded viewer script) sets them -- checked stands in for a
 * checkbox-role <input>'s real DOM `.checked` property, and onfocus is
 * addEventListener("focus", ...)'s storage slot, mirroring onclick.
 *
 * @typedef {{
 *   attributes: Map<string, string>,
 *   checked?: boolean,
 *   children: FakeElement[],
 *   className: string,
 *   classList: FakeClassList,
 *   dataset: Record<string, string>,
 *   disabled: boolean,
 *   firstChild: FakeElement | null,
 *   hidden: boolean,
 *   id?: string,
 *   onclick?: (event: FakeClickEvent) => void,
 *   onfocus?: () => void,
 *   parentNode: FakeElement | null,
 *   style: FakeStyle,
 *   tagName: string,
 *   textContent: string,
 *   value: string,
 *   appendChild: (child: FakeElement) => FakeElement,
 *   addEventListener: (name: string, callback: (event?: unknown) => void) => void,
 *   click: () => void,
 *   closest: (selector: string) => FakeElement | null,
 *   getAttribute: (name: string) => string | undefined,
 *   querySelector: (selector: string) => FakeElement | null,
 *   querySelectorAll: (selector: string) => FakeElement[],
 *   remove: () => void,
 *   removeChild: (child: FakeElement) => FakeElement,
 *   setAttribute: (name: string, value: unknown) => void
 * }} FakeElement
 */

/**
 * @typedef {{ createObjectURL: () => string, revokeObjectURL: () => void }} FakeUrl
 */

/**
 * @param {string} tagName
 * @returns {FakeElement}
 */
export function element(tagName) {
  /** @type {FakeElement} */
  const node = {
    attributes: new Map(),
    children: [],
    className: "",
    dataset: {},
    disabled: false,
    firstChild: null,
    hidden: false,
    parentNode: null,
    style: styleBag(),
    tagName,
    textContent: "",
    value: "",
    appendChild(child) {
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    addEventListener(name, callback) {
      const bag = /** @type {Record<string, unknown>} */ (node);
      bag["on" + name] = callback;
    },
    click() {
      if (node.onclick) node.onclick({ clientX: 20, clientY: 20 });
    },
    closest(selector) {
      if (!selector.startsWith(".")) return null;
      /** @type {FakeElement | null} */
      let current = node;
      const className = selector.slice(1);
      while (current) {
        if (current.classList.contains(className)) return current;
        current = current.parentNode;
      }
      return null;
    },
    getAttribute(name) {
      return node.attributes.get(name);
    },
    querySelector(selector) {
      const selectors = selector.split(",").map(function (item) {
        return item.trim();
      });
      return findFirst(node, function (candidate) {
        return selectors.some(function (entry) {
          return matches(candidate, entry);
        });
      });
    },
    querySelectorAll(selector) {
      const selectors = selector.split(",").map(function (item) {
        return item.trim();
      });
      return findAll(node, function (candidate) {
        return selectors.some(function (entry) {
          return matches(candidate, entry);
        });
      });
    },
    remove() {
      if (!node.parentNode) return;
      node.parentNode.children = node.parentNode.children.filter(function (child) {
        return child !== node;
      });
      node.parentNode = null;
    },
    removeChild(child) {
      node.children = node.children.filter(function (item) {
        return item !== child;
      });
      child.parentNode = null;
      return child;
    },
    setAttribute(name, value) {
      node.attributes.set(name, String(value));
    },
    // classList closes over `node`, so it can only be built once `node`
    // exists; this placeholder is overwritten immediately below, before the
    // node is returned to any caller.
    classList: /** @type {FakeClassList} */ ({})
  };
  Object.defineProperty(node, "firstChild", {
    enumerable: false,
    configurable: false,
    get() {
      return node.children[0] || null;
    }
  });
  node.classList = classList(node);
  return node;
}

/**
 * @param {FakeElement} node
 * @returns {FakeClassList}
 */
function classList(node) {
  return {
    add(name) {
      const values = classSet(node);
      values.add(name);
      node.className = Array.from(values).join(" ");
    },
    contains(name) {
      return classSet(node).has(name);
    },
    remove(name) {
      const values = classSet(node);
      values.delete(name);
      node.className = Array.from(values).join(" ");
    },
    toggle(name, enabled) {
      if (enabled) this.add(name);
      else this.remove(name);
    }
  };
}

/**
 * @param {FakeElement} node
 * @returns {Set<string>}
 */
function classSet(node) {
  return new Set(
    String(node.className || "")
      .split(/\s+/)
      .filter(Boolean)
  );
}

/**
 * @returns {FakeStyle}
 */
export function styleBag() {
  /** @type {Map<string, string>} */
  const values = new Map();
  return {
    set background(/** @type {string} */ value) {
      values.set("background", value);
    },
    set left(/** @type {string} */ value) {
      values.set("left", value);
    },
    set top(/** @type {string} */ value) {
      values.set("top", value);
    },
    getPropertyValue(name) {
      return values.get(name) || "";
    },
    removeProperty(name) {
      values.delete(name);
    },
    setProperty(name, value) {
      values.set(name, String(value));
    }
  };
}

/**
 * @returns {FakeUrl}
 */
export function fakeUrl() {
  return {
    createObjectURL() {
      return "blob:polarrecorder-test";
    },
    revokeObjectURL() {}
  };
}

/**
 * @param {FakeElement} node
 * @param {string} selector
 * @returns {boolean}
 */
function matches(node, selector) {
  if (selector.startsWith(".")) return node.classList.contains(selector.slice(1));
  return false;
}

/**
 * @param {FakeElement} root
 * @param {(node: FakeElement) => boolean} predicate
 * @returns {FakeElement | null}
 */
export function findFirst(root, predicate) {
  return findAll(root, predicate)[0] || null;
}

/**
 * @param {FakeElement} root
 * @param {(node: FakeElement) => boolean} predicate
 * @returns {FakeElement[]}
 */
export function findAll(root, predicate) {
  /** @type {FakeElement[]} */
  const out = [];
  walk(root, function (node) {
    if (predicate(node)) out.push(node);
  });
  return out;
}

/**
 * @param {FakeElement} root
 * @param {string} id
 * @returns {FakeElement | null}
 */
export function findById(root, id) {
  return findFirst(root, function (node) {
    return node.id === id;
  });
}

/**
 * @param {FakeElement} root
 * @param {string} name
 * @returns {FakeElement | null}
 */
export function findFirstByClass(root, name) {
  return findFirst(root, function (node) {
    return node.classList.contains(name);
  });
}

/**
 * @param {FakeElement} node
 * @param {(node: FakeElement) => void} visit
 * @returns {void}
 */
function walk(node, visit) {
  visit(node);
  node.children.forEach(function (child) {
    walk(child, visit);
  });
}

/**
 * @param {FakeElement} node
 * @returns {string}
 */
export function textTree(node) {
  return node.textContent + node.children.map(textTree).join("");
}
