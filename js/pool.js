// pool.js — generic object pool. Reuse objects instead of `new` in the hot loop.

export class Pool {
  constructor(factory) {
    this.factory = factory;
    this.free = [];
  }
  get() {
    return this.free.length ? this.free.pop() : this.factory();
  }
  release(obj) {
    this.free.push(obj);
  }
  // Swap-remove from `arr` at index i and return the object to the pool.
  // Returns true so callers can keep the loop index unchanged.
  reclaim(arr, i) {
    const obj = arr[i];
    const last = arr.length - 1;
    arr[i] = arr[last];
    arr.pop();
    this.free.push(obj);
    return true;
  }
}

// Swap-remove without pooling (for plain arrays)
export function swapRemove(arr, i) {
  arr[i] = arr[arr.length - 1];
  arr.pop();
}
