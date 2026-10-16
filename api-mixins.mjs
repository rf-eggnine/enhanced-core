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
 *
 * A mixin that needs another one beneath it says so with `requires`, a list of mixin ids. It is applied to a class
 * only once every one of them is in the class's chain, and waits until then, so the order of registration does not
 * matter. Nothing is applied for it: the required mixin has to be registered too (for that target, and not excluded
 * from the type). At `setup`, when no registration can change anything any more, a mixin still waiting is an error.
 * @param {object} [options]
 * @param {Record<string, Function>} [options.bases]  The host's base data model per document name ("Actor"). A
 *   `standalone` model must extend its document's base.
 * @param {() => Record<string, string[]>} [options.exclusions]  World-level exclusions: mixin id to the types it must
 *   not be applied to. Read each time a mixin is applied.
 * @returns {{register: Function, registerModel: Function, ready: Function, setup: Function}}
 */
export function createMixinRegistry({ bases={}, exclusions=() => ({}) }={}) {
  const documentEntries = new Map();   // Document name to the mixins not applied yet: { target, mixin, id, requires }
  const pathEntries = new Map();       // CONFIG path to the mixins not applied yet
  const modelMixins = [];
  const requirements = new Map();      // Mixin id to the ids it requires, over everything registered
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

  /**
   * Is everything the mixin requires already in the class's chain?
   * @param {Function} Class
   * @param {{requires: string[]}} entry
   * @returns {boolean}
   */
  const requirementsMet = (Class, entry) => entry.requires.every(id => hasApplied(Class, id));

  /**
   * Apply the pending mixins of one class whose requirements are met, one after another, until none more can be:
   * applying one may be what another was waiting for. What cannot be applied stays in the list.
   * @param {object[]} entries   The pending mixins of this class, in registration order. Applied ones leave it.
   * @param {() => Function|undefined} read   The class now.
   * @param {(Class: Function) => void} write Put a class in its place.
   * @param {string} where       Where the class is, for the warning when there is none.
   */
  const settleClass = (entries, read, write, where) => {
    if ( !entries.length ) return;
    const first = read();
    if ( (typeof first !== "function") || !first.prototype ) {
      warn(`mixins.register("${entries[0].target}"): there is no class at ${where}; mixin not applied.`,
        `class:${where}`);
      entries.splice(0);
      return;
    }
    let progress = true;
    while ( progress ) {
      progress = false;
      for ( const entry of [...entries] ) {
        const base = read();
        if ( !requirementsMet(base, entry) ) continue;
        write(wrapClass(base, entry.mixin, entry.id));
        entries.splice(entries.indexOf(entry), 1);
        progress = true;
      }
    }
  };

  const settleDocument = documentName => settleClass(documentEntries.get(documentName) ?? [],
    () => CONFIG[documentName]?.documentClass, Class => { CONFIG[documentName].documentClass = Class; },
    `CONFIG.${documentName}.documentClass`);

  const settlePath = path => settleClass(pathEntries.get(path) ?? [],
    () => foundry.utils.getProperty(CONFIG, path), Class => foundry.utils.setProperty(CONFIG, path, Class),
    `CONFIG.${path}`);

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
   * Apply to one registered type the mixins that target it, in registration order, those whose requirements are met,
   * and again until none more can be: applying one may be what another was waiting for.
   * @param {string} documentName
   * @param {string} type
   */
  const settleType = (documentName, type) => {
    const models = CONFIG[documentName]?.dataModels;
    if ( typeof models?.[type] !== "function" ) return;
    const wanted = modelMixins.filter(entry => matches(entry, documentName, type));
    for ( const entry of wanted ) entry.found = true;
    if ( registered.get(key(documentName, type))?.standalone ) return;
    let progress = true;
    while ( progress ) {
      progress = false;
      for ( const entry of wanted ) {
        const current = models[type];
        if ( isExcluded(entry, type) || hasApplied(current, entry.id) || !requirementsMet(current, entry) ) continue;
        const wrapped = entry.mixin(current);
        applied.set(wrapped, new Set([entry.id]));
        models[type] = wrapped;
        produced.set(key(documentName, type), wrapped);
        progress = true;
      }
    }
  };

  /**
   * Settle every type the mixin targets that exists now.
   * @param {object} entry
   */
  const settleEntry = entry => {
    const models = CONFIG[entry.documentName]?.dataModels;
    if ( !models ) return;
    const types = (entry.type === "*") ? Object.keys(models) : [entry.type];
    for ( const type of types ) settleType(entry.documentName, type);
  };

  /**
   * The mixins that wait for something they require, as lines for a message: those not applied to a class of a
   * document, of a path, or of a data model type.
   * @param {object} [only]  Look at this one mixin only.
   * @returns {string[]}
   */
  const unmet = only => {
    const lines = [];
    const say = (entry, where) => {
      const lacking = entry.requires.filter(id => !hasApplied(where.class, id));
      lines.push(`"${entry.id}" on ${where.name} requires ${lacking.map(id => `"${id}"`).join(", ")}`);
    };
    for ( const [name, entries] of documentEntries ) {
      for ( const entry of entries ) {
        if ( !only || (only === entry) ) say(entry, { name, class: CONFIG[name]?.documentClass });
      }
    }
    for ( const [path, entries] of pathEntries ) {
      for ( const entry of entries ) {
        if ( !only || (only === entry) ) say(entry, { name: path, class: foundry.utils.getProperty(CONFIG, path) });
      }
    }
    for ( const entry of modelMixins ) {
      if ( only && (only !== entry) ) continue;
      const models = CONFIG[entry.documentName]?.dataModels ?? {};
      for ( const [type, current] of Object.entries(models) ) {
        if ( !matches(entry, entry.documentName, type) || (typeof current !== "function") ) continue;
        if ( registered.get(key(entry.documentName, type))?.standalone ) continue;
        if ( isExcluded(entry, type) || hasApplied(current, entry.id) || requirementsMet(current, entry) ) continue;
        say(entry, { name: `${entry.documentName}.dataModels.${type}`, class: current });
      }
    }
    return lines;
  };

  /**
   * Fail for the mixins that can no longer get what they require.
   * @param {string[]} lines
   */
  const failFor = lines => {
    if ( !lines.length ) return;
    throw new Error("Enhanced API | mixins: these mixins were not applied, because what they require is not applied "
      + `to the same class: ${lines.join("; ")}.`);
  };

  /**
   * Does the mixin, through what it requires, lead back to itself?
   * @param {string} from  An id it requires.
   * @param {string} id    The id of the mixin being registered.
   * @param {Set<string>} [seen]
   * @returns {boolean}
   */
  const leadsTo = (from, id, seen=new Set()) => {
    if ( from === id ) return true;
    if ( seen.has(from) ) return false;
    seen.add(from);
    return [...(requirements.get(from) ?? [])].some(next => leadsTo(next, id, seen));
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
     * @param {string[]} [options.requires] Ids of the mixins that must already be applied to the class, beneath this
     *                                      one. It waits until they are, whatever the order of registration; they have
     *                                      to be registered for the same target. A mixin still waiting at `setup` is an
     *                                      error, and so is one that requires itself, however indirectly.
     */
    register(target, mixin, { id, exclude=[], requires=[] }={}) {
      if ( typeof target !== "string" ) throw new TypeError("mixins.register: the target must be a string.");
      if ( typeof mixin !== "function" ) {
        throw new TypeError(`mixins.register("${target}"): the mixin must be a function.`);
      }
      const model = target.match(MODEL_TARGET);
      const named = (typeof id === "string") && MIXIN_ID.test(id);
      if ( !named ) {
        const found = (id === undefined) ? "none was given" : `got ${JSON.stringify(id)}`;
        const message = `mixins.register("${target}"): give the mixin an id of the form "module-id:mixin-name"; `
          + `${found}.`;
        if ( model ) throw new Error(message);
        warn(message, `id:${target}:${mixin.name}`);
      } else if ( ids.has(id) && (ids.get(id) !== mixin) ) {
        const message = `mixins.register("${target}"): the id "${id}" is already used by another mixin; `
          + "ids must be unique.";
        if ( model ) throw new Error(message);
        warn(message, `duplicate:${id}`);
      } else ids.set(id, mixin);
      const identity = named ? id : mixin;
      if ( !Array.isArray(requires) || requires.some(required => (typeof required !== "string")
        || !MIXIN_ID.test(required)) ) {
        throw new TypeError(`mixins.register("${target}"): requires is a list of mixin ids of the form `
          + `"module-id:mixin-name"; got ${JSON.stringify(requires)}.`);
      }
      if ( named && requires.some(required => leadsTo(required, id)) ) {
        throw new Error(`mixins.register("${target}"): "${id}" requires itself, through ${requires.join(", ")}.`);
      }
      if ( named ) requirements.set(id, new Set([...(requirements.get(id) ?? []), ...requires]));
      if ( model ) {
        const [, documentName, type] = model;
        const entry = {
          documentName, type, mixin, id, exclude: new Set(exclude), requires: [...requires], found: false
        };
        if ( isSetUp ) {
          warn(`mixins.register("${target}"): registered after setup, when the world's documents already exist. `
            + "They keep the class they have, so the mixin reaches them unevenly. Register it during init.",
          `late:${id}`);
        }
        modelMixins.push(entry);
        settleEntry(entry);
        if ( isSetUp && !entry.found && (type !== "*") ) {
          warn(`mixins.register("${target}"): there is no class at CONFIG.${documentName}.dataModels.${type}; `
            + "mixin not applied.");
        }
        // After setup nothing more can be registered to satisfy it
        if ( isSetUp ) failFor(unmet(entry));
      } else if ( target.includes(".") ) {
        const entry = { target, mixin, id: identity, requires: [...requires] };
        if ( !pathEntries.has(target) ) pathEntries.set(target, []);
        pathEntries.get(target).push(entry);
        if ( isSetUp ) {
          settlePath(target);
          failFor(unmet(entry));
        }
      } else {
        const entry = { target, mixin, id: identity, requires: [...requires] };
        if ( !documentEntries.has(target) ) documentEntries.set(target, []);
        documentEntries.get(target).push(entry);
        if ( isReady ) settleDocument(target);
        if ( isSetUp ) failFor(unmet(entry));
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
      settleType(documentName, type);
      return models[type];
    },

    /**
     * Called once the document classes are set: by the system when it sets its own, or by the core module at `i18nInit`
     * if no one has by then. Flushes queued document mixins. Calling it again is harmless.
     */
    ready() {
      isReady = true;
      for ( const documentName of documentEntries.keys() ) settleDocument(documentName);
    },

    /**
     * Called by the core module at `setup`, before any module's `setup` hook (a second call does nothing). World
     * documents already exist, so this audits and no longer applies data model mixins; it then applies the queued
     * CONFIG path mixins, and throws for any mixin that is still waiting for what it requires.
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
      for ( const path of pathEntries.keys() ) settlePath(path);
      // Nothing more can be registered to satisfy what is still waiting
      failFor(unmet());
    }
  };
}
