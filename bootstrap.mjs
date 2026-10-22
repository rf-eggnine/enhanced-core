import { createApi } from "./create-api.mjs";

/**
 * Publish the neutral API. This module is a Foundry library module, so its scripts load before the game system's and
 * before every ordinary module: the system then adds its parts with `api.systemProvides(...)`, and modules find the API
 * complete when they load. This file must be the first thing `config.mjs` imports, because the module's own `api.mjs`
 * reads `globalThis.advancedApi` when it is evaluated and ES modules evaluate their imports in order.
 */
globalThis.advancedApi = createApi();

// The mixin registry's two steps are the core module's own, so a game system that knows nothing of them (any system but
// ours) still gets its mixins. A host that sets its document classes during `init` may call `mixins.ready()` itself,
// before modules register at `init`; if it does not, this does it at `i18nInit`, which is after `init` and before the
// world's documents are made. `setup` is registered here, at evaluation, so it runs before any module's own `setup`
// hook and the canvas has its classes in time.
Hooks.once("i18nInit", () => globalThis.advancedApi.mixins.ready());
Hooks.once("setup", () => globalThis.advancedApi.mixins.setup());
