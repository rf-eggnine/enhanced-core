/**
 * Registration point so modules never replace a class on `CONFIG` themselves. Three kinds of target:
 *
 * - A document name ("Actor"): wraps `CONFIG.Actor.documentClass`. World documents are instantiated before the
 *   `setup` hook, so once the system has set its own classes `register` wraps immediately (module `init` hooks run
 *   after the system's, so registration order is module load order); earlier calls are queued and flushed by `ready`.
 * - A data model target ("Actor.dataModels.npc", or "Actor.dataModels.*" for every type): applied to every matching
 *   type that exists, during `init`, and to each type registered later through `registerModel`. Registration order
 *   between a mixin and a type does not matter. Types must be registered with `registerModel`; the audit in `setup`
 *   warns about a type written straight onto `CONFIG` (its mixins were not applied: world documents already exist).
 * - Any other dotted `CONFIG` path ("Token.objectClass", "Token.rulerClass"): queued and applied in registration order
 *   at `setup`. Foundry builds the canvas and its layers right after the `setup` hook, so these classes are not read
 *   before then.
 *
 * A mixin is applied at most once per class chain, so a subclass of a wrapped type does not wrap again.
 * @param {object} [options]
 * @param {Record<string, Function>} [options.bases]  The host's base data model per document name ("Actor"). A
 *   `standalone` model must extend its document's base.
 * @param {() => Record<string, string[]>} [options.exclusions]  World-level exclusions: mixin id to the types it must
 *   not be applied to. Read each time a mixin is applied.
 * @returns {{register: Function, registerModel: Function, ready: Function, setup: Function}}
 */
