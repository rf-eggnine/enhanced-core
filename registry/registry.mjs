import LimitedMap from "./limited-map.mjs";

/**
 * A keyed map of definitions that can only be added to. It wraps a `LimitedMap` and passes on everything but
 * removal, so the owner decides what may be taken back and everyone else can only add. Mixins extend this
 * class (see `compose`).
 */
class Registry {
  /** @type {LimitedMap} */
  #definitions = new LimitedMap();

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
   * Add or replace a definition.
   * @param {string} key          Key to register under.
   * @param {any} definition
   * @returns {this}
   */
  register(key, definition) {
    this.#definitions.register(key, definition);
    return this;
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

export default Registry;
