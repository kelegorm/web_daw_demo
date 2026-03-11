#!/usr/bin/env node
// EXPERIMENTAL / LEGACY — not part of the active runtime.
// AudioWorklet/WASM is not wired into the app. This script is retained for
// historical reference only. See CLAUDE.md for the active runtime stack.
//
// Compiles src/wasm/synth.wat → public/synth.wasm using the wabt npm package.
// Run: node scripts/build-wasm.js
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function main() {
  const wabt = await import('wabt');
  const wabtModule = await wabt.default();

  const watPath = resolve(root, 'src/wasm/synth.wat');
  const watSource = readFileSync(watPath, 'utf8');

  const module = wabtModule.parseWat('synth.wat', watSource, {
    mutable_globals: true,
    sat_float_to_int: true,
    sign_extension: true,
    bulk_memory: false,
  });

  const { buffer } = module.toBinary({ log: false });
  const outDir = resolve(root, 'public');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'synth.wasm'), Buffer.from(buffer));
  console.log('Built public/synth.wasm');
  module.destroy();
}

main().catch((err) => { console.error(err); process.exit(1); });
