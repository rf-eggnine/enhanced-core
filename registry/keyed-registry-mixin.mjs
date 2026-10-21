/**
 * A mixin that rejects a key that is an empty string, or does not match `keyPattern`.
 * Options: `keyPattern` (a RegExp, optional).
 * @param {Function} BaseRegistry
 * @returns {Function}
 */
export default function(BaseRegistry) {
  class KeyedRegistry extends BaseRegistry {
    constructor(options={}) {
      super(options);
      this.#pattern = options.keyPattern;
    }

    /* -------------------------------------------- */

    #pattern;

    /* -------------------------------------------- */

    /**
     * @inheritdoc
     * @throws {Error}  For a key that is not a non-empty string or does not match the pattern.
     */
    register(key, definition) {
      if ( (typeof key !== "string") || !key ) throw new Error("A registry needs a non-empty string key.");
      if ( this.#pattern && !this.#pattern.test(key) ) {
        throw new Error(`The key "${key}" does not match ${this.#pattern}.`);
      }
      return super.register(key, definition);
    }
  }
  return KeyedRegistry;
}
