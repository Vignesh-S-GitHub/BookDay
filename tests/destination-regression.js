async function destinationRegression(page) {
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 320, height: 844 } });
  const p = await context.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const base = new URL(page.url()).origin;
  try {
    await p.goto(base + "/#/insights");
    await p.waitForFunction(() => !!document.querySelector("#insights-form"));
    if ((await p.locator("[name=state]").inputValue()) !== "Tamil Nadu")
      throw Error("Default destination");
    const states = await p.locator("[name=state] option").allTextContents(),
      sources = new Set();
    for (const state of states) {
      await p.locator("[name=state]").selectOption(state);
      await p.waitForFunction(() => {
        const image = document.querySelector(".bd-hero img");
        return image.complete && image.naturalWidth > 0;
      });
      const src = await p.locator(".bd-hero img").getAttribute("src");
      sources.add(src);
      if (!(await p.locator(".destination-name").innerText()).includes(state))
        throw Error("Destination label " + state);
      if (
        !(await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ))
      )
        throw Error("Destination overflow " + state);
    }
    if (sources.size !== 36) throw Error("Unique state artwork");
    await p.goto(base + "/#/calendar");
    await p.locator("#month-select").selectOption("1");
    await p.locator("#year-select").selectOption("2026");
    await p.locator('[data-day="2026-01-15"]').click();
    if (!(await p.locator(".detail-list").innerText()).includes("Pongal"))
      throw Error("Pongal date");
    await p.locator("#month-select").selectOption("11");
    await p.locator('[data-day="2026-11-08"]').click();
    if (!(await p.locator(".detail-list").innerText()).includes("Deepavali"))
      throw Error("Deepavali date");
    if (errors.length) throw Error(errors.join("\n"));
    return "PASS: Tamil Nadu default; 36 unique loaded state/UT banners and labels; 320px layouts; official Pongal/Deepavali dates; zero browser errors.";
  } finally {
    await context.close();
  }
}
