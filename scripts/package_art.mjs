import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Packaging only: preserve generated content; resize and encode for delivery.
const manifest = JSON.parse(await readFile(process.argv[2], "utf8"));
const publicDir = resolve("public");
const previous = JSON.parse(
  await readFile(resolve("docs/artwork.json"), "utf8"),
);
const report = previous.filter(
  (item) => !manifest.some((asset) => asset.name === item.name),
);
for (const item of manifest) {
  const folder =
    item.type === "category"
      ? "categories/"
      : item.type === "banner"
        ? "banners/"
        : "";
  const output = `art/${folder}${item.name}.webp`;
  await mkdir(resolve(publicDir, `art/${folder}`), { recursive: true });
  const image = sharp(item.path).autoOrient();
  if (item.name === "logo") image.trim();
  const width =
    item.type === "category" ? 512 : item.name === "logo" ? 1000 : 1280;
  await image
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(resolve(publicDir, output));
  const metadata = await sharp(resolve(publicDir, output)).metadata();
  report.push({
    name: item.name,
    path: `/` + output,
    width: metadata.width,
    height: metadata.height,
    prompt: item.prompt,
    generatedBy: "Built-in image_gen",
    source:
      "New artwork based on user screenshot references; no original design-kit asset reused",
  });
}
await sharp(resolve(publicDir, "art/categories/appointments.webp"))
  .resize(192, 192)
  .png()
  .toFile(resolve(publicDir, "art/app_icon_192.png"));
await sharp(resolve(publicDir, "art/categories/appointments.webp"))
  .resize(512, 512)
  .png()
  .toFile(resolve(publicDir, "art/app_icon_512.png"));
await writeFile(
  resolve("docs/artwork.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `Packaged ${report.length} new image assets and two install icons.`,
);
