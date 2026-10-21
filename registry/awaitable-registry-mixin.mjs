/**
 * A mixin for a keyed map of definitions that others can wait on: the owner calls `ready()` once registration should be
 * over, which fires a hook and settles `request()`. The hook is named by `hookName("ready")` when the registry is
 * identified, and by a private name otherwise.
 * @param {Function} BaseRegistry
 * @returns {Function}
 */
export default function(BaseRegistry) {
  class AwaitableRegistry extends BaseRegistry {
    constructor(options={}) {
      super(options);
      this.#hook = this.hookName?.("ready") ?? `${crypto.randomUUID()}.ready`;
      this.#whenReady = new Promise(resolve => Hooks.once(this.#hook, () => resolve()));
    }

    /* -------------------------------------------- */

    #hook;

    #whenReady;

    #ready = false;

    /* -------------------------------------------- */

    /**
     * The hook fired by `ready()`.
     * @type {string}
     */
    get hook() {
      return this.#hook;
    }

    /* -------------------------------------------- */

    /**
     * Has `ready()` been called?
     * @type {boolean}
     */
    get isReady() {
      return this.#ready;
    }

    /* -------------------------------------------- */

    /**
     * The definition registered under a key.
     * @param {string} key
     * @returns {any}  The definition.
     * @throws {Error} If the key has not been set.
     */
    require(key) {
      if ( !this.has(key) ) throw new Error(`The registry has no "${key}" yet.`);
      return this.get(key);
    }

    /* -------------------------------------------- */

    /**
     * The definition registered under a key, once registration is complete.
     * @param {string} key
     * @returns {Promise<any>}  The definition, or undefined.
     */
    async request(key) {
      await this.#whenReady;
      return this.get(key);
    }

    /* -------------------------------------------- */

    /**
     * Mark registration as complete and fire the ready hook with this registry. Calling it again does nothing.
     * @returns {boolean}  Whether this call fired the hook.
     */
    ready() {
      if ( this.#ready ) return false;
      this.#ready = true;
      Hooks.callAll(this.#hook, this);
      return true;
    }
  }
  return AwaitableRegistry;
}
