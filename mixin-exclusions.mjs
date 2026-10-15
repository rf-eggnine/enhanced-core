import { MODULE } from "./module-info.mjs";

/** The name of the setting. */
export const MIXIN_EXCLUSIONS_SETTING = "mixinExclusions";

/**
 * Register the world setting that holds the mixins a world has opted out of, as `{ "<mixin id>": ["<type>", ...] }`.
 * The mixin registry reads it as each mixin is applied, during `init`, so it is the module that has the registry that
 * has the setting. Call during `init`.
 */
export function registerMixinExclusionsSetting() {
  game.settings.register(MODULE.settings, MIXIN_EXCLUSIONS_SETTING, {
    scope: "world",
    config: false,
    default: {},
    type: Object
  });
}

/**
 * The mixins this world has opted out of, mixin id to the types it must not touch. Empty until the setting is
 * registered.
 * @returns {Record<string, string[]>}
 */
export function mixinExclusions() {
  try {
    return game.settings.get(MODULE.settings, MIXIN_EXCLUSIONS_SETTING) ?? {};
  } catch {
    return {};
  }
}
