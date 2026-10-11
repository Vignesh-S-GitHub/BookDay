// Keep decoded image nodes alive across screen changes, avoiding visible re-decodes.
const pool = new Map();
export function preserveImages(root) {
  for (const image of root.querySelectorAll("img")) {
    const key = image.getAttribute("src");
    if (!pool.has(key)) pool.set(key, []);
    const list = pool.get(key);
    if (!list.includes(image) && list.length < 6) list.push(image);
  }
}
export function restoreImages(root) {
  const used = new Set();
  for (const fresh of root.querySelectorAll("img")) {
    const list = pool.get(fresh.getAttribute("src"));
    const cached = list?.find(
      (image) =>
        !image.isConnected &&
        !used.has(image) &&
        image.getAttribute("src") === fresh.getAttribute("src"),
    );
    if (!cached) continue;
    used.add(cached);
    for (const attr of [...cached.attributes])
      if (attr.name !== "src") cached.removeAttribute(attr.name);
    for (const attr of fresh.attributes)
      if (attr.name !== "src") cached.setAttribute(attr.name, attr.value);
    fresh.replaceWith(cached);
  }
}
