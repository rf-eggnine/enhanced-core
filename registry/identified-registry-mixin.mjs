/**
 * A mixin that gives a registry a name inside a namespace, so the hooks it fires can be found by others:
 * `<namespace>.<name>.<suffix>`.
 * Options: `namespace` (the owner, such as a module id) and `name` (this registry within it).
 * @param {Function} BaseRegistry
 * @returns {Function}
 */
export default function(BaseRegistry) {
  class IdentifiedRegistry extends BaseRegistry {
    constructor(options={}) {
      super(options);
      const { namespace, name } = options;
      if ( (typeof namespace !== "string") || !namespace ) {
        throw new Error("A registry needs the namespace that owns it, a non-empty string.");
      }
      if ( (typeof name !== "string") || !name ) throw new Error("A registry needs a non-empty string name.");
      this.#namespace = namespace;
      this.#name = name;
    }

    /* -------------------------------------------- */

    #namespace;

    #name;

    /* -------------------------------------------- */

    /**
     * The owner of this registry.
     * @type {string}
     */
    get namespace() {
      return this.#namespace;
    }

    /* -------------------------------------------- */

    /**
     * Name of this registry within its namespace.
     * @type {string}
     */
    get name() {
      return this.#name;
    }

    /* -------------------------------------------- */

    /**
     * The name of a hook this registry fires.
     * @param {string} suffix  What the hook announces, such as `ready`.
     * @returns {string}       `<namespace>.<name>.<suffix>`
     */
    hookName(suffix) {
      return `${this.#namespace}.${this.#name}.${suffix}`;
    }
  }
  return IdentifiedRegistry;
}
