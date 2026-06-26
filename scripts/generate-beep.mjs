/**
 * Generates a short beep WAV file programmatically.
 * Run with: node scripts/generate-beep.mjs
 * Output: public/beep.mp3 (actually a WAV — rename or convert as needed)
 */

import { writeFileSync } from 'fs'

function generateBeepWav(frequency = 880, durationMs = 150, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * durationMs / 1000)
  const dataLength = numSamples * 2 // 16-bit = 2 bytes per sample
  const buffer = Buffer.alloc(44 + dataLength)

  // WAV header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataLength, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)         // chunk size
  buffer.writeUInt16LE(1, 20)          // PCM format
  buffer.writeUInt16LE(1, 22)          // mono
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28) // byte rate
  buffer.writeUInt16LE(2, 32)          // block align
  buffer.writeUInt16LE(16, 34)         // bits per sample
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataLength, 40)

  // Generate sine wave with fade-out envelope
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const envelope = Math.max(0, 1 - (i / numSamples) * 2) // fade out
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.6
    const intSample = Math.round(sample * 32767)
    buffer.writeInt16LE(intSample, 44 + i * 2)
  }

  return buffer
}

const wav = generateBeepWav(880, 200, 44100)
writeFileSync('public/beep.wav', wav)
console.log('Generated public/beep.wav')
console.log('Rename to beep.mp3 or convert with ffmpeg:')
console.log('  ffmpeg -i public/beep.wav public/beep.mp3')
