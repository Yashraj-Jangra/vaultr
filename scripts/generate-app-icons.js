const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 1. Generate Adaptive Foreground SVG (transparent background with scaled, centered logo in standard Android 66dp safe zone)
function getAdaptiveSvg(scale = 0.44) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" fill="none" shape-rendering="geometricPrecision">
  <defs>
    <mask id="shield">
      <rect width="1000" height="1000" fill="#000"/>
      <g transform="translate(500, 500) scale(${scale}) translate(-500, -500)">
        <path fill="#fff" d="M 61 148 L 500.5 976.6 L 779.8 589.8 L 779.8 351.1 L 725.1 310.5 L 291.5 311 L 394 462.9 L 339.8 447.3 L 539.6 782.7 L 507.3 827.6 L 275.4 403.3 L 326.2 419.4 Z"/>
        <path fill="#000" d="M 500 433 C 472 433 449 456 449 484 C 449 504 460 521 477 530 L 469 604 L 531 604 L 523 530 C 540 521 551 504 551 484 C 551 456 528 433 500 433 Z"/>
      </g>
    </mask>
  </defs>
  <rect width="1000" height="1000" fill="#ffffff" mask="url(#shield)"/>
  <g transform="translate(500, 500) scale(${scale}) translate(-500, -500)">
    <path fill="#ffffff" d="M 305 285 L 305 78 L 360 21 L 640 21 L 700 78 L 700 285 L 625 285 L 625 106 L 605 88 L 395 88 L 380 106 L 380 285 Z"/>
  </g>
</svg>`;
}

// 2. Generate In-App Transparent SVG (tightly framed for in-app UI display like UnlockScreen)
function getInAppTransparentSvg(scale = 0.88) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" fill="none" shape-rendering="geometricPrecision">
  <defs>
    <mask id="shield-inapp">
      <rect width="1000" height="1000" fill="#000"/>
      <g transform="translate(500, 500) scale(${scale}) translate(-500, -500)">
        <path fill="#fff" d="M 61 148 L 500.5 976.6 L 779.8 589.8 L 779.8 351.1 L 725.1 310.5 L 291.5 311 L 394 462.9 L 339.8 447.3 L 539.6 782.7 L 507.3 827.6 L 275.4 403.3 L 326.2 419.4 Z"/>
        <path fill="#000" d="M 500 433 C 472 433 449 456 449 484 C 449 504 460 521 477 530 L 469 604 L 531 604 L 523 530 C 540 521 551 504 551 484 C 551 456 528 433 500 433 Z"/>
      </g>
    </mask>
  </defs>
  <rect width="1000" height="1000" fill="#ffffff" mask="url(#shield-inapp)"/>
  <g transform="translate(500, 500) scale(${scale}) translate(-500, -500)">
    <path fill="#ffffff" d="M 305 285 L 305 78 L 360 21 L 640 21 L 700 78 L 700 285 L 625 285 L 625 106 L 605 88 L 395 88 L 380 106 L 380 285 Z"/>
  </g>
</svg>`;
}

// 3. Generate Solid App Icon SVG (with #09090b background and standard app store / iOS safe zone)
function getSolidSvg(scale = 0.58) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" fill="none" shape-rendering="geometricPrecision">
  <rect width="1000" height="1000" fill="#09090b"/>
  <g transform="translate(500, 500) scale(${scale}) translate(-500, -500)">
    <path fill="#ffffff" d="M 61 148 L 500.5 976.6 L 779.8 589.8 L 779.8 351.1 L 725.1 310.5 L 291.5 311 L 394 462.9 L 339.8 447.3 L 539.6 782.7 L 507.3 827.6 L 275.4 403.3 L 326.2 419.4 Z"/>
    <path fill="#09090b" d="M 500 433 C 472 433 449 456 449 484 C 449 504 460 521 477 530 L 469 604 L 531 604 L 523 530 C 540 521 551 504 551 484 C 551 456 528 433 500 433 Z"/>
    <path fill="#ffffff" d="M 305 285 L 305 78 L 360 21 L 640 21 L 700 78 L 700 285 L 625 285 L 625 106 L 605 88 L 395 88 L 380 106 L 380 285 Z"/>
  </g>
