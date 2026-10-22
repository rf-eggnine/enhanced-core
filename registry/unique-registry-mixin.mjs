const BEHAVIORS = Object.freeze(["replace", "warn", "throw", "merge"]);

/**
 * Is this a registry, something with `register`, `get` and `entries`?
 * @param {*} value
 * @returns {boolean}
 */
function isRegistry(value) {
  return !!value && (typeof value.register === "function") && (typeof value.get === "function")
    && (typeof value.entries === "function");
}

/**
 * Is this a plain object, one a merge may go into?
 * @param {*} value
 * @returns {boolean}
 */
function isPlain(value) {
  if ( !value || (typeof value !== "object") ) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype) || (prototype === null);
}

/**
 * The `[key, value]` pairs of a registry or a plain object.
 * @param {object} value
 * @returns {[string, any][]}
 */
function pairs(value) {
  return isRegistry(value) ? Array.from(value.entries()) : Object.entries(value);
}

/**
 * A mixin that decides what registering a key twice does. Registering the very same value again is never a duplicate.
 * Options: `onDuplicate`:
 * - `replace` (the default, as the base does);
 * - `warn`: replace, and warn;
 * - `throw`: keep the first;
 * - `merge`: when both are registries or plain objects, add what the new one has that the old one does not, going into
 *   nested ones the same way; a collision between values that cannot be merged replaces, and warns.
 * @param {Function} BaseRegistry
 * @returns {Function}
 */
export default function(BaseRegistry) {
  class UniqueRegistry extends BaseRegistry {
    constructor(options={}) {
      super(options);
      const { onDuplicate="replace" } = options;
      if ( !BEHAVIORS.includes(onDuplicate) ) {
        throw new Error(`onDuplicate "${onDuplicate}" is not one of ${BEHAVIORS.join(", ")}.`);
      }
      this.#onDuplicate = onDuplicate;
    }

    /* -------------------------------------------- */

    #onDuplicate;

    /* -------------------------------------------- */

    /**
     * Where this registry is, for messages.
     * @type {string}
     */
    get #where() {
      return this.name ? `"${this.name}"` : "a registry";
    }

    /* -------------------------------------------- */

    /**
     * Add what an incoming object has that an existing one does not.
     * @param {object} existing  A registry or a plain object.
     * @param {object} incoming  A registry or a plain object.
     * @param {string} path      Where they are, for messages.
     */
    #mergeInto(existing, incoming, path) {
      for ( const [key, value] of pairs(incoming) ) {
        const here = `${path}.${key}`;
        if ( isRegistry(existing) ) {
          existing.register(key, value);
          continue;
        }
        const old = existing[key];
        if ( !(key in existing) ) existing[key] = value;
        else if ( Object.is(old, value) ) continue;
        else if ( (isRegistry(old) || isPlain(old)) && (isRegistry(value) || isPlain(value)) ) {
          this.#mergeInto(old, value, here);
        } else {
          console.warn(`Advanced API | "${here}" was replaced while merging into ${this.#where}.`);
          existing[key] = value;
        }
      }
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    register(key, definition) {
      if ( this.has(key) ) {
        const old = this.get(key);
        if ( Object.is(old, definition) ) return this;
        if ( this.#onDuplicate === "throw" ) throw new Error(`"${key}" is already registered in ${this.#where}.`);
        if ( this.#onDuplicate === "warn" ) {
          console.warn(`Advanced API | "${key}" was registered again in ${this.#where}; `
            + "the earlier definition is replaced.");
        } else if ( this.#onDuplicate === "merge" ) {
          if ( (isRegistry(old) || isPlain(old)) && (isRegistry(definition) || isPlain(definition)) ) {
            this.#mergeInto(old, definition, key);
            return this;
          }
          console.warn(`Advanced API | "${key}" was replaced in ${this.#where}; it could not be merged.`);
        }
      }
      return super.register(key, definition);
    }
  }
  return UniqueRegistry;
}
