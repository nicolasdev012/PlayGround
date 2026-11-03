import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const out = resolve(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of ['index.html', 'game.js']) {
  await cp(resolve(root, file), resolve(out, file));
}
console.log(`Built static game into ${out}`);
