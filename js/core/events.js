const bus = new EventTarget();

export function on(name, handler) {
  const listener = (event) => handler(event.detail);
  bus.addEventListener(name, listener);
  return () => bus.removeEventListener(name, listener);
}

export function emit(name, detail) {
  bus.dispatchEvent(new CustomEvent(name, { detail }));
}
