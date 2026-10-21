/**
 * A mixin that checks each definition before it is stored. Apply it before `keyed` so a bad key is reported before the
 * validator sees anything.
 * Options: `validate(definition, key)`, which throws to reject.
 * @param {Function} BaseRegistry
 * @returns {Function}
 */
export default function(BaseRegistry) {
  class ValidatedRegistry extends BaseRegistry {
    constructor(options={}) {
      super(options);
      this.#validate = options.validate;
    }

    /* -------------------------------------------- */

    #validate;

    /* -------------------------------------------- */

    /**
     * @inheritdoc
     * @throws {Error}  When the validator rejects the definition; nothing is stored.
     */
    register(key, definition) {
      this.#validate?.(definition, key);
      return super.register(key, definition);
    }
  }
  return ValidatedRegistry;
}
