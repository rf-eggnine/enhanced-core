import { createMixinRegistry } from "./api-mixins.mjs";
import { deprecateMoved, guard, resetWarnings } from "./api-guard.mjs";
import { MODULE } from "./module-info.mjs";
import Registry from "./registry.mjs";
import * as fields from "./data/fields/_module.mjs";

/**
 * Neutral, versioned contract that feature modules code against. Published as `globalThis.enhancedApi` when this module
 * loads and mirrored on `game.system.api` at init. Modules read capabilities from here instead of branching on the
 * system id.
 */
export const API_VERSION = 1;

/**
 * Merge a namespace that a host or a module supplies into one of the API's. Members that are objects are merged; a class or
 * function that is already there is not replaced.
 * @param {object} target  A namespace of the API (a plain, extensible object).
 * @param {object} source  The namespace being added.
 * @param {string} path    Where they are in the API, for the error message.
 */
function mergeNamespace(target, source, path) {
  for ( const [key, value] of Object.entries(source) ) {
    const existing = target[key];
    if ( existing === undefined ) target[key] = value;
    else if ( (typeof existing === "object") && (typeof value === "object") && existing && value ) {
      mergeNamespace(existing, value, `${path}.${key}`);
    } else throw new Error(`The host cannot replace API member ${path}.${key}.`);
  }
}

/**
 * Members of the API that the host game system may not replace when it supplies its parts.
 */
const RESERVED = new Set([
  "version", "capabilities", "Registry", "deprecateMoved", "modules", "mixins", "tests", "provide", "contribute"
]);

/**
 * Members the host supplies that are values, not namespaces: a module cannot add to them (they start out undefined, so
 * they would otherwise look like a namespace that does not exist yet).
 */
const VALUES = new Set(["systemId", "cssNamespace"]);

/* -------------------------------------------- */

/**
 * Build the API object. It starts with what this module provides; the game system adds its own parts with `provide`
 * while it loads, before any ordinary module runs. Keep this surface small.
 * @returns {object}
 */
export function createApi() {
  /** Per-document-name base data models, filled by `provide`; the mixin registry reads it each time it needs one. */
  const bases = {};
  /** What `provide` has recorded for the world setting that holds the mixin exclusions. */
  const host = {};

  /**
   * Mixin exclusions a world has chosen (mixin id to the types it must not touch), from the host's world setting.
   * Empty until the setting is registered.
   * @returns {Record<string, string[]>}
   */
  const exclusions = () => {
    try {
      return game.settings.get(host.systemId, host.mixinExclusionsSetting ?? "mixinExclusions") ?? {};
    } catch {
      return {};
    }
  };

  const surface = {
    version: API_VERSION,
    systemId: undefined,
    cssNamespace: undefined,
    capabilities: {},
    Registry,
    // The host adds to these with `provide`; `data.fields` starts with the fields that need nothing from a game system
    data: { fields: { ...fields } },
    deprecateMoved,
    modules: createModuleRegistry(),
    mixins: createMixinRegistry({ bases, exclusions }),
    tests: createTestRegistry(),

    /**
     * Add to a namespace of the API, such as `applications`, from a module. The parts are merged into what is there, as
     * the host's are; a class or function that is already there is not replaced, and a name this module owns is not a
     * namespace. Call it while the module evaluates, so that every module after it finds the parts in place.
     * @param {string} namespace  Name of the namespace; created when the API has none by that name.
     * @param {object} parts      What to add.
     */
    contribute(namespace, parts) {
      if ( (typeof namespace !== "string") || !namespace ) throw new Error("contribute needs the name of a namespace.");
      if ( RESERVED.has(namespace) || VALUES.has(namespace) ) {
        throw new Error(`contribute cannot add to the API member ${namespace}.`);
      }
      if ( !parts || (typeof parts !== "object") ) throw new Error(`contribute("${namespace}") needs an object of parts.`);
      const existing = surface[namespace];
      if ( existing === undefined ) surface[namespace] = { ...parts };
      else if ( existing && (typeof existing === "object") ) mergeNamespace(existing, parts, namespace);
      else throw new Error(`The API member ${namespace} is not a namespace that can be added to.`);
    },

    /**
     * Supply the game system's parts: its id, and whatever it provides (`config`, `registry`, `data`, `documents`,
     * `applications`, `utils`, ...), which are published as given. Called by the system while it loads, which is after
     * this module and before any ordinary module. `mixinBases` is the base data model per document name and
     * `mixinExclusionsSetting` names the world setting holding the mixin exclusions; neither is published.
     * @param {object} parts
     * @param {string} [parts.systemId]
     * @param {string} [parts.cssNamespace]  The class the system's windows and tooltips carry for its theming.
     * @param {Record<string, Function>} [parts.mixinBases]
     * @param {string} [parts.mixinExclusionsSetting]
     * @internal
     */
    provide({ systemId, mixinBases, mixinExclusionsSetting, ...rest }={}) {
      const reserved = Object.keys(rest).filter(key => RESERVED.has(key));
      if ( reserved.length ) throw new Error(`The host cannot replace API members: ${reserved.join(", ")}.`);
      host.systemId = systemId;
      host.mixinExclusionsSetting = mixinExclusionsSetting;
      Object.assign(bases, mixinBases);
      surface.systemId = systemId;
      for ( const [key, value] of Object.entries(rest) ) {
        if ( (typeof surface[key] === "object") && surface[key] && (typeof value === "object") && value ) {
          mergeNamespace(surface[key], value, key);
        } else surface[key] = value;
      }
    }
  };
  return guard("enhancedApi", surface);
}

