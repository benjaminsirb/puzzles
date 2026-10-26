# Puzzles

Offline, unlimited Queens, Tango, Zip and Patches. A plain PWA: no build step, no dependencies.

- Open the site in Safari on iPhone, tap Share, then Add to Home Screen.
- Every puzzle has a seed shown under the board. The same seed always rebuilds the same puzzle.
- Progress and the timer persist per game in the browser.

Local run: `python3 -m http.server 8787` in this folder, then open http://localhost:8787.

Link preview image: `og/preview.html` renders four mini boards. Regenerate `og.png` with a local server running on 8788:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=1200,630 --screenshot=/tmp/og-raw.png http://127.0.0.1:8788/og/preview.html
sips -z 630 1200 /tmp/og-raw.png --out og.png
```