</svg>`;
}

// 4. Generate Round App Icon SVG (with circular mask for ic_launcher_round)
function getRoundSvg(scale = 0.54) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" fill="none" shape-rendering="geometricPrecision">
  <circle cx="500" cy="500" r="500" fill="#09090b"/>
  <g transform="translate(500, 500) scale(${scale}) translate(-500, -500)">
    <path fill="#ffffff" d="M 61 148 L 500.5 976.6 L 779.8 589.8 L 779.8 351.1 L 725.1 310.5 L 291.5 311 L 394 462.9 L 339.8 447.3 L 539.6 782.7 L 507.3 827.6 L 275.4 403.3 L 326.2 419.4 Z"/>
    <path fill="#09090b" d="M 500 433 C 472 433 449 456 449 484 C 449 504 460 521 477 530 L 469 604 L 531 604 L 523 530 C 540 521 551 504 551 484 C 551 456 528 433 500 433 Z"/>
    <path fill="#ffffff" d="M 305 285 L 305 78 L 360 21 L 640 21 L 700 78 L 700 285 L 625 285 L 625 106 L 605 88 L 395 88 L 380 106 L 380 285 Z"/>
  </g>
</svg>`;
}

async function run() {
  const rootDir = path.join(__dirname, '..');
  const adaptiveSvg = Buffer.from(getAdaptiveSvg(0.44));
  const inAppSvg = Buffer.from(getInAppTransparentSvg(0.88));
  const solidSvg = Buffer.from(getSolidSvg(0.58));
  const roundSvg = Buffer.from(getRoundSvg(0.54));

  console.log('Generating Expo and app brand assets...');
  // Expo adaptive icon (standard safe-zone padded)
  await sharp(adaptiveSvg).resize(1024, 1024).png().toFile(path.join(rootDir, 'mobile/assets/adaptive-icon.png'));
  // Expo & web in-app transparent icon
  await sharp(inAppSvg).resize(1024, 1024).png().toFile(path.join(rootDir, 'mobile/assets/vaultr-lock-dark-transparent.png'));
  await sharp(inAppSvg).resize(1024, 1024).png().toFile(path.join(rootDir, 'public/brand/vaultr-lock-dark-transparent.png'));
  // Solid app store / square icon
  await sharp(solidSvg).resize(1024, 1024).png().toFile(path.join(rootDir, 'mobile/assets/vaultr-lock-dark-solid.png'));
  await sharp(solidSvg).resize(1024, 1024).png().toFile(path.join(rootDir, 'public/brand/vaultr-lock-dark-solid.png'));

  // Android mipmap sizes
  const mipmaps = [
    { dir: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
  ];

  for (const m of mipmaps) {
    const targetDir = path.join(rootDir, 'mobile/android/app/src/main/res', m.dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    console.log(`Generating for ${m.dir}...`);
    // ic_launcher.webp (standard solid square icon)
    await sharp(solidSvg).resize(m.iconSize, m.iconSize).webp({ lossless: true }).toFile(path.join(targetDir, 'ic_launcher.webp'));
    // ic_launcher_round.webp (standard round icon)
    await sharp(roundSvg).resize(m.iconSize, m.iconSize).webp({ lossless: true }).toFile(path.join(targetDir, 'ic_launcher_round.webp'));
    // ic_launcher_foreground.webp (transparent adaptive foreground with standard 66dp safe zone)
    await sharp(adaptiveSvg).resize(m.fgSize, m.fgSize).webp({ lossless: true }).toFile(path.join(targetDir, 'ic_launcher_foreground.webp'));
  }

  console.log('Done generating all standard-compliant app icons!');
}

run().catch(console.error);
