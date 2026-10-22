/**
 * Writes to Foundry's registries that stay silent: things Foundry and the game system do to their own tables during
 * setup. Each entry is `{ path, owner }`; either may end in `*` to match a prefix (`owner: "*"` is anyone). It starts
 * empty and grows from the learning log (the `watchLog` setting), so nothing is listed that was not seen.
 * @type {{ path: string, owner: string }[]}
 */
export default [];
