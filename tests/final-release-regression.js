async function finalReleaseRegression(page) {
  const base = new URL(page.url()).origin;
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
  await context.addInitScript(() => {
    const RealDate = Date;
    window.bookdayTestNow = "2026-10-11T12:00:00Z";
    window.Date = class extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [window.bookdayTestNow]));
      }
      static now() {
        return new RealDate(window.bookdayTestNow).getTime();
      }
    };
  });
  const p = await context.newPage();
  const errors = [];
  const iconRequests = [];
  p.on("pageerror", (error) => errors.push(error.message));
  p.on("console", (event) => {
    if (event.type() === "error") errors.push(event.text());
  });
  p.on("request", (request) => {
    if (new URL(request.url()).pathname === "/art/icons.svg")
      iconRequests.push(request.url());
  });
  const check = (value, message) => {
    if (!value) throw Error(message);
  };
  const goto = async (route) => {
    await p.evaluate((value) => (location.hash = "#/" + value), route);
    await p.waitForFunction(
      (value) => document.body.dataset.route === value.split("/")[0],
      route,
    );
    if (route.startsWith("book/"))
      await p.waitForFunction(
        (category) =>
          document.querySelector('[name="category"]')?.value === category,
        route.split("/")[1],
      );
    check(
      await p.evaluate(() => {
        const uses = [...document.querySelectorAll("use")];
        return (
          document.querySelectorAll("#bookday-icons").length === 1 &&
          uses.every((use) => {
            const href = use.getAttribute("href");
            const visible =
              use.closest("svg").getBoundingClientRect().width > 0;
            return (
              href.startsWith("#") &&
              document.querySelector("#bookday-icons " + href) &&
              (!visible || use.getBBox().width > 0)
            );
          })
        );
      }),
      "Local, immediately visible icons missing on " + route,
    );
  };
  try {
    await p.goto(base + "/#/explore");
    await p.waitForSelector(".category-grid .category");
    const categories = await p
      .locator(".category-grid .category")
      .evaluateAll((items) => items.map((item) => item.hash.split("/").at(-1)));
    check(categories.length === 14, "Expected 14 reminder categories");
    for (const [instant, expected] of [
      ["2026-10-11T12:00:00Z", "2026-10-11"],
      ["2026-10-11T18:29:59Z", "2026-10-11"],
      ["2026-10-11T18:30:00Z", "2026-10-12"],
      ["2026-10-12T12:00:00Z", "2026-10-12"],
    ]) {
      await p.evaluate((value) => (window.bookdayTestNow = value), instant);
      for (const category of categories) {
        await goto("book/" + category);
        check(
          (await p.locator('[name="event_date"]').inputValue()) === expected,
          category + " must default to today in India: " + expected,
        );
      }
    }
    await p.locator('[name="event_date"]').fill("2027-03-15");
    await p.locator(".find-date").click();
    await p.waitForURL("**/#/result");
    await p.locator('[data-action="save"]').click();
    await p.locator('[data-action="edit"]').click();
    await p.waitForSelector('[name="event_date"]');
    check(
      (await p.locator('[name="event_date"]').inputValue()) === "2027-03-15",
      "Editing a saved reminder must preserve its chosen date",
    );
    for (const route of [
      "home",
      "calendar",
      "saved",
      "more",
      "explore",
      "insights",
    ]) {
      await goto(route);
    }
    await p.locator('[name="date"]').fill("2027-04-20");
    await p
      .getByRole("button", { name: "Track This Trip", exact: true })
      .click();
    await p.waitForSelector('[name="event_date"]');
    check(
      (await p.locator('[name="event_date"]').inputValue()) === "2027-04-20",
      "Explicit trip date must transfer to the hotel reminder",
    );
    await goto("explore");
    await p.screenshot({ path: "output/playwright/final-local-icons.png" });
    check(iconRequests.length === 1, "Icon library must load exactly once");
    check(errors.length === 0, "Browser errors: " + errors.join("; "));
    return "PASS: icons load once and remain immediately visible across every tab and all 14 forms; today defaults on two dates and at the India midnight boundary; saved/edit and explicit trip dates preserved; zero browser errors.";
  } finally {
    await context.close();
  }
}
