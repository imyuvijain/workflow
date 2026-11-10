import { mkdir, copyFile, rm, access } from 'node:fs/promises';
import { dirname } from 'node:path';

// Only these public assets are deployed; source tooling and tests stay out.
const files = ['index.html', 'style.css', 'app.js', 'timer.js', 'noise-processor.js', 'sound-settings.js', 'favicon.svg', '.nojekyll', 'docs/screenshot.png'];
// Retain a configured custom domain when exporting the deployable folder.
try { await access('CNAME'); files.push('CNAME'); } catch { /* Custom domains are optional. */ }
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await Promise.all(files.map(async file => {
  await mkdir(dirname(`dist/${file}`), { recursive: true });
  await copyFile(file, `dist/${file}`);
}));
console.log(`Prepared ${files.length} static assets in dist/`);
