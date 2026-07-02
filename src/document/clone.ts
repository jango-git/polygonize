// Deep clone with structuredClone where available, falling back to JSON round-trip on
// older runtimes. Used to hand out detached copies of document source (selectors, history
// snapshots) so callers cannot mutate the live store.
export const clone = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
