// //////////////////////////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////////////////////////
// TabStrip helpers

/**
 * Resolve the index for a given active key against the ordered key list.
 * @param keys Ordered list of tab keys.
 * @param activeKey The key to locate.
 * @returns The zero-based index of `activeKey` in `keys`, or 0 if not found or `keys` is empty.
 */
export function resolveActiveIndex(keys: string[], activeKey: string): number {
    const idx = keys.indexOf(activeKey)
    return idx >= 0 ? idx : 0
}
