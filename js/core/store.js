import { emit, on } from './events.js';

const state = { user: null, month: null };

export function getState() {
  return state;
}

export function setState(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (state[key] === value) continue;
    state[key] = value;
    emit(`state:${key}`, value);
  }
}

export function watch(key, handler) {
  return on(`state:${key}`, handler);
}
