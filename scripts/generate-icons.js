const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function generateIcons() {
  for (const size of sizes) {
    const s = size;
    // Create SVG with shield + checkmark
    const svg = `
      <svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f766e"/>
            <stop offset="100%" stop-color="#065f46"/>
          </linearGradient>
          <clipPath id="round">
            <rect x="0" y="0" width="${s}" height="${s}" rx="${s*0.2}" ry="${s*0.2}"/>
          </clipPath>
        </defs>
        <g clip-path="url(#round)">
          <rect width="${s}" height="${s}" fill="url(#bg)"/>
          <path d="M ${s/2} ${s*0.18} L ${s*0.82} ${s*0.3} L ${s*0.82} ${s*0.55} Q ${s*0.82} ${s*0.82} ${s/2} ${s*0.88} Q ${s*0.18} ${s*0.82} ${s*0.18} ${s*0.55} L ${s*0.18} ${s*0.3} Z"
                fill="rgba(255,255,255,0.92)"/>
          <polyline points="${s*0.37} ${s*0.47} ${s*0.46} ${s*0.58} ${s*0.64} ${s*0.38}"
                    fill="none" stroke="#0f766e" stroke-width="${s*0.04}" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </svg>`;
    
    await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, `icon-${size}x${size}.png`));
    console.log(`Generated icon-${size}x${size}.png`);
  }
  console.log('All icons generated!');
}

generateIcons().catch(console.error);
