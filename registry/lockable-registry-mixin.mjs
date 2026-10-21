/**
 * What happens to a change made after `ready()`.
 * - `None`: it is accepted like any other.
 * - `WarnAfterHook`: it is accepted, and a warning names the key.
 * - `LockAtHook`: it throws; the registry is closed once `ready()` is called.
 * @enum {string}
 */
export const LockingBehavior = Object.freeze({
  None: "None",
  WarnAfterHook: "WarnAfterHook",
  LockAtHook: "LockAtHook"
});

/**
 * A mixin that closes a registry, or warns about later changes, after its ready hook. Apply it after `awaitable`.
 * It also guards `unregister` when the base has one (a `LimitedMap`).
 * Options: `lockingBehavior`, one of `LockingBehavior` (default `None`).
 * @param {Function} BaseRegistry
 * @returns {Function}
 */
export default function(BaseRegistry) {
  class LockableRegistry extends BaseRegistry {
    constructor(options={}) {
      super(options);
      const { lockingBehavior=LockingBehavior.None } = options;
      if ( typeof this.ready !== "function" ) throw new Error("A lockable registry needs an awaitable one under it.");
      if ( !Object.values(LockingBehavior).includes(lockingBehavior) ) {
        throw new Error(
          `"${lockingBehavior}" is not a locking behavior (${Object.values(LockingBehavior).join(", ")}).`
        );
      }
      this.#behavior = lockingBehavior;
      if ( typeof super.unregister === "function" ) {
        Object.defineProperty(this, "unregister", {
          configurable: true,
          writable: true,
          value: key => {
            this.#check(key, "removed");
            return super.unregister(key);
          }
        });
      }
    }

    /* -------------------------------------------- */

    #behavior;

    /* -------------------------------------------- */

    /**
     * The locking behavior this registry was created with.
     * @type {string}
     */
    get lockingBehavior() {
      return this.#behavior;
    }

    /* -------------------------------------------- */

    /**
     * Is the registry closed to changes? True from `ready()` on, for `LockAtHook` only.
     * @type {boolean}
     */
    get isLocked() {
      return this.isReady && (this.#behavior === LockingBehavior.LockAtHook);
    }

    /* -------------------------------------------- */

    /**
     * Throw or warn about a change, depending on the behavior.
     * @param {string} key
     * @param {string} verb  "registered" or "removed".
     */
    #check(key, verb) {
      if ( this.isLocked ) throw new Error(`The registry is locked: "${key}" was ${verb} after ${this.hook}.`);
      if ( this.isReady && (this.#behavior === LockingBehavior.WarnAfterHook) ) {
        console.warn(`Advanced API | "${key}" was ${verb} after ${this.hook}; `
          + "anything that already read the registry will not see it.");
      }
    }

    /* -------------------------------------------- */

    /**
     * @inheritdoc
     * @throws {Error}  When the registry is locked.
     */
    register(key, definition) {
      this.#check(key, "registered");
      return super.register(key, definition);
    }
  }
  return LockableRegistry;
}
