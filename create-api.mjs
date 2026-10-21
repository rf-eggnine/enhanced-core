import { createMixinRegistry } from "./api-mixins.mjs";
import { deprecateMoved, guard, resetWarnings, warnDeprecated } from "./api-guard.mjs";
import createModuleRegistry from "./api-module-registry.mjs";
import { mixinExclusions } from "./mixin-exclusions.mjs";
import registryParts from "./registry/_module.mjs";
import createTestRegistry from "./api-test-registry.mjs";

/**
 * Neutral, versioned contract that feature modules code against. Published as `globalThis.advancedApi` when this module
 * loads and mirrored on `game.system.api` at init. Modules read capabilities from here instead of branching on the
 * system id.
 */
export const API_VERSION = 1;

/**
 * Merge a namespace that a host or a module supplies into one of the API's. Members that are objects are merged; a
 * class or function that is already there is not replaced.
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
  "version", "capabilities", "registryParts", "deprecateMoved", "warnDeprecated", "modules", "mixins",
  "tests", "provide", "contribute"
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

  /**
   * Mixin exclusions a world has chosen (mixin id to the types it must not touch), from this module's world setting.
   * Empty until the setting is registered.
   * @returns {Record<string, string[]>}
   */
  const exclusions = () => mixinExclusions();

  const surface = {
    version: API_VERSION,
    systemId: undefined,
    cssNamespace: undefined,
    registryParts: guard("registryParts", registryParts),
    capabilities: {},
    data: {},
    applications: {},
    modules: createModuleRegistry(),
    mixins: createMixinRegistry({ bases, exclusions }),
    tests: createTestRegistry(resetWarnings),
    deprecateMoved,
    warnDeprecated,

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
      if ( !parts || (typeof parts !== "object") ) {
        throw new Error(`contribute("${namespace}") needs an object of parts.`);
      }
      const existing = surface[namespace];
      if ( existing === undefined ) surface[namespace] = { ...parts };
      else if ( existing && (typeof existing === "object") ) mergeNamespace(existing, parts, namespace);
      else throw new Error(`The API member ${namespace} is not a namespace that can be added to.`);
    },

    /**
     * Supply the game system's parts: its id, and whatever it provides (`config`, `registry`, `data`, `documents`,
     * `applications`, `utils`, ...), which are published as given. Called by the system while it loads, which is after
     * library modules and before any ordinary module. `mixinBases` is the base data model per document name, and is
     * not published.
     * @param {object} parts
     * @param {string} [parts.systemId]
     * @param {string} [parts.cssNamespace]  The class the system's windows and tooltips carry for its theming.
     * @param {Record<string, Function>} [parts.mixinBases]
     * @internal
     */
    provide({ systemId, mixinBases, ...rest }={}) {
      const reserved = Object.keys(rest).filter(key => RESERVED.has(key));
      if ( reserved.length ) {
        throw new Error(`The host cannot replace Advanced API members: ${reserved.join(", ")}.`);
      }
      surface.systemId = systemId;
      Object.assign(bases, mixinBases);
      for ( const [key, value] of Object.entries(rest) ) {
        if ( (typeof surface[key] === "object") && surface[key] && (typeof value === "object") && value ) {
          mergeNamespace(surface[key], value, key);
        } else surface[key] = value;
      }
    }
  };
  return guard("advancedApi", surface);
}
