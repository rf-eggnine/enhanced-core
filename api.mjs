import { MODULE } from "./module-info.mjs";

/* eslint-disable @stylistic/max-len */
/**
 * The neutral API (docs/API.md). Generated from the contract by utils/modulize.mjs: core members are always there,
 * advanced members are optional and must be feature-detected.
 * @typedef {object} AdvancedApi
 * @property {number} version
 * @property {Record<string, any>} capabilities
 * @property {any} registryParts
 * @property {{ AdvancedSystemDataModel?: any, fields: Record<string, any>, AdvancedSparseDataModel?: any, AdvancedItemDataModel?: any, SelectChoices?: any, Scaling?: any, [key: string]: any }} data
 * @property {{ AdvancedWindowV2?: any, AdvancedWindowV2Mixin?: any, AdvancedDialog?: any, AdvancedDocumentSheet?: any, DragDropApplicationMixin?: any, PrimarySheetMixin?: any, BaseConfigSheet?: any, BaseSettingsConfig?: any, tooltips?: Record<string, any>, CreateDocumentDialog?: any, headerExtensions?: Record<string, any>, inputs?: Record<string, any>, PseudoDocumentSheet?: any, FixedPositionContextMenu?: any, [key: string]: any }} applications
 * @property {Function} deprecateMoved
 * @property {Function} warnDeprecated
 * @property {{ register: Function, get: Function, has: Function, request: Function, require: Function, findConfig: Function, [key: string]: any }} modules
 * @property {{ register: Function, registerModel: Function, [key: string]: any }} mixins
 * @property {Function} moduleProvides
 * @property {Function} systemProvides
 * @property {{ register: Function, resetWarnings: Function, [key: string]: any }} tests
 * @property {string} [systemId]
 * @property {string} [cssNamespace]
 * @property {Record<string, any>} [config]
 * @property {{ status?: Record<string, any>, ready?: Record<string, any>, [key: string]: any }} [registry]
 * @property {Record<string, Function>} [utils]
 * @property {Record<string, Function>} [formatters]
 * @property {Record<string, Function>} [formulas]
 * @property {Record<string, Function>} [conversions]
 * @property {Record<string, Function>} [localization]
 * @property {Record<string, Function>} [units]
 * @property {Record<string, Function>} [properties]
 * @property {Record<string, Function>} [documents]
 */
/* eslint-enable @stylistic/max-len */

/**
 * The neutral API, published by the `advanced-core` module. Every module requires it, so it has loaded before this
 * file is evaluated; without it this module cannot work, and says so instead of failing on a missing member later.
 * @returns {AdvancedApi}
 */
function resolveApi() {
  const host = /** @type {typeof globalThis & { advancedApi?: AdvancedApi }} */ (globalThis);
  if ( !host.advancedApi ) {
    throw new Error(`${MODULE.id} needs the advanced-core module: enable it for this world.`);
  }
  return host.advancedApi;
}

export const api = resolveApi();
export { MODULE };

/**
 * Publish this module's public surface for dependents.
 * @param {object} moduleApi
 */
export function publish(moduleApi) {
  api.modules.register(MODULE.id, moduleApi);
}
