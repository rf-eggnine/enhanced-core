import Registry from "../registry.mjs";

const OWNER = Object.freeze({ id: "enhanced-test-owner" });
let counter = 0;

/**
 * Tests for the generic Registry. Each case makes its own registry with a fresh id, so the hooks it fires cannot reach
 * another case.
 */
export default function registryBatch({ describe, it, assert }) {
  const create = options => new Registry({ module: OWNER, id: `registry-test-${counter++}`, ...options });

  describe("construction", () => {
    it("is on the API", () => {
      assert.strictEqual(globalThis.enhancedApi.Registry, Registry);
    });

    it("needs the owning module and an id", () => {
      assert.throws(() => new Registry({ id: "x" }), /module/);
      assert.throws(() => new Registry({ module: OWNER }), /id/);
      assert.throws(() => new Registry({ module: OWNER, id: "" }), /id/);
    });

    it("names its hook after the module and the registry", () => {
      const registry = new Registry({ module: OWNER, id: "properties" });
      assert.strictEqual(registry.id, "properties");
      assert.strictEqual(registry.hook, "enhanced-test-owner.properties.ready");
    });
  });

  describe("register, get and has", () => {
    it("stores and returns a definition", () => {
      const registry = create();
      const definition = { label: "Weight" };
      registry.register("weight", definition);
      assert.isTrue(registry.has("weight"));
      assert.strictEqual(registry.get("weight"), definition);
    });

    it("answers for a key that was never registered", () => {
      const registry = create();
      assert.isFalse(registry.has("nothing"));
      assert.isUndefined(registry.get("nothing"));
    });

    it("replaces an earlier definition with the same key", () => {
      const registry = create();
      registry.register("k", { n: 1 });
      registry.register("k", { n: 2 });
      assert.strictEqual(registry.get("k").n, 2);
    });

    it("returns the registry so calls can be chained", () => {
      const registry = create();
      assert.strictEqual(registry.register("a", 1).register("b", 2), registry);
      assert.isTrue(registry.has("b"));
    });

    it("rejects a key that is not a non-empty string", () => {
      const registry = create();
      assert.throws(() => registry.register("", {}), /key/);
      assert.throws(() => registry.register(3, {}), /key/);
      assert.throws(() => registry.register(undefined, {}), /key/);
    });

    it("rejects a definition the validator throws on, and stores nothing", () => {
      const registry = create({
        validate: definition => { if ( typeof definition.label !== "function" ) throw new Error("needs a label"); }
      });
      assert.throws(() => registry.register("bad", {}), /needs a label/);
      assert.isFalse(registry.has("bad"));
      registry.register("good", { label: () => "" });
      assert.isTrue(registry.has("good"));
    });

    it("passes the key to the validator", () => {
      const seen = [];
      const registry = create({ validate: (definition, key) => seen.push(key) });
      registry.register("one", {});
      assert.deepEqual(seen, ["one"]);
    });

    it("keeps registries apart", () => {
      const first = create();
      const second = create();
      first.register("k", 1);
      assert.isFalse(second.has("k"));
    });
  });

  describe("locking behavior", () => {
    const { None, WarnAfterHook, LockAtHook } = Registry.LockingBehavior;

    /** Run a function and collect what it sent to console.warn. */
    function warnings(fn) {
      const original = console.warn;
      const calls = [];
      console.warn = (...args) => calls.push(args.join(" "));
      try {
        fn();
      } finally {
        console.warn = original;
      }
      return calls;
    }

    it("offers the three values and defaults to None", () => {
      assert.deepEqual(Object.keys(Registry.LockingBehavior), ["None", "WarnAfterHook", "LockAtHook"]);
      assert.strictEqual(create().lockingBehavior, None);
    });

    it("rejects a value it does not know", () => {
      assert.throws(() => create({ lockingBehavior: "Forever" }), /locking behavior/);
    });

    it("None accepts a late registration without a word", () => {
      const registry = create({ lockingBehavior: None });
      registry.ready();
      const calls = warnings(() => registry.register("late", 1));
      assert.lengthOf(calls, 0);
      assert.isTrue(registry.has("late"));
      assert.isFalse(registry.isLocked);
    });

    it("WarnAfterHook accepts registrations before ready without a word", () => {
      const registry = create({ lockingBehavior: WarnAfterHook });
      const calls = warnings(() => registry.register("early", 1));
      assert.lengthOf(calls, 0);
    });

    it("WarnAfterHook stores a late registration and warns, naming the key and the hook", () => {
      const registry = create({ lockingBehavior: WarnAfterHook });
      registry.ready();
      const calls = warnings(() => registry.register("late", 1));
      assert.lengthOf(calls, 1);
      assert.include(calls[0], "late");
      assert.include(calls[0], registry.hook);
      assert.isTrue(registry.has("late"));
      assert.isFalse(registry.isLocked);
    });

    it("LockAtHook accepts registrations until ready", () => {
      const registry = create({ lockingBehavior: LockAtHook });
      registry.register("early", 1);
      assert.isFalse(registry.isLocked);
      assert.isTrue(registry.has("early"));
    });

    it("LockAtHook refuses a registration once ready, and keeps what was there", () => {
      const registry = create({ lockingBehavior: LockAtHook });
      registry.register("early", 1);
      registry.ready();
      assert.isTrue(registry.isLocked);
      assert.throws(() => registry.register("late", 2), /locked/);
      assert.throws(() => registry.register("early", 3), /locked/);
      assert.isFalse(registry.has("late"));
      assert.strictEqual(registry.get("early"), 1);
    });

    it("LockAtHook is already locked while the ready hook runs", () => {
      const registry = create({ lockingBehavior: LockAtHook });
      let lockedInHook;
      Hooks.once(registry.hook, ready => { lockedInHook = ready.isLocked; });
      registry.ready();
      assert.isTrue(lockedInHook);
    });

    it("a refused registration is not validated", () => {
      let validated = 0;
      const registry = create({ lockingBehavior: LockAtHook, validate: () => validated++ });
      registry.ready();
      assert.throws(() => registry.register("late", 1), /locked/);
      assert.strictEqual(validated, 0);
    });
  });

  describe("iteration", () => {
    it("lists keys, values and entries in registration order", () => {
      const registry = create();
      registry.register("b", 2).register("a", 1);
      assert.deepEqual([...registry.keys()], ["b", "a"]);
      assert.deepEqual([...registry.values()], [2, 1]);
      assert.deepEqual([...registry.entries()], [["b", 2], ["a", 1]]);
    });

    it("is empty before anything is registered", () => {
      assert.lengthOf([...create().keys()], 0);
    });
  });

  describe("ready", () => {
    it("starts not ready and becomes ready", () => {
      const registry = create();
      assert.isFalse(registry.isReady);
      registry.ready();
      assert.isTrue(registry.isReady);
    });

    it("fires the hook with the registry", () => {
      const registry = create();
      const calls = [];
      Hooks.once(registry.hook, (...args) => calls.push(args));
      registry.register("k", 1);
      assert.isTrue(registry.ready());
      assert.lengthOf(calls, 1);
      assert.strictEqual(calls[0][0], registry);
      assert.isTrue(calls[0][0].has("k"), "listeners see everything registered before ready");
    });

    it("fires the hook once", () => {
      const registry = create();
      let count = 0;
      Hooks.on(registry.hook, () => count++);
      assert.isTrue(registry.ready());
      assert.isFalse(registry.ready());
      assert.strictEqual(count, 1);
    });

    it("still accepts a registration after ready", () => {
      const registry = create();
      registry.ready();
      registry.register("late", 1);
      assert.isTrue(registry.has("late"));
    });
  });
}
