import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const NAVY = "#1b2a4e";
const CREAM = "#faf5ea";

function svgIcon({ size, mask = false }) {
  // Padding so logo doesn't touch edges. For maskable, use safe zone (80% inner).
  const safeRatio = mask ? 0.62 : 0.78;
  const fontSize = Math.round(size * 0.42);
  const dotSize = Math.round(size * 0.07);
  const dotX = size * (0.5 + safeRatio * 0.42);
  const dotY = size * (0.5 + safeRatio * 0.04);
  const textY = size * 0.5 + fontSize * 0.35;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${CREAM}"/>
  <text x="${size / 2}" y="${textY}"
        font-family="Helvetica, Arial, sans-serif"
        font-weight="800"
        font-size="${fontSize}"
        text-anchor="middle"
        fill="${NAVY}"
        letter-spacing="-0.04em">OTTO</text>
  <circle cx="${dotX}" cy="${dotY}" r="${dotSize}" fill="${NAVY}"/>
</svg>`;
}

async function makePng(size, outName, mask = false) {
  const svg = svgIcon({ size, mask });
  const out = join("public", outName);
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log(`✓ ${outName} (${size}x${size})`);
}

await mkdir("public", { recursive: true });

await makePng(192, "icon-192.png");
await makePng(512, "icon-512.png");
await makePng(512, "icon-maskable-512.png", true);
await makePng(180, "apple-icon.png");
await makePng(32, "favicon-32.png");
