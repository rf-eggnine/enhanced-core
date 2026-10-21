/**
 * A mixin that lists the definitions as the options of a select.
 * Options: `labelOf(definition)`, which returns a localization key or text (default: `definition.label`).
 * @param {Function} BaseRegistry
 * @returns {Function}
 */
export default function(BaseRegistry) {
  class ChoicesRegistry extends BaseRegistry {
    constructor(options={}) {
      super(options);
      this.#labelOf = options.labelOf ?? (definition => definition?.label);
    }

    /* -------------------------------------------- */

    #labelOf;

    /* -------------------------------------------- */

    /**
     * The label of a key, in the player's language.
     * @param {string} key
     * @returns {string}  Empty for a key that is not registered.
     */
    label(key) {
      if ( !this.has(key) ) return "";
      const label = this.#labelOf(this.get(key));
      return label ? game.i18n.localize(label) : "";
    }

    /* -------------------------------------------- */

    /**
     * The definitions as select options, in registration order.
     * @returns {{ value: string, label: string }[]}
     */
    choices() {
      return Array.from(this.entries(), ([value, definition]) => ({
        value, label: game.i18n.localize(this.#labelOf(definition))
      }));
    }
  }
  return ChoicesRegistry;
}