export function createMixinRegistry({ bases={}, exclusions=() => ({}) }={}) {
  const queued = [];
  const pathMixins = [];
  const modelMixins = [];
  const applied = new WeakMap();   // Class to the set of mixin ids it was wrapped with
  const registered = new Map();    // "Actor:npc" -> { standalone }
  const produced = new Map();      // "Actor:npc" -> the class the registry last put in CONFIG
  const warned = new Set();
  let isReady = false;
  let isSetUp = false;

  const MODEL_TARGET = /^(\w+)\.dataModels\.(.+)$/;
  const key = (documentName, type) => `${documentName}:${type}`;
  const warn = (message, once=null) => {
    if ( once ) {
      if ( warned.has(once) ) return;
      warned.add(once);
    }
    console.warn(`Enhanced API | mixins: ${message}`);
  };

  /* -------------------------------------------- */
  /*  Document classes and plain CONFIG paths      */
  /* -------------------------------------------- */

  const wrapDocument = (documentName, mixin) => {
    CONFIG[documentName].documentClass = mixin(CONFIG[documentName].documentClass);
  };

  const wrapPath = (path, mixin) => {
    const base = foundry.utils.getProperty(CONFIG, path);
    if ( typeof base !== "function" ) {
      warn(`mixins.register("${path}"): there is no class at CONFIG.${path}; mixin not applied.`);
      return;
    }
    foundry.utils.setProperty(CONFIG, path, mixin(base));
  };

  /* -------------------------------------------- */
  /*  Data models                                 */
  /* -------------------------------------------- */

  /**
   * Has this mixin already been applied anywhere in the class's chain?
   * @param {Function} Class
   * @param {string|Function} id
   * @returns {boolean}
   */
  const hasApplied = (Class, id) => {
    for ( let c = Class; typeof c === "function" && c !== Function.prototype; c = Object.getPrototypeOf(c) ) {
      if ( applied.get(c)?.has(id) ) return true;
    }
    return false;
  };

  /**
   * Is this type excluded from the mixin, by its author or by the world?
   * @param {object} entry
   * @param {string} type
   * @returns {boolean}
   */
  const isExcluded = (entry, type) => {
    if ( entry.exclude.has(type) ) return true;
    return (typeof entry.id === "string") && !!exclusions()?.[entry.id]?.includes(type);
  };

  /**
   * Does this mixin target the given document and type?
   * @param {object} entry
   * @param {string} documentName
   * @param {string} type
   * @returns {boolean}
   */
  const matches = (entry, documentName, type) =>
    (entry.documentName === documentName) && ((entry.type === "*") || (entry.type === type));

  /**
   * Apply one mixin to one registered type, if it applies.
   * @param {object} entry
   * @param {string} documentName
   * @param {string} type
   * @returns {boolean}  True when the type was found.
   */
  const applyToType = (entry, documentName, type) => {
    const models = CONFIG[documentName]?.dataModels;
    const current = models?.[type];
    if ( typeof current !== "function" ) return false;
    entry.found = true;
    if ( registered.get(key(documentName, type))?.standalone ) return true;
    if ( isExcluded(entry, type) || hasApplied(current, entry.id) ) return true;
    const wrapped = entry.mixin(current);
    applied.set(wrapped, new Set([entry.id]));
    models[type] = wrapped;
    produced.set(key(documentName, type), wrapped);
    return true;
  };

  /**
   * Apply one mixin to every matching type that exists now.
   * @param {object} entry
   */
  const applyEntry = entry => {
    const models = CONFIG[entry.documentName]?.dataModels;
    if ( !models ) return;
    if ( entry.type === "*" ) {
      for ( const type of Object.keys(models) ) applyToType(entry, entry.documentName, type);
    } else applyToType(entry, entry.documentName, entry.type);
  };

  /* -------------------------------------------- */

  return {
    /**
     * Wrap a class with a mixin.
     * @param {string} target    A Foundry document name ("Actor"), a data model target ("Actor.dataModels.npc" or
     *                           "Actor.dataModels.*") or a dotted CONFIG path ("Token.objectClass").
     * @param {Function} mixin   `Base => class extends Base {}`.
     * @param {object} [options]
     * @param {string} [options.id]         A stable name for this mixin ("enhanced-currency:holds-coins"). Lets a world
     *                                      exclude it by name; without one the mixin function itself is the identity.
     * @param {string[]} [options.exclude]  Data model types this mixin must never be applied to (for example a type
     *                                      that cannot hold coins).
     */
    register(target, mixin, { id, exclude=[] }={}) {
      const model = target.match(MODEL_TARGET);
      if ( model ) {
        const [, documentName, type] = model;
        const entry = { documentName, type, mixin, id: id ?? mixin, exclude: new Set(exclude), found: false };
        modelMixins.push(entry);
        applyEntry(entry);
        if ( isSetUp && !entry.found && (type !== "*") ) {
          warn(`mixins.register("${target}"): there is no class at CONFIG.${documentName}.dataModels.${type}; `
            + "mixin not applied.");
        }
      } else if ( target.includes(".") ) {
        if ( isSetUp ) wrapPath(target, mixin);
        else pathMixins.push([target, mixin]);
      } else if ( isReady ) wrapDocument(target, mixin);
      else queued.push([target, mixin]);
    },

    /**
     * Register a data model type. Mixins already registered for it are applied now, so register types and mixins in
     * any order during `init`.
     * @param {string} documentName    "Actor", "Item" and so on.
     * @param {string} type            The type name, as it appears in `CONFIG.<Doc>.dataModels`.
     * @param {Function} DataModel     The data model class.
     * @param {object} [options]
     * @param {boolean} [options.standalone=false]  The model manages its own mixins: it must extend the host's base
     *                                 data model for this document, apply any mixin it wants itself, and the registry
     *                                 neither wraps it nor warns about it.
     * @returns {Function}  The class now registered (wrapped, unless standalone).
     */
    registerModel(documentName, type, DataModel, { standalone=false }={}) {
      CONFIG[documentName].dataModels ??= {};
      const models = CONFIG[documentName].dataModels;
      const id = key(documentName, type);
      if ( registered.has(id) ) warn(`${documentName} type "${type}" was registered twice; the later one wins.`);
      registered.set(id, { standalone });
      models[type] = DataModel;
      produced.set(id, DataModel);
      if ( standalone ) {
        const base = bases[documentName];
        if ( base && !(DataModel === base || DataModel.prototype instanceof base) ) {
          warn(`${documentName} type "${type}" is standalone but does not extend the host's base data model.`,
            `standalone:${id}`);
        }
        return DataModel;
      }
      for ( const entry of modelMixins ) {
        if ( matches(entry, documentName, type) ) applyToType(entry, documentName, type);
      }
      return models[type];
    },

    /** Called by the system once its own document classes are set; flushes queued document mixins. */
    ready() {
      isReady = true;
      for ( const [documentName, mixin] of queued.splice(0) ) wrapDocument(documentName, mixin);
    },

    /**
     * Called by the system at `setup`, before any module's `setup` hook. World documents already exist, so this audits
     * and no longer applies data model mixins; it then applies the queued CONFIG path mixins.
     *
     * The audit covers every document with a data model mixin. A type that did not come through `registerModel`, or
     * was replaced after it did, gets a warning naming it: its mixins were not applied, and fixing that is the
     * module's concern.
     * A mixin aimed at one type that never appeared gets a warning too. Standalone types are skipped.
     */
    setup() {
      isSetUp = true;
      const documentNames = new Set(modelMixins.map(entry => entry.documentName));
      for ( const documentName of documentNames ) {
        const models = CONFIG[documentName]?.dataModels ?? {};
        for ( const type of Object.keys(models) ) {
          const id = key(documentName, type);
          if ( registered.get(id)?.standalone ) continue;
          if ( !registered.has(id) ) {
            warn(`${documentName} type "${type}" was set directly on CONFIG, so its mixins were not applied. `
              + "Register it with mixins.registerModel.", `direct:${id}`);
          } else if ( produced.get(id) !== models[type] ) {
            warn(`${documentName} type "${type}" was replaced on CONFIG after it was registered, so its mixins `
              + "were lost.", `replaced:${id}`);
          }
        }
      }
      for ( const entry of modelMixins ) {
        if ( !entry.found && (entry.type !== "*") ) {
          warn(`mixins.register("${entry.documentName}.dataModels.${entry.type}"): there is no class at `
            + `CONFIG.${entry.documentName}.dataModels.${entry.type}; mixin not applied.`);
        }
      }
      for ( const [path, mixin] of pathMixins.splice(0) ) wrapPath(path, mixin);
    }
  };
}
