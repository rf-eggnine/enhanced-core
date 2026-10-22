import { createMixinRegistry } from "./api-mixins.mjs";
import { deprecateMoved, guard, resetWarnings, warnDeprecated } from "./api-guard.mjs";
import createModuleRegistry from "./api-module-registry.mjs";
import { createSurface } from "./api-surface.mjs";
import { mixinExclusions } from "./mixin-exclusions.mjs";
import registryParts from "./registry/_module.mjs";
import createTestRegistry from "./api-test-registry.mjs";

/**
 * Neutral, versioned contract that feature modules code against. Published as `globalThis.advancedApi` when this module
 * loads and mirrored on `game.system.api` at init. Modules read capabilities from here instead of branching on the
 * system id.
 */
export const API_VERSION = 1;

/* -------------------------------------------- */

/**
 * Build the API object. It starts with what this module provides; the game system adds its own parts with
 * `systemProvides` while it loads, before any ordinary module runs, and modules add to a namespace with
 * `moduleProvides`. Keep this surface small.
 *
 * Every namespace is a registry behind property syntax (see `api-surface.mjs`): `api.capabilities.register(key, value)`
 * and `api.capabilities[key] = value` do the same thing. `moduleProvides` and `systemProvides` register several
 * parts at once.
 * @returns {object}
 */
export function createApi() {
  /** Per-document-name base data models, filled by `systemProvides`; the mixin registry reads it when it needs one. */
  const bases = {};

  /**
   * Mixin exclusions a world has chosen (mixin id to the types it must not touch), from this module's world setting.
   * Empty until the setting is registered.
   * @returns {Record<string, string[]>}
   */
  const exclusions = () => mixinExclusions();

  const surface = createSurface();
  const { api } = surface;

  /**
   * `systemProvides(parts)`: supply the game system's parts: its id, and whatever it provides (`config`, `registry`,
   * `data`, `documents`, `applications`, `utils`, ...), which are published as given. Called by the system while it
   * loads, which is after library modules and before any ordinary module. `mixinBases` is the base data model per
   * document name, and is not published.
   * @param {object} parts
   * @param {string} [parts.systemId]
   * @param {string} [parts.cssNamespace]  The class the system's windows and tooltips carry for its theming.
   * @param {Record<string, Function>} [parts.mixinBases]
   * @internal
   */
  function systemProvides({ systemId, cssNamespace, mixinBases, ...rest }={}) {
    if (systemId === undefined) throw new Error("The systemId may not be undefined.");
    if (api.systemId !== undefined) throw new Error("The method systemProvides can only be called once.");
    api.systemId = systemId;
    if ( cssNamespace !== undefined ) api.cssNamespace = cssNamespace;
    surface.integrateCoreParts(rest);
    Object.assign(bases, mixinBases);
  }

  surface.coreRegister("version", API_VERSION);
  surface.coreRegisterSystemValue("systemId");
  surface.coreRegisterSystemValue("cssNamespace");
  surface.createCoreNamespace("capabilities");
  surface.createCoreNamespace("data", { open: true });
  surface.createCoreNamespace("applications", { open: true });
  surface.coreRegister("modules", createModuleRegistry());
  surface.coreRegister("mixins", createMixinRegistry({ bases, exclusions }));
  surface.coreRegister("registryParts", guard("registryParts", registryParts));
  surface.coreRegister("tests", createTestRegistry(resetWarnings));
  surface.coreRegister("deprecateMoved", deprecateMoved);
  surface.coreRegister("warnDeprecated", warnDeprecated);

  /**
   * `moduleProvides(namespace, parts)`: add to a namespace of the API, such as `applications`, from a module. The
   * parts are merged into what is there, as the system's are; a class or function that is already there is replaced,
   * with a warning, and a closed member such as `capabilities` is refused. Call it while the module evaluates, so that
   * every module after it finds the parts in place. A namespace the API has none of is created, open.
   */
  surface.coreRegister("moduleProvides", surface.coreProvides);
  surface.coreRegister("systemProvides", systemProvides);
  return api;
}
