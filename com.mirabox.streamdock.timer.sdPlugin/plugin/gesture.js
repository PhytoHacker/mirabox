// N4 Pro не сообщает длительность удержания: есть только dialDown.
// Один щелчок подтверждается тишиной. Три события в коротком окне — сброс,
// без старта и паузы по дороге.

function createGesture({ confirmMs, windowMs, onToggle, onReset, setTimer, clearTimer }) {
  const slots = new Map();

  return {
    press(id, now = Date.now()) {
      let slot = slots.get(id);
      if (!slot || now - slot.start > windowMs) {
        if (slot) clearTimer(slot.timer);
        slot = { start: now, count: 0, timer: null, done: false };
        slots.set(id, slot);
      }
      if (slot.done) return;

      slot.count += 1;
      clearTimer(slot.timer);
      slot.timer = null;

      if (slot.count >= 3) {
        slot.done = true;
        onReset(id);
        return;
      }

      slot.timer = setTimer(() => {
        slots.delete(id);
        onToggle(id);
      }, confirmMs);
    }
  };
}

module.exports = { createGesture };
