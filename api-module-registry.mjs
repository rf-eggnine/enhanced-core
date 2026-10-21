import { MODULE } from "./module-info.mjs";
import { guard } from "./api-guard.mjs";
import composeFrom from "./registry/compose-from.mjs";
import { LockingBehavior } from "./registry/lockable-registry-mixin.mjs";

/**
 * Modules publish their own API here, and dependents read it here: no module imports another module's files.
 * Registered at module evaluation (load order follows `relationships.requires`) and mirrored on
 * `game.modules.get(id).api` at init, which is Foundry's convention. The store is a `Registry`; `require` and
 * `findConfig` read it but are not part of it. Its ready hook (`advanced-core.modules.ready`) fires at init, after the
 * mirroring, so a listener sees every module's API. The registry is locked from then on: a module must publish while
 * it loads, and one that publishes later gets an error naming it, since its API would never be mirrored.
 * @returns {{register: Function, get: Function, has: Function, request: Function, require: Function,
 *   findConfig: Function}}
 */
export default function createModuleRegistry() {
  const Registry = composeFrom({
    identified: true,
    awaitable: true,
    lockable: true,
    unique: true,
    keyed: true
  });
  const registry = new Registry({
    namespace: MODULE.id,
    name: "modules",
    lockingBehavior: LockingBehavior.LockAtHook
  });
  Hooks.once(registry.hook, () => {
    for ( const [id, moduleApi] of registry.entries() ) {
      const module = game.modules.get(id);
      if ( module && !module.api ) module.api = moduleApi;
    }
  });
  Hooks.once("init", () => registry.ready());
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
      return await registry.request(id);
    },

    /**
     * Find a vocabulary by config key in any published module config (own tables first is the caller's job).
     * The first registered module that has the key wins.
     * @param {string} key
     * @param {*} [defaultValue]  Returned when no module has the key, or the one that has it holds nothing (`null` or
     *   `undefined`) there. Pass a fresh object at the call (`findConfig(key, {})`), not one kept and shared: a caller
     *   that changes it would change it for everyone.
     * @returns {*}
     */
    findConfig(key, defaultValue = undefined) {
      for ( const moduleApi of registry.values() ) {
        if ( "config" in moduleApi && Object.hasOwn(moduleApi.config, key) ) {
          if ( defaultValue !== undefined ) return moduleApi.config[key] ?? defaultValue;
          return moduleApi.config[key];
        }
      }
      if ( defaultValue !== undefined ) return defaultValue;
    },

    /**
     * Read another module's API, failing with a clear message when it is absent.
     * @param {string} id
     * @returns {object}
     */
    require(id) {
      const moduleApi = registry.get(id);
      if ( !moduleApi ) throw new Error(`Advanced module "${id}" is required but has not published an API.`);
      return moduleApi;
    }
  };
}
