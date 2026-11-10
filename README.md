# Workflow

A small personal study workspace: a stopwatch, daily study hours, and continuous brown noise with volume control. Static HTML, CSS, and JavaScript. No runtime dependencies or backend.

## Use

- **Start studying** begins the stopwatch. **Pause studying** excludes breaks. **Finish session** saves the time and clears the session stopwatch.
- Daily totals are shown in hours, with a seven-day chart and previous/next history controls. Sessions crossing midnight are split by local calendar day.
- A running timer continues until paused or finished, even across reloads or closed tabs. Pause it when you leave.
- Study history is stored in this browser's local storage. It does not sync between devices, browser profiles, or different website addresses. Clearing site data removes the history.
- Brown noise starts only when you press play. It is generated continuously using an AudioWorklet. Its volume preference is saved; audio never autoplays after a reload. Use a current browser over HTTPS or localhost.
- The Google Fonts stylesheet supplies the typefaces; system fonts remain available when offline.

## Local development

Requires Node.js 20+ for checks/build and Python 3 for the optional development server.

```sh
npm test
npm run build
npm run dev
```

Open http://127.0.0.1:4173. No installation step is needed.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` tests the timer, packages only public assets into `dist/`, and deploys on every push to `main`. It follows the [GitHub Pages custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Create a new public GitHub repository and push this checkout. In the repository's **Settings → Pages**, choose **GitHub Actions** as the source. The Actions workflow's successful deployment will show the actual site URL. All asset paths are relative, so the site also works under a repository subpath.

## Checks

`npm test` covers pausing and finishing, reload persistence, local midnight splits, daylight saving changes, malformed data, and sessions longer than 24 hours. Live browser/audio checks require a preview server and are separate from these tests.
