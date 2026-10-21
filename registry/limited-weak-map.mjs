/**
 * A WeakMap with `register` in place of `set` and `unregister` in place of `delete`. The keys are objects, held
 * weakly: an entry goes when its key is collected. It cannot be listed or counted. The base of anything an owner both
 * fills and empties and only looks up by key; wrap it in a `WeakRegistry` to hand out a view that can only be added to.
 */
export default class LimitedWeakMap {
  /** @type {WeakMap<object, any>} */
  #definitions = new WeakMap();

  /* -------------------------------------------- */

  /**
   * Add or replace a definition.
   * @param {object} key          Key to register under; an object or function.
   * @param {any} definition
   * @returns {this}
   * @throws {TypeError}  For a key that is not an object.
   */
  register(key, definition) {
    if ( ((typeof key !== "object") && (typeof key !== "function")) || (key === null) ) {
      throw new TypeError(`A weak registry needs an object key, not ${key === null ? "null" : typeof key}.`);
    }
    this.#definitions.set(key, definition);
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Remove a definition.
   * @param {object} key
   * @returns {boolean}  Whether there was a definition under the key.
   */
  unregister(key) {
    return this.#definitions.delete(key);
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
