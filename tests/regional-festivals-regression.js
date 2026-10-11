async function regionalFestivalsRegression(page) {
  const base = new URL(page.url()).origin;
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
    });
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const check = (condition, message) => {
    if (!condition) throw Error(message);
  };
  try {
    await p.goto(base + "/#/calendar");
    await p.waitForSelector("#year-select");
    await p.selectOption("#year-select", "2026");
    await p.selectOption("#month-select", "10");
    await p.locator('[data-day="2026-10-19"]').click();
    check(
      (await p.locator(".detail-list").innerText()).includes("Ayutha Pooja"),
      "Tamil Nadu Ayutha Pooja missing",
    );
    check(
      !(await p.locator("#main").innerText()).includes("Durga Puja"),
      "Unrelated Durga Puja leaked into Tamil Nadu",
    );
    check(
      (await p
        .locator('[data-day="2026-10-19"] use[href$="#festival-lamp"]')
        .count()) === 1,
      "Hindu lamp missing",
    );
    for (const [month, day, symbol] of [
      ["12", "2026-12-25", "festival-cross"],
      ["3", "2026-03-21", "festival-crescent"],
      ["3", "2026-03-31", "festival-ahimsa"],
      ["1", "2026-01-26", "national-holiday"],
    ]) {
      await p.selectOption("#month-select", month);
      await p.waitForSelector(`[data-day="${day}"] use[href$="#${symbol}"]`);
    }
    await p.goto(base + "/#/insights");
    await p.waitForSelector('[name="date"]');
    const dateLabel = p
      .locator(".insights-filters label")
      .filter({ has: p.locator('[name="date"]') });
    check(
      (await dateLabel.locator('use[href$="#calendar"]').count()) === 1,
      "Travel Date has duplicate calendar icons",
    );
    check(
      (await dateLabel
        .locator('.picker-trigger use[href$="#chevron"]')
        .count()) === 1,
      "Date selector chevron missing",
    );
    await dateLabel.locator(".leading-picker-trigger").click();
    await p.waitForSelector(".date-time-dialog[open]");
    await p.getByRole("button", { name: "Close picker" }).click();
    await dateLabel.locator(".picker-trigger").click();
    await p.waitForSelector(".date-time-dialog[open]");
    await p.getByRole("button", { name: "Close picker" }).click();
    await p.fill('[name="date"]', "2026-10-19");
    await p.locator('#insights-form button[type="submit"]').click();
    await p.waitForFunction(() =>
      document
        .querySelector("#insights-result")
        .textContent.includes("Ayutha Pooja"),
    );
    check(
      !(await p.locator("#insights-result").innerText()).includes("Durga Puja"),
      "Travel Insights leaked unrelated festivals",
    );
    await p.evaluate(() => {
      for (const image of document.images) image.loading = "eager";
    });
    await p.waitForFunction(() =>
      [...document.images].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
    for (const width of [320, 390, 1280]) {
      await p.setViewportSize({ width, height: 844 });
      check(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Travel Date overflow at " + width,
      );
      await p.screenshot({
        path: `output/playwright/regional-date-${width}.png`,
        fullPage: true,
      });
    }
    check(errors.length === 0, errors.join("\n"));
    return "PASS: selected-state festival names; Hindu/Christian/Muslim/Jain/national day symbols; one Travel Date calendar icon; functional leading icon and chevron; themed mobile/desktop date input; no unrelated travel festivals or page errors.";
  } finally {
    await context.close();
  }
}
