async function reminderBannersRegression(page) {
  const base = new URL(page.url()).origin;
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const check = (value, message) => {
    if (!value) throw Error(message);
  };
  try {
    // Use this build's annual snapshot while verifying new source/region rules.
    await p.route("https://raw.githubusercontent.com/**", (route) =>
      route.abort(),
    );
    await p.goto(base + "/#/explore");
    await p.waitForSelector(".category");
    const ids = await p.evaluate(async () =>
      (await (await fetch("/data/catalog.json")).json()).categories.map(
        (c) => c.id,
      ),
    );
    for (const width of [390, 1280]) {
      await p.setViewportSize({ width, height: 900 });
      for (const id of ids) {
        await p.evaluate((id) => {
          location.hash = "#/book/" + id;
        }, id);
        await p.waitForFunction(
          (id) =>
            document.querySelector("#booking-form [name=category]")?.value ===
            id,
          id,
        );
        const image = p.locator(".bd-hero > img");
        await image.evaluate((img) => img.decode());
        const info = await p.evaluate(() => {
          const hero = document.querySelector(".bd-hero"),
            image = hero.querySelector("img");
          const b = hero.getBoundingClientRect(),
            title = hero.querySelector("h1").getBoundingClientRect(),
            sub = hero.querySelector("p").getBoundingClientRect();
          return {
            src: image.getAttribute("src"),
            ratio: image.naturalWidth / image.naturalHeight,
            inside:
              title.left >= b.left &&
              title.right <= b.right + 1 &&
              sub.bottom <= b.bottom + 1 &&
              title.bottom <= sub.top + 1,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            date: document.querySelector("[name=event_date]").value,
            time: document.querySelector("[name=reminder_time]").required,
            today: new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Kolkata",
            }).format(new Date()),
          };
        });
        check(
          info.src ===
            `/art/banners/${id === "trains" ? "train_journey" : "reminder_" + id}.webp`,
          `${id} lacks its dedicated banner`,
        );
        check(
          info.ratio > (id === "trains" ? 1.5 : 2),
          `${id} is a cropped square category image`,
        );
        check(
          info.inside && !info.overflow,
          `${id} text overlaps or overflows at ${width}`,
        );
        check(
          info.date === info.today && info.time,
          `${id} date/time defaults changed`,
        );
        if (id === "flights" && width === 390)
          await p.screenshot({
            path: "output/playwright/reminder-flights-390.png",
          });
        if (id === "education" && width === 390)
          await p.screenshot({
            path: "output/playwright/reminder-education-390.png",
          });
      }
    }
    await p.evaluate(() => {
      location.hash = "#/calendar";
    });
    await p.waitForSelector("#year-select");
    const years = await p
      .locator("#year-select")
      .evaluate((select) => [...select.options].map((o) => Number(o.value)));
    const current = Number(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })
        .format(new Date())
        .slice(0, 4),
    );
    check(
      years[0] === current &&
        years[1] === current - 1 &&
        years[current - 1900] === 1900 &&
        years.includes(2100),
      "Year choices must start with current year, descend through history and retain future years",
    );
    await p
      .locator("#year-select")
      .locator("..")
      .locator(".select-trigger")
      .click();
    check(
      (await p
        .locator(".control-options [role=option]")
        .first()
        .textContent()) === String(current),
      "Themed chooser is not current-year-first",
    );
    await p.getByRole("button", { name: "Close choices", exact: true }).click();
    await p.selectOption("#year-select", "2030");
    await p.locator("#calendar-today").click();
    check(
      (await p.locator("#year-select").inputValue()) === String(current),
      "Today failed after future-year selection",
    );
    check(!errors.length, errors.join("; "));
    return `PASS: 14 dedicated banners at mobile/desktop sizes, current reminder dates, required time and descending current-first year chooser`;
  } finally {
    await context.close();
  }
}
