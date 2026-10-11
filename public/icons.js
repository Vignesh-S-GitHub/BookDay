/** Keep one document-local symbol library across every route render. */
let ready;

export function loadIcons() {
  return (ready ??= installIcons());
}

async function installIcons() {
  const response = await fetch("/art/icons.svg");
  if (!response.ok) throw Error("Icon library unavailable");
  // The shared .icon rule supplies presentation. Remove the external sprite's
  // legacy stylesheet before parsing so strict CSP never sees inline CSS.
  const markup = (await response.text()).replace(
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
    "",
  );
  const source = new DOMParser().parseFromString(markup, "image/svg+xml");
  if (source.querySelector("parsererror")) throw Error("Invalid icon library");
  const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  sprite.id = "bookday-icons";
  sprite.classList.add("icon-sprite");
  sprite.setAttribute("aria-hidden", "true");
  sprite.setAttribute("focusable", "false");
  for (const symbol of source.querySelectorAll("symbol")) {
    sprite.append(document.importNode(symbol, true));
  }
  document.body.prepend(sprite);
}
