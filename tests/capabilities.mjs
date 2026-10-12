const api = globalThis.enhancedApi;
const MODULE_ID = "enhanced-core";

/**
 * Tests for the capabilities the core module publishes.
 */
export default function capabilitiesBatch({ describe, it, assert }) {
  const moduleApi = () => api.modules.require(MODULE_ID);

  describe("api.capabilities", () => {
    it("is an object on the neutral API", () => {
      assert.isObject(api.capabilities);
    });

    it("is the same object the module publishes", () => {
      assert.strictEqual(moduleApi().capabilities, api.capabilities);
    });
  });

  describe("declare", () => {
    it("adds capabilities and returns the shared object", () => {
      const key = "testOnlyCapability";
      try {
        const result = moduleApi().declare({ [key]: "yes" });
        assert.strictEqual(result, api.capabilities);
        assert.strictEqual(api.capabilities[key], "yes");
      } finally {
        delete api.capabilities[key];
      }
    });

    it("replaces an earlier declaration with the same key", () => {
      const key = "testOnlyCapability";
      try {
        moduleApi().declare({ [key]: "first" });
        moduleApi().declare({ [key]: "second" });
        assert.strictEqual(api.capabilities[key], "second");
      } finally {
        delete api.capabilities[key];
      }
    });

    it("keeps capabilities other modules declared", () => {
      const keys = ["testOnlyA", "testOnlyB"];
      try {
        moduleApi().declare({ [keys[0]]: 1 });
        moduleApi().declare({ [keys[1]]: 2 });
        assert.strictEqual(api.capabilities[keys[0]], 1);
        assert.strictEqual(api.capabilities[keys[1]], 2);
      } finally {
        for ( const key of keys ) delete api.capabilities[key];
      }
    });
  });
}