/* -------------------------------------------- */

/**
 * Modules publish their own API here, and dependents read it here: no module imports another module's files.
 * Registered at module evaluation (load order follows `relationships.requires`) and mirrored on
 * `game.modules.get(id).api` at init, which is Foundry's convention. The store is a `Registry`; `require` and
 * `findConfig` read it but are not part of it. Its ready hook (`enhanced-core.modules.ready`) fires at init, after the
 * mirroring, so a listener sees every module's API. The registry is locked from then on: a module must publish while
 * it loads, and one that publishes later gets an error naming it, since its API would never be mirrored.
 * @returns {{register: Function, get: Function, has: Function, request: Function, require: Function,
 *   findConfig: Function}}
 */
function createModuleRegistry() {
  const registry = new Registry({ module: MODULE, id: "modules", lockingBehavior: Registry.LockingBehavior.LockAtHook });
  Hooks.once(registry.hook, () => {
    for ( const [id, moduleApi] of registry.entries() ) {
      const module = game.modules.get(id);
      if ( module && !module.api ) module.api = moduleApi;
    }
  });
  Hooks.once("init", () => registry.ready());
  // Settles when publishing is over, after the mirroring above (its listener was added first)
  const whenReady = new Promise(resolve => Hooks.once(registry.hook, () => resolve()));
  return {
    /**
     * Publish a module's API.
     * @param {string} id          Module id.
     * @param {object} moduleApi   The module's public surface.
     */
    register(id, moduleApi) {
      registry.register(id, guard(id, moduleApi));
    },

    /**
     * Read another module's API, if present.
     * @param {string} id
     * @returns {object|undefined}
     */
    get(id) {
      return registry.get(id);
    },

    /**
     * Is another module's API present?
     * @param {string} id
     * @returns {boolean}
     */
    has(id) {
      return registry.has(id);
    },

    /**
     * Ask for a module's API that is optional. Unlike `get`, the answer is final: it waits until every module has
     * published (the registry's ready hook, at init), so a module that loads later is not mistaken for an absent one.
     * Never throws; after init it resolves at once. Use `require` for a module that is needed.
     * @param {string} id
     * @returns {Promise<object|undefined>}  The module's API, or undefined when it published none.
     */
    async request(id) {
      if ( !registry.isReady ) await whenReady;
      return registry.get(id);
    },

    /**
     * Find a vocabulary by config key in any published module config (own tables first is the caller's job).
     * The first registered module that has the key wins.
     * @param {string} key
     * @returns {*}
     */
    findConfig(key) {
      for ( const moduleApi of registry.values() ) {
        if ( "config" in moduleApi && key in moduleApi.config ) return moduleApi.config[key];
      }
    },

    /**
     * Read another module's API, failing with a clear message when it is absent.
     * @param {string} id
     * @returns {object}
     */
    require(id) {
      const moduleApi = registry.get(id);
      if ( !moduleApi ) throw new Error(`Enhanced module "${id}" is required but has not published an API.`);
      return moduleApi;
    }
  };
}

/* -------------------------------------------- */

/**
 * Forward test batches to Quench when it is installed; do nothing otherwise, so modules can always register.
 * @returns {{register: Function}}
 */
function createTestRegistry() {
  const queued = [];
  Hooks.once("quenchReady", quench => {
    for ( const args of queued.splice(0) ) quench.registerBatch(...args);
  });
  return {
    /** Forget shown API warnings so a test can assert on them again. */
    resetWarnings,

    /**
     * Register a Quench batch.
     * @param {string} key       Batch key, conventionally `<module id>.<name>`.
     * @param {Function} fn      Quench batch function, receives the Quench context.
     * @param {object} [options] Quench batch options, e.g. `displayName`.
     */
    register(key, fn, options={}) {
      if ( globalThis.quench ) globalThis.quench.registerBatch(key, fn, options);
      else queued.push([key, fn, options]);
    }
  };
}

/* -------------------------------------------- */
