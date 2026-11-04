/**
 * Egg quantity helpers.
 * All quantities are stored as a single integer (total eggs).
 * perCrate comes from GET /settings and is held in context.
 */

/** Convert crates + loose eggs → total egg count */
export const toEggs = (crates: number, eggs: number, perCrate: number): number =>
  crates * perCrate + eggs

/** Convert a total egg count → { crates, eggs } */
export const fromEggs = (
  total: number,
  perCrate: number,
): { crates: number; eggs: number } => ({
  crates: Math.floor(total / perCrate),
  eggs: total % perCrate,
})

/** Human-readable string e.g. "3 crates + 5 eggs" */
export const formatEggs = (total: number, perCrate: number): string => {
  const { crates, eggs } = fromEggs(total, perCrate)
  const crateLabel = crates === 1 ? 'crate' : 'crates'
  const eggLabel = eggs === 1 ? 'egg' : 'eggs'
  return `${crates} ${crateLabel} + ${eggs} ${eggLabel}`
}

