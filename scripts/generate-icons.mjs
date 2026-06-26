/**
 * Run with: node scripts/generate-icons.mjs
 * Requires: npm install -g sharp (or run: npx @squoosh/cli ...)
 *
 * This script creates placeholder PNG icons from the SVG.
 * For production, replace with a proper branded icon.
 */

import { readFileSync, writeFileSync } from 'fs'

// Base64-encoded minimal 192x192 and 512x512 dark PNGs with green F letter
// Generated as placeholders — replace with real icons before deploying

const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="30" fill="#0a0a0a"/>
  <text x="96" y="140" font-family="monospace" font-size="120" font-weight="bold" text-anchor="middle" fill="#00ff87">F</text>
</svg>`

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#0a0a0a"/>
  <text x="256" y="370" font-family="monospace" font-size="320" font-weight="bold" text-anchor="middle" fill="#00ff87">F</text>
</svg>`

writeFileSync('public/icons/icon-192.svg', svg192)
writeFileSync('public/icons/icon-512.svg', svg512)

console.log('Generated SVG icons. To convert to PNG, run:')
console.log('  npx svgexport public/icons/icon-192.svg public/icons/icon-192.png 192:192')
console.log('  npx svgexport public/icons/icon-512.svg public/icons/icon-512.png 512:512')
console.log('')
console.log('Or use an online SVG to PNG converter.')
