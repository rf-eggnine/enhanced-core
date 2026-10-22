/**
 * Writes to Foundry's registries that stay silent: things Foundry, the game system and this module do to their own
 * tables on purpose. Each entry is `{ path, owner }`; `*` in either stands for any run of characters (`owner: "*"` is
 * anyone). It grows from the learning log (the `watchLog` setting), so nothing is listed that was not seen. Name the
 * writer: an owner of `*` would hide the same write from a module that should be noticed.
 * @type {{ path: string, owner: string }[]}
 */
export default [
  // The mixin registry replaces a class Foundry or the game system set (a document class, a data model, an object or
  // layer class) with the class made from the mixins registered for it. Which paths depends on the mixins, so any
  // path is listed
  { path: "CONFIG.*", owner: "aaaadvanced-core" },
  // The tests module changes CONFIG on purpose (the compatibility mode, the random source, the status effects) and
  // puts it back after each test. It is a developer tool, so all of its writes are listed
  { path: "CONFIG.*", owner: "advanced-tests" }
];
