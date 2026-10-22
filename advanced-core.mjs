import "./bootstrap.mjs";
import { api, publish } from "./api.mjs";
import { createApi } from "./create-api.mjs";
import { mixinExclusions, registerMixinExclusionsSetting } from "./mixin-exclusions.mjs";
import { watch, registerWatchSettings } from "./foundry-watch-install.mjs";
import { advancedHasPrecedence, PRECEDENCE, precedence, registerPrecedenceSetting } from "./precedence.mjs";

/**
 * Feature flags and defaults that modules declare for each other, instead of branching on the system id. A module that
 * provides a feature adds it here when it loads (`declare({ defaultItemType: "advanced-items.item" })`); a module that
 * wants the feature reads it from `api.capabilities` and carries on without it when it is absent.
 *
 * - `mixinExclusions()`: the world setting of the mixins a world has opted out of, `{ "<mixin id>": ["<type>", ...] }`,
 *   which the mixin registry reads as each mixin is applied.
 * - `precedence()` and `advancedHasPrecedence()`: the world setting that says who has the last word where the game
 *   system and the Advanced modules both set the same thing, `PRECEDENCE.HOST` (the default) or `PRECEDENCE.ADVANCED`.
 *
 * The API itself is created by `bootstrap.mjs` (which is why that import comes first); this file adds what the module
 * publishes about it.
 */

/**
 * Declare capabilities. A later declaration replaces an earlier one with the same key, and warns.
 * @param {Record<string, any>} capabilities
 * @returns {Record<string, any>}  The capabilities object on the API.
 */
function declare(capabilities) {
  return Object.assign(api.capabilities, capabilities);
}

// `createApi` builds an API of its own, which the tests use to try the composition without touching the live one
publish({
  capabilities: api.capabilities, declare, createApi, PRECEDENCE, precedence, advancedHasPrecedence, mixinExclusions,
  watch: { register: watch.register, report: watch.report }
});

// Register world settings
Hooks.once("init", () => {
  registerPrecedenceSetting();
  registerMixinExclusionsSetting();
  registerWatchSettings();
});
