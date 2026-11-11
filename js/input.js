'use strict';

// Teclado: "down" = tecla mantenida; "pressed" = pulsada en este frame.
const Input = {
  down: new Set(),
  pressed: new Set(),

  init() {
    const block = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
    addEventListener('keydown', (e) => {
      if (block.includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
      Sfx.unlock();
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
  },

  isDown(code) { return this.down.has(code); },
  wasPressed(code) { return this.pressed.has(code); },
  endFrame() { this.pressed.clear(); },
};
