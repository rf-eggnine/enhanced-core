
/**
 * Translate the options of a registry made with `{ module, id }` to the `{ namespace, name }` the mixins read.
 * @param {object} [options]
 * @returns {object}
 */
function translate(options={}) {
  const { module, id } = options;
  if ( typeof module?.id !== "string" || !module.id ) throw new Error("A registry needs the module that owns it.");
  if ( typeof id !== "string" || !id ) throw new Error("A registry needs a non-empty string id.");
  return { ...options, namespace: module.id, name: id };
}

/**
 * A mixin that lists the definitions as the options of a select.
 * Options: `labelOf(definition)`, which returns a localization key or text (default: `definition.label`).
 * @param {Function} BaseRegistry
 * @returns {Function}
 */
export default function(BaseRegistry) {
  class ModuleTranslationRegistry extends BaseRegistry {
    constructor(options={}) {
      super(translate(options));
    }
  }
  return ModuleTranslationRegistry;
}
