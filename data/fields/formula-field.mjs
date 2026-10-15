/**
 * @import { FormulaFieldOptions } from "./_types.mjs";
 */

/**
 * Special case StringField which represents a formula.
 *
 * @param {FormulaFieldOptions} [options={}]  Options which configure the behavior of the field.
 * @property {boolean} deterministic=false    Is this formula not allowed to have dice values?
 */
export default class FormulaField extends foundry.data.fields.StringField {

  /** @inheritDoc */
  static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, {
      deterministic: false
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _validateType(value) {
    const roll = new Roll(value.replace(/@([a-z.0-9_-]+)/gi, "1"));
    roll.evaluateSync({ strict: false });
    if ( this.options.deterministic && !roll.isDeterministic ) throw new Error(`must not contain dice terms: ${value}`);
    super._validateType(value);
  }

  /* -------------------------------------------- */
  /*  Form Field Integration                      */
  /* -------------------------------------------- */

  /** @inheritDoc */
  toFormGroup(groupConfig={}, inputConfig={}) {
    groupConfig.classes ||= [];
    groupConfig.classes.push("formula-input");
    return super.toFormGroup(groupConfig, inputConfig);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _toInput(config) {
    const input = super._toInput(config);
    if ( input.tagName !== "INPUT" ) return input;
    config.value ??= this.getInitialValue({}) ?? "";
    return foundry.applications.elements.HTMLFormulaInputElement.create(config);
  }

  /* -------------------------------------------- */
  /*  Active Effect Integration                   */
  /* -------------------------------------------- */

  /**
   * A formula keeps its `@` references: they are resolved when it is rolled, not when the effect is applied.
   * Unlike the base class this never calls `_replaceDataRefs`, so `replacementData` goes unused.
   * @param {*} delta                           The change's value.
   * @param {object} [replacementData]          Not used: the references are kept, not resolved.
   * @returns {string}
   * @override
   */
  _castChangeDelta(delta, replacementData={}) {
    return this._cast(delta).trim();
  }

  /* -------------------------------------------- */

  /**
   * Join the delta to the formula with `+`, or with `-` when the delta starts with `-`: "1d8" and "+ 1d4" make
   * "1d8 + 1d4", "1d8" and "-2" make "1d8 - 2". Only the leading sign of the delta is taken as the operator. An empty
   * formula becomes the delta as it is.
   * @param {string} value                      The formula so far.
   * @param {string} delta                      The change's value, as cast by `_castChangeDelta`.
   * @param {DataModel} model                   Not used: the result is built from `value` and `delta` alone.
   * @param {ActiveEffectChangeData} change     Not used: nothing here depends on which effect made the change.
   * @returns {string}
   * @override
   */
  _applyChangeAdd(value, delta, model, change) {
    if ( !value ) return delta;
    const operator = delta.startsWith("-") ? "-" : "+";
    delta = delta.replace(/^[+-]/, "").trim();
    return `${value} ${operator} ${delta}`;
  }

  /* -------------------------------------------- */

  /**
   * Take the delta from the formula, in parentheses so that a delta of several terms is taken whole: "1d8" and
   * "1d4 + 1" make "1d8 - (1d4 + 1)". From an empty formula the result is the negated delta.
   * @param {string} value                      The formula so far.
   * @param {string} delta                      The change's value, as cast by `_castChangeDelta`.
   * @param {DataModel} model                   Not used: the result is built from `value` and `delta` alone.
   * @param {ActiveEffectChangeData} change     Not used: nothing here depends on which effect made the change.
   * @returns {string}
   * @override
   */
  _applyChangeSubtract(value, delta, model, change) {
    if ( !value ) return `-(${delta})`;
    return `${value} - (${delta})`;
  }

  /* -------------------------------------------- */

  /**
   * Multiply the formula by the delta, each in parentheses when it has more than one term: "1d8 + 2" and "2" make
   * "(1d8 + 2) * 2". The result multiplies what the formula rolls; it does not multiply the number of dice. An empty
   * formula stays empty.
   * @param {string} value                      The formula so far.
   * @param {string} delta                      The change's value, as cast by `_castChangeDelta`.
   * @param {DataModel} model                   Not used: the result is built from `value` and `delta` alone.
   * @param {ActiveEffectChangeData} change     Not used: nothing here depends on which effect made the change.
   * @returns {string}
   * @override
   */
  _applyChangeMultiply(value, delta, model, change) {
    if ( !value ) return value;
    if ( new Roll(value).terms.length > 1 ) value = `(${value})`;
    if ( new Roll(delta).terms.length > 1 ) delta = `(${delta})`;
    return `${value} * ${delta}`;
  }

  /* -------------------------------------------- */

  /**
   * Keep the higher of the formula and the delta: "1d8" and "3" make "max(1d8, 3)". A formula that already is one
   * `max(...)` takes the delta as a further argument. An empty formula becomes the delta.
   * @param {string} value                      The formula so far.
   * @param {string} delta                      The change's value, as cast by `_castChangeDelta`.
   * @param {DataModel} model                   Not used: the result is built from `value` and `delta` alone.
   * @param {ActiveEffectChangeData} change     Not used: nothing here depends on which effect made the change.
   * @returns {string}
   * @override
   */
  _applyChangeUpgrade(value, delta, model, change) {
    if ( !value ) return delta;
    const terms = new Roll(value).terms;
    if ( (terms.length === 1) && (terms[0].fn === "max") ) return value.replace(/\)$/, `, ${delta})`);
    return `max(${value}, ${delta})`;
  }

  /* -------------------------------------------- */

  /**
   * Keep the lower of the formula and the delta: "1d8" and "3" make "min(1d8, 3)". A formula that already is one
   * `min(...)` takes the delta as a further argument. An empty formula becomes the delta.
   * @param {string} value                      The formula so far.
   * @param {string} delta                      The change's value, as cast by `_castChangeDelta`.
   * @param {DataModel} model                   Not used: the result is built from `value` and `delta` alone.
   * @param {ActiveEffectChangeData} change     Not used: nothing here depends on which effect made the change.
   * @returns {string}
   * @override
   */
  _applyChangeDowngrade(value, delta, model, change) {
    if ( !value ) return delta;
    const terms = new Roll(value).terms;
    if ( (terms.length === 1) && (terms[0].fn === "min") ) return value.replace(/\)$/, `, ${delta})`);
    return `min(${value}, ${delta})`;
  }
}
