import { mkdir, copyFile, rm } from 'node:fs/promises';

// Only these public assets are deployed; source tooling and tests stay out.
const files = ['index.html', 'style.css', 'app.js', 'timer.js', 'brown-noise.js', 'favicon.svg', '.nojekyll'];
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await Promise.all(files.map(file => copyFile(file, `dist/${file}`)));
console.log(`Prepared ${files.length} static assets in dist/`);
