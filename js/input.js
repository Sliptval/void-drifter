// input.js — normalized keyboard/mouse input.

export const Input = {
  keys: new Set(),
  mouseX: 0, mouseY: 0,
  mouseDown: false,
  // edge-triggered actions consumed once per press
  pressed: new Set(),
  _onPress: [],

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = norm(e);
      if (k) {
        this.keys.add(k);
        this.pressed.add(k);
        for (const cb of this._onPress) cb(k);
        if (PREVENT.has(k)) e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = norm(e);
      if (k) this.keys.delete(k);
    });
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', () => { this.mouseDown = true; });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    this._canvas = canvas;
  },

  onPress(cb) { this._onPress.push(cb); },

  // movement vector, normalized (8-way). Returns {x,y}
  moveVec(out) {
    let x = 0, y = 0;
    if (this.keys.has('left')) x -= 1;
    if (this.keys.has('right')) x += 1;
    if (this.keys.has('up')) y -= 1;
    if (this.keys.has('down')) y += 1;
    if (x && y) { const inv = 0.70710678; x *= inv; y *= inv; }
    out.x = x; out.y = y;
    return out;
  },

  consumePress(k) {
    if (this.pressed.has(k)) { this.pressed.delete(k); return true; }
    return false;
  },
  endFrame() { this.pressed.clear(); },
};

const PREVENT = new Set(['up', 'down', 'left', 'right', 'dash', 'pause']);

function norm(e) {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': return 'up';
    case 'KeyS': case 'ArrowDown': return 'down';
    case 'KeyA': case 'ArrowLeft': return 'left';
    case 'KeyD': case 'ArrowRight': return 'right';
    case 'Space': return 'dash';
    case 'Escape': case 'KeyP': return 'pause';
    case 'KeyM': return 'mute';
    case 'KeyR': return 'reroll';
    case 'Enter': return 'enter';
    case 'Digit1': case 'Numpad1': return '1';
    case 'Digit2': case 'Numpad2': return '2';
    case 'Digit3': case 'Numpad3': return '3';
    case 'F3': return 'fps';
  }
  return null;
}
