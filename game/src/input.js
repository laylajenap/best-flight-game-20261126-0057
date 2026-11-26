// Ember Valley — Sky Courier: keyboard and mouse.
// Arrows / WASD fly the plane, W/S work the throttle, the mouse banks the
// wings and the wheel works the throttle. Keys 1-3 pick a mission, Enter
// starts, R restarts, P pauses, M mutes, C swaps chase / cockpit camera.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0; // -1..1 across the canvas
    this.mouseActive = false;
    this.mouseDown = false;
    this.wheelDelta = 0;
    this.pressed = new Set(); // keys pressed since last consume()
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseActive = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseActive = true;
    });
    canvas.addEventListener('mousedown', () => {
      this.mouseDown = true;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheelDelta += e.deltaY;
    }, { passive: false });
    canvas.addEventListener('mouseleave', () => {
      this.mouseActive = false;
    });
  }

  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  // Per-frame flight command: pitch -1..1 (up positive), roll -1..1 (right
  // positive), throttle -1..1 (up positive). Keyboard wins; the mouse banks
  // when no arrow key is held.
  flightCommand() {
    let pitch = 0;
    let roll = 0;
    let throttle = 0;
    // Arrows pitch and bank; A/D bank too; W/S and Shift/Ctrl work the
    // throttle; the mouse banks when no arrow key is held; the wheel works
    // the throttle as well.
    if (this.keys.has('ArrowUp')) pitch += 1;
    if (this.keys.has('ArrowDown')) pitch -= 1;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) roll -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) roll += 1;
    if (this.keys.has('KeyW') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) throttle += 1;
    if (this.keys.has('KeyS') || this.keys.has('ControlLeft') || this.keys.has('ControlRight')) throttle -= 1;
    if (this.mouseActive && roll === 0) roll = Math.max(-1, Math.min(1, this.mouseX * 1.4));
    if (this.wheelDelta !== 0) {
      throttle += this.wheelDelta > 0 ? -0.9 : 0.9;
      this.wheelDelta = 0;
    }
    return { pitch, roll, throttle };
  }
}
