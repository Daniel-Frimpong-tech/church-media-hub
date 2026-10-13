// Takes screenshots of the local preview pages at phone and desktop sizes.
// Usage: node tests/tools/screenshot.mjs <base-url> <out-dir> <screen> [<screen>…]
import { chromium, devices } from "@playwright/test";

const [baseUrl, outDir, ...screens] = process.argv.slice(2);
const browser = await chromium.launch();

const sizes = {
  phone: { ...devices["Pixel 7"] },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

for (const [size, options] of Object.entries(sizes)) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  for (const screen of screens) {
    await page.goto(`${baseUrl}/preview/${screen}`, { waitUntil: "networkidle" });
    // Let entrance animations and count-ups finish.
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${outDir}/${screen}-${size}.png`, fullPage: true });
    if (size === "phone") {
      await page.screenshot({ path: `${outDir}/${screen}-phone-screen.png` });
    }
    console.log(`${screen} ${size}`);
  }
  await context.close();
}
await browser.close();
