import "./bootstrap.mjs";
import { api, MODULE, publish } from "./api.mjs";
import apiLayerTests from "./tests/api-layer.mjs";
import capabilitiesTests from "./tests/capabilities.mjs";
import registryTests from "./tests/registry.mjs";

/**
 * Feature flags and defaults that modules declare for each other, instead of branching on the system id. A module that
 * provides a feature adds it here when it loads (`declare({ defaultItemType: "enhanced-items.item" })`); a module that
 * wants the feature reads it from `api.capabilities` and carries on without it when it is absent.
 *
 * The API itself is created by `bootstrap.mjs` (which is why that import comes first); this file adds what the module
 * publishes about it.
 */

/**
 * Declare capabilities. Later declarations replace earlier ones with the same key.
 * @param {Record<string, any>} capabilities
 * @returns {Record<string, any>}  The capabilities object on the API.
 */
function declare(capabilities) {
  return Object.assign(api.capabilities, capabilities);
}

publish({ capabilities: api.capabilities, declare });

api.tests.register(`${MODULE.id}.capabilities`, capabilitiesTests, { displayName: "Enhanced Core: capabilities" });
api.tests.register(`${MODULE.id}.api-layer`, apiLayerTests, { displayName: "Enhanced Core: API layer" });
api.tests.register(`${MODULE.id}.registry`, registryTests, { displayName: "Enhanced Core: registry" });
