const BEHAVIORS = Object.freeze(["replace", "warn", "throw"]);

/**
 * A mixin that decides what registering a key twice does.
 * Options: `onDuplicate`: `replace` (the default, as the base does), `warn` (replace and warn) or `throw` (keep the
 * first).
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

    /** @inheritdoc */
    register(key, definition) {
      if ( this.has(key) ) {
        const where = this.name ? `"${this.name}"` : "a registry";
        if ( this.#onDuplicate === "throw" ) throw new Error(`"${key}" is already registered in ${where}.`);
        if ( this.#onDuplicate === "warn" ) {
          console.warn(`Advanced API | "${key}" was registered again in ${where}; the earlier definition is replaced.`);
        }
      }
      return super.register(key, definition);
    }
  }
  return UniqueRegistry;
}
