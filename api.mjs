import { MODULE } from "./module-info.mjs";

/**
 * The neutral API (docs/API.md). Generated from the contract by utils/modulize.mjs: core members are always there,
 * enhanced members are optional and must be feature-detected.
 * @typedef {object} EnhancedApi
 * @property {number} version
 * @property {Record<string, any>} capabilities
 * @property {{ EnhancedDataModel: any, fields: Record<string, any>, EnhancedItemDataModel?: any, EnhancedSparseDataModel?: any, SelectChoices?: any, Scaling?: any, [key: string]: any }} data
 * @property {{ EnhancedApplication?: any, EnhancedApplicationV2Mixin?: any, EnhancedDialog?: any, EnhancedDocumentSheet?: any, DragDropApplicationMixin?: any, PrimarySheetMixin?: any, ItemListsMixin?: any, BaseConfigSheet?: any, inputs?: any, CreateDocumentDialog?: any, PseudoDocumentSheet?: any, FixedPositionContextMenu?: any, [key: string]: any }} applications
 * @property {Function} deprecateMoved
 * @property {{ register: Function, get: Function, has: Function, require: Function, findConfig: Function, [key: string]: any }} modules
 * @property {{ register: Function, registerModel: Function, [key: string]: any }} mixins
 * @property {{ register: Function, resetWarnings: Function, [key: string]: any }} tests
 * @property {string} [systemId]
 * @property {Record<string, any>} [config]
 * @property {Record<string, any>} [registry]
 * @property {Record<string, Function>} [utils]
 * @property {Record<string, Function>} [formatters]
 * @property {Record<string, Function>} [formulas]
 * @property {Record<string, Function>} [conversions]
 * @property {Record<string, Function>} [localization]
 * @property {Record<string, Function>} [units]
 * @property {Record<string, Function>} [properties]
 * @property {Record<string, Function>} [documents]
 */

/**
 * The neutral API, published by the `enhanced-core` module. Every module requires it, so it has loaded before this
 * file is evaluated; without it this module cannot work, and says so instead of failing on a missing member later.
 * @returns {EnhancedApi}
 */
function resolveApi() {
  const host = /** @type {typeof globalThis & { enhancedApi?: EnhancedApi }} */ (globalThis);
  if ( !host.enhancedApi ) {
    throw new Error(`${MODULE.id} needs the enhanced-core module: enable it for this world.`);
  }
  return host.enhancedApi;
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
