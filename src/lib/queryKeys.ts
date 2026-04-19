export function ticketsKey(
  projectName: string,
  typesCsv?: string | null,
): readonly ['tickets', string, string] {
  return ['tickets', projectName, typesCsv ?? 'all'] as const;
}

export function ticketsInvalidationPredicate(
  projectName: string,
): (q: { queryKey: readonly unknown[] }) => boolean {
  return (q) =>
    Array.isArray(q.queryKey) &&
    q.queryKey[0] === 'tickets' &&
    q.queryKey[1] === projectName;
}
