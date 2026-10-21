// N4 Pro не сообщает длительность удержания: есть только dialDown.
// Один и два щелчка подтверждаются тишиной — старт и пауза.
// Три щелчка в окне — сброс, четыре — таймер или секундомер.
// Сброс ждёт тишины, чтобы четвёртый щелчок успел переключить режим.
// Дальнейшие щелчки той же серии режим повторно не переключают.

function createGesture({ confirmMs, windowMs, onToggle, onReset, onMode, setTimer, clearTimer }) {
  const slots = new Map();

  function hold(slot, id) {
    slot.timer = setTimer(() => slots.delete(id), confirmMs);
  }

  return {
    press(id, now = Date.now()) {
      let slot = slots.get(id);
      if (slot?.done) {
        clearTimer(slot.timer);
        hold(slot, id);
        return;
      }
      if (!slot || now - slot.start > windowMs) {
        if (slot) clearTimer(slot.timer);
        slot = { start: now, count: 0, timer: null, done: false };
        slots.set(id, slot);
      }

      slot.count += 1;
      clearTimer(slot.timer);
      slot.timer = null;

      if (slot.count >= 4) {
        slot.done = true;
        hold(slot, id);
        onMode(id);
        return;
      }

      const count = slot.count;
      slot.timer = setTimer(() => {
        slots.delete(id);
        if (count >= 3) onReset(id);
        else onToggle(id);
      }, confirmMs);
    }
  };
}

module.exports = { createGesture };
