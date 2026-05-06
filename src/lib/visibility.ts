export function isTaskVisibleTo(args: {
  viewerId: number;
  ownerId: number;
  isPrivate: boolean;
}): boolean {
  if (args.viewerId === args.ownerId) return true;
  return !args.isPrivate;
}

export function scopeTasksWhere(viewerId: number, ownerId: number) {
  if (viewerId === ownerId) return { userId: ownerId };
  return { userId: ownerId, isPrivate: false };
}

export function scopeOccurrencesWhere(viewerId: number, allUserIds: number[]) {
  const others = allUserIds.filter((id) => id !== viewerId);
  return {
    OR: [
      { userId: viewerId },
      { userId: { in: others }, task: { isPrivate: false } },
    ],
  };
}
