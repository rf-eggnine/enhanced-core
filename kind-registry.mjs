import Registry from "./registry.mjs";

/** A kind is named `<module id>.<name>`, so two modules can never claim the same one. */
const KIND = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9._-]*$/;

/**
 * A registry of the kinds of something: the kinds of aspect an item can be, the kinds of meta-actor, the kinds of
 * activity. Each kind has a label and, if what it describes has data of its own, a data model for it. The owner creates
 * the registry; the modules that define a kind register it:
 *
 * ```js
 * const kinds = new api.KindRegistry({ module: MODULE, id: "meta-kinds" });
 * kinds.register("enhanced-factions.faction", { label: "FACTIONS.Faction", dataModel: FactionData });
 * ```
 *
 * A `KindDetailsField` selects the data model of the kind a document has.
 * @extends {Registry}
 */
export default class KindRegistry extends Registry {
  /**
   * @param {object} options
   * @param {{ id: string }} options.module               The module that owns this registry.
   * @param {string} options.id                           Name of this registry within the module.
   * @param {(definition: any, key: string) => void} [options.validate]  A further check, run after the kind's own.
   * @param {string} [options.lockingBehavior]            One of `Registry.LockingBehavior`.
   */
  constructor({ module, id, validate, lockingBehavior }={}) {
    super({
      module, id, lockingBehavior,
      validate: (definition, key) => {
        if ( !KIND.test(key) ) throw new Error(`The kind "${key}" must be named <module id>.<name>.`);
        if ( (typeof definition?.label !== "string") || !definition.label ) {
          throw new Error(`The kind "${key}" needs a label, a localization key.`);
        }
        const { dataModel } = definition;
        if ( (dataModel !== undefined) && !foundry.utils.isSubclass(dataModel, foundry.abstract.DataModel) ) {
          throw new Error(`The data model of the kind "${key}" must be a DataModel class.`);
        }
        validate?.(definition, key);
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * The data model of a kind.
   * @param {string} kind
   * @returns {typeof foundry.abstract.DataModel|null}  Null for a kind that is not registered or has no data of its own.
   */
  getModel(kind) {
    return this.get(kind)?.dataModel ?? null;
  }

  /* -------------------------------------------- */

  /**
   * The label of a kind, in the player's language.
   * @param {string} kind
   * @returns {string}  Empty for a kind that is not registered.
   */
  label(kind) {
    const label = this.get(kind)?.label;
    return label ? game.i18n.localize(label) : "";
  }

  /* -------------------------------------------- */

  /**
   * The kinds as the options of a select, in the order they were registered.
   * @returns {{ value: string, label: string }[]}
   */
  choices() {
    return Array.from(this.entries(), ([value, { label }]) => ({ value, label: game.i18n.localize(label) }));
  }
}
