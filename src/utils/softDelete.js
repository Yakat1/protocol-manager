// Shared soft-delete helper. Marks an item with a deletion timestamp/actor
// instead of removing it (keeps audit trails and sync-safe tombstones).
export const softDelete = (list = [], id, user) =>
  list.map(item => item.id === id
    ? { ...item, deletedAt: new Date().toISOString(), deletedBy: user?.email || 'system' }
    : item);
