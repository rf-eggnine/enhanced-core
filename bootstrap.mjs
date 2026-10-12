import { createApi } from "./create-api.mjs";

/**
 * Publish the neutral API. This module is a Foundry library module, so its scripts load before the game system's and
 * before every ordinary module: the system then adds its parts with `api.provide(...)`, and modules find the API
 * complete when they load. This file must be the first thing `config.mjs` imports, because the module's own `api.mjs`
 * reads `globalThis.enhancedApi` when it is evaluated and ES modules evaluate their imports in order.
 */
globalThis.enhancedApi = createApi();

// Mirror it on the system object, where modules and older code expect it, once Foundry has loaded the system
Hooks.once("init", () => {
  if ( game.system && !game.system.api ) game.system.api = globalThis.enhancedApi;
});
