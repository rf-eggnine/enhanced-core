import { createApi } from "../create-api.mjs";

const api = globalThis.enhancedApi;

/**
 * Tests for the API layer the core module builds: how the API is composed from what the host supplies, the guard, and
 * the module registry. Each case builds a throwaway API with `createApi`, so nothing here touches the live one.
 */
export default function apiLayerBatch({ describe, it, assert }) {
  describe("the published API", () => {
    it("is on the global and mirrored on game.system", () => {
      assert.isObject(api);
      assert.strictEqual(game.system.api, api);
    });

    it("carries the contract version", () => {
      assert.isNumber(api.version);
    });

    it("does not publish the host's internal keys", () => {
      assert.notProperty(api, "mixinBases");
      assert.notProperty(api, "mixinExclusionsSetting");
    });

    it("has the system's id and parts, supplied while the system loaded", () => {
      assert.strictEqual(api.systemId, "eg9esffvtt");
      assert.isObject(api.data);
      assert.isObject(api.config);
      assert.isFunction(api.provide);
    });
  });

  describe("createApi", () => {
    it("publishes the parts the host provides, as given", () => {
      const data = { marker: true };
      const fresh = createApi();
      fresh.provide({ systemId: "test-system", data, extra: 3, mixinBases: { Item: class {} } });
      assert.strictEqual(fresh.systemId, "test-system");
      assert.strictEqual(fresh.data, data);
      assert.strictEqual(fresh.extra, 3);
      assert.notProperty(fresh, "mixinBases");
    });

    it("refuses a host that tries to replace a member the module owns", () => {
      const fresh = createApi();
      assert.throws(() => fresh.provide({ systemId: "x", modules: {} }), /modules/);
      assert.throws(() => fresh.provide({ version: 99, capabilities: {} }), /version, capabilities/);
      assert.isNumber(fresh.version);
    });

    it("starts with only the parts the module provides", () => {
      const fresh = createApi();
      assert.isNumber(fresh.version);
      assert.isObject(fresh.capabilities);
      assert.isFunction(fresh.modules.register);
      assert.isFunction(fresh.mixins.register);
      assert.isFunction(fresh.tests.register);
      assert.isFunction(fresh.deprecateMoved);
    });

    it("gives each API its own capabilities", () => {
      const first = createApi();
      const second = createApi();
      first.capabilities.testOnly = true;
      assert.notProperty(second.capabilities, "testOnly");
    });
  });

  describe("guard", () => {
    it("warns once about a member that does not exist, with a suggestion", () => {
      const fresh = createApi();
      fresh.tests.resetWarnings();
      const original = console.warn;
      const calls = [];
      console.warn = (...args) => calls.push(args.join(" "));
      try {
        fresh.capabilites;
        fresh.capabilites;
      } finally {
        console.warn = original;
      }
      assert.lengthOf(calls, 1, "the warning is shown once");
      assert.include(calls[0], "capabilites");
      assert.include(calls[0], "capabilities", "suggests the closest member");
    });

    it("does not warn about a member that exists", () => {
      const fresh = createApi();
      fresh.tests.resetWarnings();
      const original = console.warn;
      const calls = [];
      console.warn = (...args) => calls.push(args.join(" "));
      try {
        fresh.version;
        fresh.capabilities;
      } finally {
        console.warn = original;
      }
      assert.lengthOf(calls, 0);
    });
  });

  describe("module registry", () => {
    it("publishes, finds and reports a module's API", () => {
      const { modules } = createApi();
      const published = { value: 1 };
      assert.isFalse(modules.has("enhanced-test-a"));
      assert.isUndefined(modules.get("enhanced-test-a"));
      modules.register("enhanced-test-a", published);
      assert.isTrue(modules.has("enhanced-test-a"));
      assert.strictEqual(modules.get("enhanced-test-a").value, 1);
    });

    it("is locked on the live API once init has run", () => {
      assert.throws(() => api.modules.register("enhanced-test-late", {}), /locked/);
      assert.isFalse(api.modules.has("enhanced-test-late"));
    });

    it("require throws a message naming an absent module", () => {
      const { modules } = createApi();
      assert.throws(() => modules.require("enhanced-test-missing"), /enhanced-test-missing/);
    });

    it("require returns a module that is present", () => {
      const { modules } = createApi();
      modules.register("enhanced-test-b", { ok: true });
      assert.isTrue(modules.require("enhanced-test-b").ok);
    });

    it("mirrors a published module's API on Foundry's module object", () => {
      const module = game.modules.get("enhanced-core");
      assert.isOk(module?.api, "the core module is installed and enabled for this test");
      assert.strictEqual(module.api, api.modules.get("enhanced-core"));
    });

    it("finds a vocabulary by config key, first registered module winning", () => {
      const { modules } = createApi();
      modules.register("enhanced-test-first", { config: { vocab: "first" } });
      modules.register("enhanced-test-second", { config: { vocab: "second", other: "x" } });
      assert.strictEqual(modules.findConfig("vocab"), "first");
      assert.strictEqual(modules.findConfig("other"), "x");
      assert.isUndefined(modules.findConfig("nothing"));
    });
  });
}
