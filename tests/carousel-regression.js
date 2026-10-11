async function carouselRegression(page) {
  const browser = page.context().browser(),
    base = new URL(page.url()).origin;
  const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    p = await ctx.newPage();
  try {
    await p.goto(base + "/#/home");
    await p.waitForFunction(() => document.querySelector(".hero-carousel"));
    await p.mouse.move(0, 0);
    await p.waitForFunction(
      () => document.querySelector(".hero-carousel").dataset.slide !== "0",
      null,
      { timeout: 12000 },
    );
    await p.getByRole("button", { name: "Pause scenery carousel" }).click();
    await p.mouse.move(0, 0);
    const stopped = await p
      .locator(".hero-carousel")
      .getAttribute("data-slide");
    await p.waitForTimeout(6500);
    if (
      (await p.locator(".hero-carousel").getAttribute("data-slide")) !== stopped
    )
      throw Error("Pause");
    await p.mouse.move(300, 120);
    await p.mouse.down();
    await p.mouse.move(110, 120);
    await p.mouse.up();
    if (
      (await p.locator(".hero-carousel").getAttribute("data-slide")) === stopped
    )
      throw Error("Swipe");
  } finally {
    await ctx.close();
  }
  const reduced = await browser.newContext({ reducedMotion: "reduce" }),
    r = await reduced.newPage();
  try {
    await r.goto(base + "/#/home");
    await r.getByRole("button", { name: "Play scenery carousel" }).waitFor();
  } finally {
    await reduced.close();
  }
  return "PASS: automatic scenic rotation, pause, swipe, reduced-motion pause default.";
}
