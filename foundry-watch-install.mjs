import { MODULE } from "./module-info.mjs";
import { createWatch } from "./foundry-watch.mjs";
import exceptions from "./foundry-watch-exceptions.mjs";

/** The names of the settings. */
export const WATCH_SETTING = "watch";
export const WATCH_LOG_SETTING = "watchLog";

/** Settings can be read once they are registered, at `init`; before that the defaults hold. */
let settingsReady = false;

/**
 * Read a boolean setting, or its default while the settings are not registered yet.
 * @param {string} key
 * @param {boolean} fallback
 * @returns {boolean}
 */
function read(key, fallback) {
  if ( !settingsReady ) return fallback;
  try {
    return !!game.settings.get(MODULE.settings, key);
  } catch {
    return fallback;
  }
}

/**
 * The watch over `CONFIG`. Installed when the module evaluates, before any module that loads after it writes there.
 * A failure installs nothing and is logged once: the watch only warns, so the world carries on without it.
 */
export const watch = createWatch(CONFIG, {
  exceptions,
  enabled: () => read(WATCH_SETTING, true),
  log: () => read(WATCH_LOG_SETTING, false)
});

try {
  watch.install();
} catch (error) {
  console.error("Advanced API | The watch on CONFIG could not be installed.", error);
}

/**
 * Register the world settings of the watch. Call during `init`.
 */
export function registerWatchSettings() {
  game.settings.register(MODULE.settings, WATCH_SETTING, {
    name: `SETTINGS.${MODULE.loc}.WATCH.Name`,
    hint: `SETTINGS.${MODULE.loc}.WATCH.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE.settings, WATCH_LOG_SETTING, {
    name: `SETTINGS.${MODULE.loc}.WATCHLOG.Name`,
    hint: `SETTINGS.${MODULE.loc}.WATCHLOG.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  settingsReady = true;

  // Writes before this point were recorded but could not be logged, as the setting was not readable yet
  const earlier = watch.report();
  if ( earlier.length && read(WATCH_LOG_SETTING, false) ) {
    console.groupCollapsed(`Advanced watch | ${earlier.length} writes to CONFIG before init`);
    for ( const { op, path, owner, previous } of earlier ) console.info(`${op} ${path} by ${owner}`, { previous });
    console.groupEnd();
  }
}
