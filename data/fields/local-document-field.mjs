/**
 * @import { LocalDocumentFieldOptions } from "./_types.mjs";
 */

/**
 * A mirror of ForeignDocumentField that references a Document embedded within this Document.
 *
 * @param {typeof Document} model              The local DataModel class definition which this field should link to.
 * @param {LocalDocumentFieldOptions} options  Options which configure the behavior of the field.
 */
export default class LocalDocumentField extends foundry.data.fields.DocumentIdField {
  constructor(model, options={}) {
    if ( !foundry.utils.isSubclass(model, foundry.abstract.DataModel) ) {
      throw new Error("A LocalDocumentField must specify a DataModel subclass as its type");
    }

    super(options);
    this.model = model;
  }

  /* -------------------------------------------- */

  /**
   * A reference to the model class which is stored in this field.
   * @type {typeof Document}
   */
  model;

  /* -------------------------------------------- */

  /** @inheritDoc */
  static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, {
      nullable: true,
      readonly: false,
      idOnly: false,
      fallback: false
    });
  }

  /* -------------------------------------------- */

  /** @override */
  _cast(value) {
    if ( typeof value === "string" ) return value;
    if ( (value instanceof this.model) ) return value._id;
    throw new Error(`The value provided to a LocalDocumentField must be a ${this.model.name} instance.`);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _validateType(value) {
    if ( !this.fallback ) super._validateType(value);
  }

  /* -------------------------------------------- */

  /**
   * Step up through model's parents to find the specified collection.
   * @param {DataModel} model
   * @param {string} collection
   * @returns {EmbeddedCollection|void}
   */
  _findCollection(model, collection) {
    if ( !model.parent ) return;
    try {
      return model.parent.getEmbeddedCollection(collection);
    } catch {
      return model.parent[collection] ?? this._findCollection(model.parent, collection);
    }
  }

  /* -------------------------------------------- */

  /**
   * Unlike `ForeignDocumentField`, which passes the options on to the collection it reads, this does not use them. They
   * are the options the owning model was built with (`strict` among them), and the lookup is lazy: a strict one would
   * throw from the first read of a reference to an embedded document that has since been deleted. Such a reference
   * gives `null` (or the id itself with `fallback`).
   * @param {string} value                 The id stored in the source.
   * @param {DataModel} model              The model that holds this field; its parents are searched for the collection.
   * @param {object} [options]             Not used.
   * @returns {string|null|(() => Document|string|null)}  The id, or a function that finds the document.
   * @override
   */
  initialize(value, model, options={}) {
    if ( this.idOnly ) return this.fallback || foundry.data.validators.isValidId(value) ? value : null;
    const collection = this._findCollection(model, this.model.metadata.collection);
    return () => {
      const document = collection?.get(value);
      if ( !document ) return this.fallback ? value : null;
      if ( this.fallback ) Object.defineProperty(document, "toString", {
        value: () => document.name,
        configurable: true,
        enumerable: false
      });
      return document;
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  toObject(value) {
    return value?._id ?? value;
  }
}
