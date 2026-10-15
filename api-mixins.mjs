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
 * A mixin is applied at most once per class chain, whatever the kind of target, so a subclass of a wrapped type does
 * not wrap again and registering the same mixin twice does not apply it twice. Its id is its identity (the mixin
 * function itself when it has none, which warns): two different mixins may not share an id.
 * @param {object} [options]
 * @param {Record<string, Function>} [options.bases]  The host's base data model per document name ("Actor"). A
 *   `standalone` model must extend its document's base.
 * @param {() => Record<string, string[]>} [options.exclusions]  World-level exclusions: mixin id to the types it must
 *   not be applied to. Read each time a mixin is applied.
 * @returns {{register: Function, registerModel: Function, ready: Function, setup: Function}}
 */
export function createMixinRegistry({ bases={}, exclusions=() => ({}) }={}) {
  const queued = [];          // Document mixins waiting for `ready`: { target, mixin, id }
  const pathMixins = [];      // CONFIG path mixins waiting for `setup`: { target, mixin, id }
  const modelMixins = [];
  const ids = new Map();      // Mixin id to the mixin function that first used it
  const applied = new WeakMap();   // Class to the set of mixin ids it was wrapped with
  const registered = new Map();    // "Actor:npc" -> { standalone }
  const produced = new Map();      // "Actor:npc" -> the class the registry last put in CONFIG
  const warned = new Set();
  let isReady = false;
  let isSetUp = false;

  const MODEL_TARGET = /^(\w+)\.dataModels\.(.+)$/;
  const MIXIN_ID = /^[a-z][a-z0-9-]*(:[\w.-]+)+$/i;
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

  /**
   * Wrap a class with a mixin, unless that mixin is already in its chain.
   * @param {Function} base
   * @param {Function} mixin
   * @param {string|Function} id  The mixin's id, or the mixin itself when it has none.
   * @returns {Function}
   */
  const wrapClass = (base, mixin, id) => {
    if ( hasApplied(base, id) ) return base;
    const wrapped = mixin(base);
    applied.set(wrapped, new Set([id]));
    return wrapped;
  };

  const wrapDocument = ({ target, mixin, id }) => {
    const base = CONFIG[target]?.documentClass;
    if ( (typeof base !== "function") || !base.prototype ) {
      warn(`mixins.register("${target}"): there is no class at CONFIG.${target}.documentClass; mixin not applied.`,
        `class:${target}`);
      return;
    }
    CONFIG[target].documentClass = wrapClass(base, mixin, id);
  };

  const wrapPath = ({ target, mixin, id }) => {
    const base = foundry.utils.getProperty(CONFIG, target);
    if ( (typeof base !== "function") || !base.prototype ) {
      warn(`mixins.register("${target}"): there is no class at CONFIG.${target}; mixin not applied.`,
        `class:${target}`);
      return;
    }
    foundry.utils.setProperty(CONFIG, target, wrapClass(base, mixin, id));
  };

  /* -------------------------------------------- */
  /*  Data models                                 */
  /* -------------------------------------------- */

  /**
   * Has this mixin already been applied anywhere in the class's chain?
   * @param {Function} Class
   * @param {string|Function} id  The mixin's id, or the mixin itself when it has none.
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
    return !!exclusions()?.[entry.id]?.includes(type);
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
     * @param {string} [options.id]         A stable, unique name for this mixin, "module-id:mixin-name"
     *                                      ("enhanced-currency:holds-coins"). Lets a world exclude it by name, and is
     *                                      how the registry knows the mixin is already applied to a class. Required for
     *                                      a data model target (an error without one); any other target warns once. Two
     *                                      different mixins with one id are an error for a data model target and a
     *                                      warning for the others (the later is not applied).
     * @param {string[]} [options.exclude]  Data model types this mixin must never be applied to (for example a type
     *                                      that cannot hold coins).
     */
    register(target, mixin, { id, exclude=[] }={}) {
      if ( typeof target !== "string" ) throw new TypeError("mixins.register: the target must be a string.");
      if ( typeof mixin !== "function" ) throw new TypeError(`mixins.register("${target}"): the mixin must be a function.`);
      const model = target.match(MODEL_TARGET);
      const named = (typeof id === "string") && MIXIN_ID.test(id);
      if ( !named ) {
        const found = (id === undefined) ? "none was given" : `got ${JSON.stringify(id)}`;
        const message = `mixins.register("${target}"): give the mixin an id of the form "module-id:mixin-name"; ${found}.`;
        if ( model ) throw new Error(message);
        warn(message, `id:${target}:${mixin.name}`);
      } else if ( ids.has(id) && (ids.get(id) !== mixin) ) {
        const message = `mixins.register("${target}"): the id "${id}" is already used by another mixin; `
          + "ids must be unique.";
        if ( model ) throw new Error(message);
        warn(message, `duplicate:${id}`);
      } else ids.set(id, mixin);
      const identity = named ? id : mixin;
      if ( model ) {
        const [, documentName, type] = model;
        const entry = { documentName, type, mixin, id, exclude: new Set(exclude), found: false };
        if ( isSetUp ) {
          warn(`mixins.register("${target}"): registered after setup, when the world's documents already exist. `
            + "They keep the class they have, so the mixin reaches them unevenly. Register it during init.",
          `late:${id}`);
        }
        modelMixins.push(entry);
        applyEntry(entry);
        if ( isSetUp && !entry.found && (type !== "*") ) {
          warn(`mixins.register("${target}"): there is no class at CONFIG.${documentName}.dataModels.${type}; `
            + "mixin not applied.");
        }
      } else if ( target.includes(".") ) {
        const entry = { target, mixin, id: identity };
        if ( isSetUp ) wrapPath(entry);
        else pathMixins.push(entry);
      } else {
        const entry = { target, mixin, id: identity };
        if ( isReady ) wrapDocument(entry);
        else queued.push(entry);
      }
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

    /**
     * Called once the document classes are set: by the system when it sets its own, or by the core module at `i18nInit`
     * if no one has by then. Flushes queued document mixins. Calling it again is harmless.
     */
    ready() {
      isReady = true;
      for ( const entry of queued.splice(0) ) wrapDocument(entry);
    },

    /**
     * Called by the core module at `setup`, before any module's `setup` hook (a second call does nothing). World
     * documents already exist, so this audits and no longer applies data model mixins; it then applies the queued
     * CONFIG path mixins.
     *
     * The audit covers every document with a data model mixin. A type that did not come through `registerModel`, or
     * was replaced after it did, gets a warning naming the mixins it lacks, and fixing that is the module's concern.
     * A type that lacks none (its mixins came after a direct write, or the replacement extends the registered class)
     * gets no warning.
     * A mixin aimed at one type that never appeared gets a warning too. Standalone types are skipped.
     */
    setup() {
      if ( isSetUp ) return;
      isSetUp = true;
      const documentNames = new Set(modelMixins.map(entry => entry.documentName));
      for ( const documentName of documentNames ) {
        const models = CONFIG[documentName]?.dataModels ?? {};
        for ( const type of Object.keys(models) ) {
          const id = key(documentName, type);
          if ( registered.get(id)?.standalone ) continue;
          const direct = !registered.has(id);
          if ( !direct && (produced.get(id) === models[type]) ) continue;
          // What the class on CONFIG lacks: a replacement that extends the registered class keeps its mixins
          const missed = modelMixins.filter(entry => matches(entry, documentName, type)
            && !isExcluded(entry, type) && !hasApplied(models[type], entry.id)).map(entry => entry.id);
          if ( !missed.length ) continue;
          const lacking = `the mixins ${missed.join(", ")}`;
          if ( direct ) {
            warn(`${documentName} type "${type}" was set directly on CONFIG, so ${lacking} were not applied. `
              + "Register it with mixins.registerModel.", `direct:${id}`);
          } else {
            warn(`${documentName} type "${type}" was replaced on CONFIG after it was registered, so ${lacking} `
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
      for ( const entry of pathMixins.splice(0) ) wrapPath(entry);
    }
  };
}
