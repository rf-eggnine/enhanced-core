/**
 * A keyed set of definitions that modules add to, such as property types or units. The owning module creates it,
 * modules `register` into it, and the owner calls `ready()` once registration should be over; that fires the hook
 * `<module id>.<registry id>.ready` so a dependent can wait for the complete set.
 *
 * ```js
 * const properties = new api.Registry({ module: MODULE, id: "properties" });
 * properties.register("weight", { label: p => p.value });
 * Hooks.once("enhanced-items.properties.ready", registry => { ... });
 * properties.ready();
 * ```
 */
export default class Registry {
  /**
   * What happens to a registration made after `ready()`.
   * - `None`: it is accepted like any other.
   * - `WarnAfterHook`: it is accepted, and a warning names the registry and the key.
   * - `LockAtHook`: it throws; the registry is closed once `ready()` is called.
   * @enum {string}
   */
  static LockingBehavior = Object.freeze({
    None: "None",
    WarnAfterHook: "WarnAfterHook",
    LockAtHook: "LockAtHook"
  });

  /* -------------------------------------------- */

  /**
   * @param {object} options
   * @param {{ id: string }} options.module                 The module that owns this registry, e.g. its `MODULE`.
   * @param {string} options.id                             Name of this registry within the module.
   * @param {(definition: any, key: string) => void} [options.validate]
   *   Called for each definition before it is stored; throw to reject it.
   * @param {string} [options.lockingBehavior="None"]       One of `Registry.LockingBehavior`.
   */
  constructor({ module, id, validate, lockingBehavior=Registry.LockingBehavior.None }={}) {
    if ( typeof module?.id !== "string" || !module.id ) throw new Error("A registry needs the module that owns it.");
    if ( typeof id !== "string" || !id ) throw new Error("A registry needs a non-empty string id.");
    if ( !Object.values(Registry.LockingBehavior).includes(lockingBehavior) ) {
      throw new Error(`Registry "${id}": "${lockingBehavior}" is not a locking behavior `
        + `(${Object.values(Registry.LockingBehavior).join(", ")}).`);
    }
    this.#module = module.id;
    this.#id = id;
    this.#validate = validate;
    this.#lockingBehavior = lockingBehavior;
  }

  /* -------------------------------------------- */

  /** @type {Map<string, any>} */
  #definitions = new Map();

  #module;

  #id;

  #validate;

  #lockingBehavior;

  #ready = false;

  /* -------------------------------------------- */

  /**
   * Name of this registry within its module.
   * @type {string}
   */
  get id() {
    return this.#id;
  }

  /* -------------------------------------------- */

  /**
   * The hook fired by `ready()`: `<module id>.<registry id>.ready`.
   * @type {string}
   */
  get hook() {
    return `${this.#module}.${this.#id}.ready`;
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
   * The locking behavior this registry was created with.
   * @type {string}
   */
  get lockingBehavior() {
    return this.#lockingBehavior;
  }

  /* -------------------------------------------- */

  /**
   * Is the registry closed to new registrations? True from `ready()` on, for `LockAtHook` only.
   * @type {boolean}
   */
  get isLocked() {
    return this.#ready && (this.#lockingBehavior === Registry.LockingBehavior.LockAtHook);
  }

  /* -------------------------------------------- */

  /**
   * Add or replace a definition. After `ready()` what happens depends on the locking behavior.
   * @param {string} key          Key to register under. Module keys should be prefixed with the module's id.
   * @param {any} definition
   * @returns {this}
   * @throws {Error}  For a bad key or definition, or when the registry is locked.
   */
  register(key, definition) {
    if ( typeof key !== "string" || !key ) throw new Error(`Registry "${this.#id}" needs a non-empty string key.`);
    if ( this.isLocked ) {
      throw new Error(`Registry "${this.#id}" of ${this.#module} is locked: "${key}" was registered after `
        + `${this.hook}.`);
    }
    if ( this.#ready && (this.#lockingBehavior === Registry.LockingBehavior.WarnAfterHook) ) {
      console.warn(`Enhanced API | "${key}" was registered in "${this.#id}" of ${this.#module} after ${this.hook}; `
        + "anything that already read the registry will not see it.");
    }
    this.#validate?.(definition, key);
    this.#definitions.set(key, definition);
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
   * Mark registration as complete and fire the ready hook with this registry. Calling it again does nothing.
   * @returns {boolean}  Whether this call fired the hook.
   */
  ready() {
    if ( this.#ready ) return false;
    this.#ready = true;
    Hooks.callAll(this.hook, this);
    return true;
  }
}
