/**
 * Guard rails for the neutral API, in the spirit of Foundry's own compatibility warnings: misuse is reported once,
 * with a pointer to the right call, instead of failing as a bare `undefined` later.
 */

const PREFIX = "Enhanced API |";
const warned = new Set();

/**
 * Warn once per message.
 * @param {string} message
 */
function warnOnce(message) {
  if ( warned.has(message) ) return;
  warned.add(message);
  console.warn(`${PREFIX} ${message}`);
}

/** Forget which warnings were already shown; for tests that assert on warnings. */
export function resetWarnings() {
  warned.clear();
}

/**
 * Closest known key by edit distance, for "did you mean" hints.
 * @param {string} key
 * @param {string[]} candidates
 * @returns {string|undefined}
 */
function closest(key, candidates) {
  /**
   * Edit distance between two strings: how many single-character changes turn one into the other.
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  const distance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for ( let i = 1; i <= a.length; i++ ) {
      let previous = row[0];
      row[0] = i;
      for ( let j = 1; j <= b.length; j++ ) {
        const current = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
      }
    }
    return row[b.length];
  };
  const lowered = key.toLowerCase();
  const scored = candidates.map(c => /** @type {[string, number]} */ ([c, distance(lowered, c.toLowerCase())]));
  return scored
    .filter(([, d]) => d <= Math.max(2, key.length / 3))
    .sort((a, b) => a[1] - b[1])[0]?.[0];
}

/**
 * Wrap an API surface so reading a member that does not exist warns once, with a suggestion.
 * Only top-level reads are checked; symbols, `then` and inherited members are ignored.
 * @template {Record<string, any>} T
 * @param {string} name    Label for messages, e.g. "enhancedApi" or a module id.
 * @param {T} surface
 * @returns {T}
 */
export function guard(name, surface) {
  return new Proxy(surface, {
    get(target, key, receiver) {
      if ( typeof key === "symbol" || key === "then" || key === "toJSON" || (key in Object.prototype) ) {
        return Reflect.get(target, key, receiver);
      }
      if ( !(key in target) ) {
        const hint = closest(key, Object.keys(target));
        warnOnce(`"${name}" has no member "${key}"${hint ? `; did you mean "${hint}"?` : "."} `
          + "Check the module's published API and its capabilities before using a feature.");
      }
      return Reflect.get(target, key, receiver);
    }
  });
}

/**
 * When something was deprecated, or when its support ends. A module's own version and the versions of what it depends on are written apart, because a
 * module's version need not say anything about the Foundry it was made for, and a deprecation can follow another module's version.
 * @typedef {object} DeprecationVersion
 * @property {string|number} [module]  The version of the module that keeps the old shape working: `"1.0.1"`, or `2` for "version 2".
 * @property {Record<string, string|number>} [deps]  Versions of what it depends on, by id: `{ foundry: "13.200", "some-module": "2.2.1" }`. Foundry's own is under `foundry`.
 */

const isVersion = value => ((typeof value === "string") && !!value.trim()) || ((typeof value === "number") && Number.isFinite(value));

/**
 * Check a `since` or `until` and read it. At least one version is needed, so a deprecation always says when.
 * @param {string} name  `"since"` or `"until"`, for the error.
 * @param {DeprecationVersion} spec
 * @returns {{ module?: string|number, deps: Record<string, string|number> }}
 */
export function readDeprecationVersion(name, spec) {
  const shape = `\`${name}\` is { module?: version, deps?: { <id>: version } }, such as { module: "1.0.1", deps: { foundry: 15 } }`;
  if ( !spec || (typeof spec !== "object") ) throw new Error(`deprecateMoved needs ${name}: ${shape}.`);
  const { module, deps = {} } = spec;
  if ( (module !== undefined) && !isVersion(module) ) throw new Error(`deprecateMoved: ${name}.module is not a version: ${shape}.`);
  if ( !deps || (typeof deps !== "object") ) throw new Error(`deprecateMoved: ${name}.deps is not an object of versions: ${shape}.`);
  for ( const [id, version] of Object.entries(deps) ) {
    if ( !isVersion(version) ) throw new Error(`deprecateMoved: ${name}.deps.${id} is not a version: ${shape}.`);
  }
  if ( (module === undefined) && !Object.keys(deps).length ) throw new Error(`deprecateMoved: ${name} names no version: ${shape}.`);
  return { module, deps };
}

/**
 * The versions in words, the way they are written in a warning: `this module 1.0.1, Foundry 15`.
 * @param {{ module?: string|number, deps: Record<string, string|number> }} versions
 * @param {object} [options]
 * @param {boolean} [options.withFoundry=true]  Leave Foundry's version out, when Foundry's own warning says it already.
 * @returns {string}
 */
function describeVersions({ module, deps }, { withFoundry=true }={}) {
  const parts = [];
  if ( module !== undefined ) parts.push(`this module ${module}`);
  for ( const [id, version] of Object.entries(deps) ) {
    if ( (id === "foundry") && !withFoundry ) continue;
    parts.push(`${id === "foundry" ? "Foundry" : id} ${version}`);
  }
  return parts.join(", ");
}

/**
 * Keep an old config location working while warning that it moved, via Foundry's compatibility warning. Reading it warns once for each place in the code that reads it;
 * writing it warns every time, because a value written to the old place is not read from the new one unless `set` forwards it, which is a bug to find and not noise to
 * hide.
 * @param {object} holder            Object that used to hold the value, e.g. the system config.
 * @param {string} key               Old property name.
 * @param {object} options
 * @param {string} options.to        Human-readable new location, e.g. `api.modules.require(id).config.abilities`.
 * @param {Function} options.get     Returns the current value.
 * @param {Function} [options.set]   Receives a value written to the old place and stores it in the new one. Without it, the write is warned about and not kept.
 * @param {DeprecationVersion} options.since  When the old place was deprecated.
 * @param {DeprecationVersion} options.until  When it stops working.
 */
export function deprecateMoved(holder, key, { to, get, set, since, until }) {
  const from = readDeprecationVersion("since", since);
  const end = readDeprecationVersion("until", until);
  // Foundry's own warning states the Foundry versions; the rest is said in its details
  const details = [
    describeVersions(from, { withFoundry: false }) && `Deprecated in ${describeVersions(from, { withFoundry: false })}.`,
    describeVersions(end, { withFoundry: false }) && `Support ends in ${describeVersions(end, { withFoundry: false })}.`
  ].filter(Boolean).join(" ") || undefined;
  const warn = (message, once) => foundry.utils.logCompatibilityWarning(message, { since: from.deps.foundry, until: end.deps.foundry, details, once });
  Object.defineProperty(holder, key, {
    configurable: true,
    enumerable: false,
    get() {
      warn(`"${key}" moved to ${to}.`, true);
      return get();
    },
    set(value) {
      warn(`"${key}" moved to ${to}; ${set ? "the value was written there" : "the value written here was not kept"}.`, false);
      set?.(value);
    }
  });
}
