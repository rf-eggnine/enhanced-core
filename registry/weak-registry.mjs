import LimitedWeakMap from "./limited-weak-map.mjs";

/**
 * A keyed weak map of definitions that can only be added to. It wraps a `LimitedWeakMap` and passes on
 * everything but removal, so the owner decides what may be taken back and everyone else can only add.
 * Mixins extend this class (see `compose`).
 */
class WeakRegistry {
  /** @type {LimitedWeakMap} */
  #definitions = new LimitedWeakMap();

  /* -------------------------------------------- */

  /**
   * Add or replace a definition.
   * @param {object} key          Key to register under; an object or function.
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
   * @param {object} key
   * @returns {any}  The definition, or undefined.
   */
  get(key) {
    return this.#definitions.get(key);
  }

  /* -------------------------------------------- */

  /**
   * Is something registered under a key?
   * @param {object} key
   * @returns {boolean}
   */
  has(key) {
    return this.#definitions.has(key);
  }
}

export default WeakRegistry;
