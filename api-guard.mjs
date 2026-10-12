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
   * 
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
 * Keep an old config location working while warning that it moved, via Foundry's compatibility warning.
 * @param {object} holder            Object that used to hold the value, e.g. the system config.
 * @param {string} key               Old property name.
 * @param {object} options
 * @param {string} options.to        Human-readable new location, e.g. `api.modules.require(id).config.abilities`.
 * @param {Function} options.get     Returns the current value.
 * @param {string} [options.since]   Version the move happened in.
 * @param {number} [options.until]   Foundry-style removal version.
 */
export function deprecateMoved(holder, key, { to, get, since, until }) {
  Object.defineProperty(holder, key, {
    configurable: true,
    enumerable: false,
    get() {
      foundry.utils.logCompatibilityWarning(`"${key}" moved to ${to}.`, { since, until, once: true });
      return get();
    }
  });
}
