import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const imageDir = fileURLToPath(new URL('../public/landing-assets/', import.meta.url));
const executablePath =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const maxDimension = Number(process.env.WEBP_MAX_DIMENSION ?? 1600);
const quality = Number(process.env.WEBP_QUALITY ?? 0.82);

const files = (await readdir(imageDir))
  .filter((file) => ['.jpg', '.jpeg'].includes(extname(file).toLowerCase()))
  .sort();

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage();
let sourceBytes = 0;
let outputBytes = 0;

try {
  for (const file of files) {
    const sourcePath = join(imageDir, file);
    const source = await readFile(sourcePath);
    sourceBytes += source.byteLength;

    const encoded = await page.evaluate(
      async ({ dataUrl, maxSize, webpQuality }) => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();

        const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas 2D context is unavailable.');
        context.drawImage(image, 0, 0, width, height);

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (result) => result ? resolve(result) : reject(new Error('WebP encoding failed.')),
            'image/webp',
            webpQuality
          );
        });
        const outputDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error ?? new Error('WebP read failed.'));
          reader.readAsDataURL(blob);
        });
        return {
          base64: String(outputDataUrl).split(',')[1],
          width,
          height,
        };
      },
      {
        dataUrl: `data:image/jpeg;base64,${source.toString('base64')}`,
        maxSize: maxDimension,
        webpQuality: quality,
      }
    );

    const output = Buffer.from(encoded.base64, 'base64');
    const outputPath = join(imageDir, `${basename(file, extname(file))}.webp`);
    await writeFile(outputPath, output);
    outputBytes += output.byteLength;
    console.log(`${file} -> ${basename(outputPath)} (${encoded.width}x${encoded.height})`);
  }
} finally {
  await browser.close();
}

const savedPercent = sourceBytes ? Math.round((1 - outputBytes / sourceBytes) * 100) : 0;
console.log(`Optimized ${files.length} images: ${sourceBytes} -> ${outputBytes} bytes (${savedPercent}% smaller).`);
