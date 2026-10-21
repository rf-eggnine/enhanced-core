/**
 * Forward test batches to Quench when it is installed; do nothing otherwise, so modules can always register.
 * @param {Function} [resetWarnings]
 * @returns {{resetWarnings: Function, register: Function}}
 */
export default function(resetWarnings) {
  const queued = [];
  Hooks.once("quenchReady", quench => {
    for ( const args of queued.splice(0) ) quench.registerBatch(...args);
  });
  return {
    /** Forget shown API warnings so a test can assert on them again. */
    resetWarnings: resetWarnings,

    /**
     * Register a Quench batch.
     * @param {string} key       Batch key, conventionally `<module id>.<name>`.
     * @param {Function} fn      Quench batch function, receives the Quench context.
     * @param {object} [options] Quench batch options, e.g. `displayName`.
     */
    register(key, fn, options={}) {
      if ( globalThis.quench ) globalThis.quench.registerBatch(key, fn, options);
      else queued.push([key, fn, options]);
    }
  };
}
