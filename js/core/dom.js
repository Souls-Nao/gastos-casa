export function h(tag, props, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) element.addEventListener(key.slice(2), value);
    else if (key in element) element[key] = value;
    else element.setAttribute(key, value === true ? '' : value);
  }
  element.append(...children.flat().filter((child) => child != null && child !== false));
  return element;
}
