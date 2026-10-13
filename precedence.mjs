import { MODULE } from "./module-info.mjs";

/**
 * Who has the last word where the game system and the Enhanced modules both set the same thing (a class on `CONFIG`, a rule): the
 * system, which is what a system's author expects, or the Enhanced modules.
 * @enum {string}
 */
export const PRECEDENCE = Object.freeze({ HOST: "host", ENHANCED: "enhanced" });

/** The name of the setting. */
export const PRECEDENCE_SETTING = "precedence";

/**
 * Register the world setting. Call during `init`.
 */
export function registerPrecedenceSetting() {
  game.settings.register(MODULE.settings, PRECEDENCE_SETTING, {
    name: `SETTINGS.${MODULE.loc}.PRECEDENCE.Name`,
    hint: `SETTINGS.${MODULE.loc}.PRECEDENCE.Hint`,
    scope: "world",
    config: true,
    type: String,
    default: PRECEDENCE.HOST,
    choices: {
      [PRECEDENCE.HOST]: `SETTINGS.${MODULE.loc}.PRECEDENCE.Host`,
      [PRECEDENCE.ENHANCED]: `SETTINGS.${MODULE.loc}.PRECEDENCE.Enhanced`
    },
    requiresReload: true
  });
}

/**
 * Who has precedence in this world: the game system's own choices (the default), or the Enhanced modules'. A module that
 * puts something on `CONFIG` before the system does, or that has a rule the system also has, asks this before deciding who gives
 * way. Before the setting is registered (before `init` ends) the answer is the default.
 * @returns {string}  One of `PRECEDENCE`.
 */
export function precedence() {
  try {
    return game.settings.get(MODULE.settings, PRECEDENCE_SETTING);
  } catch {
    return PRECEDENCE.HOST;
  }
}

/**
 * Do the Enhanced modules have precedence in this world?
 * @returns {boolean}
 */
export function enhancedHasPrecedence() {
  return precedence() === PRECEDENCE.ENHANCED;
}
