function isOpen(task) {
  return !!task && task.deleted !== true && task.hidden !== true && task.status !== 'completed';
}

function countOpen(tasks) {
  if (!Array.isArray(tasks)) return 0;
  return tasks.filter(isOpen).length;
}

function selectedCount(snapshot, listId) {
  if (!snapshot || snapshot.total == null) return null;
  if (!listId) return snapshot.total;
  if (!snapshot.counts || !Object.prototype.hasOwnProperty.call(snapshot.counts, listId)) return null;
  return snapshot.counts[listId];
}

module.exports = { isOpen, countOpen, selectedCount };
