/**
 * A Map with `register` in place of `set` and `unregister` in place of `delete`.
 * The base of anything an owner both fills and empties and must be iteratable.
 */
export default class LimitedMap {
  /** @type {Map<string, any>} */
  #definitions = new Map();

  /* -------------------------------------------- */

  /**
   * The number of definitions.
   * @type {number}
   */
  get size() {
    return this.#definitions.size;
  }

  /* -------------------------------------------- */

  /**
   * Add or replace a definition. A replaced key keeps its place in the order.
   * @param {string} key          Key to register under.
   * @param {any} definition
   * @returns {this}
   */
  register(key, definition) {
    this.#definitions.set(key, definition);
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Remove a definition.
   * @param {string} key
   * @returns {boolean}  Whether there was a definition under the key.
   */
  unregister(key) {
    return this.#definitions.delete(key);
  }

  /* -------------------------------------------- */

  /**
   * The definition registered under a key.
   * @param {string} key
   * @returns {any}  The definition, or undefined.
   */
  get(key) {
    return this.#definitions.get(key);
  }

  /* -------------------------------------------- */

  /**
   * Is something registered under a key?
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.#definitions.has(key);
  }

  /* -------------------------------------------- */

  /**
   * The registered keys, in registration order.
   * @returns {MapIterator<string>}
   */
  keys() {
    return this.#definitions.keys();
  }

  /* -------------------------------------------- */

  /**
   * The registered definitions, in registration order.
   * @returns {MapIterator<any>}
   */
  values() {
    return this.#definitions.values();
  }

  /* -------------------------------------------- */

  /**
   * The registered `[key, definition]` pairs, in registration order.
   * @returns {MapIterator<[string, any]>}
   */
  entries() {
    return this.#definitions.entries();
  }

  /* -------------------------------------------- */

  /**
   * Iterate as `[key, definition]` pairs.
   * @returns {MapIterator<[string, any]>}
   */
  [Symbol.iterator]() {
    return this.#definitions.entries();
  }
}
