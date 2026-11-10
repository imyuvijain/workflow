# Workflow

A study timer, daily study hours, and continuous brown noise with volume control. Static HTML, CSS, and JavaScript. No runtime dependencies or backend.

## Use

- Enter a **session title**, such as MATH135. It stays with the current session across pauses and reloads. You can edit it while studying; **Finish** clears it for the next session.
- **Start** begins the stopwatch. **Pause** excludes breaks. **Finish** saves the time and clears the session stopwatch.
- Daily totals are shown in hours, with a seven-day chart and previous/next history controls. Sessions crossing midnight are split by local calendar day.
- A running timer continues until paused or finished, even across reloads or closed tabs. Pause it when you leave.
- Study history is stored in this browser's local storage. It does not sync between devices, browser profiles, or different website addresses. Clearing site data removes the history.
- Brown noise starts only when you press play. It is generated continuously using an AudioWorklet. Its volume preference is saved; audio never autoplays after a reload. Use a current browser over HTTPS or localhost.
- The interface uses system fonts and a neutral black-and-white palette. There are no external font requests.

## Local development

Requires Node.js 20+ for checks/build and Python 3 for the optional development server.

```sh
npm test
npm run build
npm run dev
```

Open http://127.0.0.1:4173. No installation step is needed.

## GitHub Pages

The live site is https://imyuvijain.github.io/workflow/. GitHub Pages publishes the root of `main` after each update. No build step is required for hosting; `.nojekyll` serves the files directly. The optional `npm run build` command creates a separate `dist/` containing only public assets.

For another repository, choose **Settings → Pages → Deploy from a branch → main → / (root)**. All asset paths are relative, so the site works under a repository subpath.

## Checks

`npm test` covers session titles, pausing and finishing, reload persistence, local midnight splits, daylight saving changes, malformed data, sessions longer than 24 hours, and the brown noise signal. Live browser/audio checks require a preview server and are separate from these tests.
