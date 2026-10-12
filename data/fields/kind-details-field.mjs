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
 */
export default class KindDetailsField extends EnhancedTypedDataField {

  /** @inheritDoc */
  static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, { kinds: null, kindKey: "kind" });
  }

  /* -------------------------------------------- */

  /**
   * The kind a document's source data has.
   * @param {object} source  Source data of the document's system.
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
    const type = this.kindOf(_state.source);
    return super._cleanType(value, options, { ..._state, [MODULE.id]: { ..._state[MODULE.id], type } });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  initialize(value, model, options={}) {
    const type = this.kindOf(model._source);
    return super.initialize(value, model, { ...options, [MODULE.id]: { ...options[MODULE.id], type } });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _migrate(value, options, _state) {
    const type = this.kindOf(_state.source);
    return super._migrate(value, options, { ..._state, [MODULE.id]: { ..._state[MODULE.id], type } });
  }
}
