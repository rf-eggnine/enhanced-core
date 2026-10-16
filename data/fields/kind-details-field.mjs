import { MODULE } from "../../module-info.mjs";
import EnhancedTypedDataField from "./type-data-field.mjs";

/**
 * Data field for the data that belongs to a document's kind. The kind is a sibling property of the document's data
 * (`system.kind` by default), and the data model of the kind comes from a `KindRegistry`; for a kind that is not
 * registered, or has no data model, the value stays a plain object.
 *
 * ```js
 * kind: new StringField({ required: true, blank: true, initial: "" }),
 * details: new KindDetailsField({ kinds: MetaKinds })
 * ```
 *
 * A change that sets the kind and the details together is cleaned with the model of the kind the document had before
 * it.
 */
export default class KindDetailsField extends EnhancedTypedDataField {

  /** @inheritDoc */
  static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, { kinds: null, kindKey: "kind" });
  }

  /* -------------------------------------------- */

  /**
   * The kind a document's source data has.
   * @param {object} source  Source data of the document's system, the model this field belongs to.
   * @returns {string|undefined}
   */
  kindOf(source) {
    return source?.[this.kindKey];
  }

  /* -------------------------------------------- */

  /** @override */
  getModelForType(kind) {
    return this.kinds?.getModel(kind) ?? null;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _cleanType(value, options, _state) {
    // While cleaning, `_state.source` is this field's own stored value; the model it belongs to is `modelSource`
    const type = this.kindOf(_state.modelSource);
    return super._cleanType(value, options, { ..._state, [MODULE.id]: { ..._state[MODULE.id], type } });
  }

  /* -------------------------------------------- */

  /**
   * The details are always cleaned with the model of the kind when it is made, whatever the document was built with.
   * Foundry builds a document that comes from the database with `clean: false`, trusting that its data was cleaned with
   * its models when it was saved. The details of a kind may not have been: when a document is made with its kind and its
   * details together, the kind is not yet in the data the details are cleaned against. Cleaning here fills in the
   * defaults of the kind's model, so such details are valid instead of failing the model's validation.
   * @inheritDoc
   */
  initialize(value, model, options={}) {
    const type = this.kindOf(model._source);
    return super.initialize(value, model, {
      ...options, clean: true, [MODULE.id]: { ...options[MODULE.id], type }
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _migrate(value, options, _state) {
    const type = this.kindOf(_state.modelSource);
    return super._migrate(value, options, { ..._state, [MODULE.id]: { ..._state[MODULE.id], type } });
  }
}
