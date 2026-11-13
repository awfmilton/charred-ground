'use strict';
// Shared launcher for the browser suites. Two rules keep the tests runnable on any machine:
//  1. On Linux the browser is the pinned Chromium from @sparticuz/chromium (devDependency, exact version),
//     which brings its own libraries, so containers without a desktop stack still run the suite. Elsewhere
//     (Windows, macOS) it is Playwright's own Chromium, because @sparticuz/chromium ships a Linux build only.
//     CG_CHROME_PATH points at any other Chromium binary; CG_BROWSER=playwright forces Playwright's own.
//  2. three.js and PeerJS are served from the pinned npm copies in node_modules, so the tests never need a CDN.
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..');
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
// The bundled Chromium needs these to start inside containers without a GPU or a usable /dev/shm.
const BUNDLED_ARGS = ['--no-sandbox', '--no-zygote', '--disable-dev-shm-usage'];
async function launchBrowser() {
  if (process.env.CG_BROWSER !== 'playwright' && (process.env.CG_CHROME_PATH || process.platform === 'linux')) {
    let executablePath = process.env.CG_CHROME_PATH;
    if (!executablePath) {
      const sparticuz = require('@sparticuz/chromium').default;
      executablePath = await sparticuz.executablePath();
      return chromium.launch({ executablePath, headless: true, timeout: 120000, args: [...new Set([...GL_ARGS, ...BUNDLED_ARGS])] });
    }
    return chromium.launch({ executablePath, headless: true, timeout: 120000, args: GL_ARGS });
  }
  return chromium.launch({ args: GL_ARGS });
}
// Serves the pinned vendored copies for the two CDN scripts index.html loads.
async function routeVendoredScripts(context) {
  const files = {
    'cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': path.join(ROOT, 'node_modules/three/build/three.min.js'),
    'unpkg.com/peerjs@1.5.4/dist/peerjs.min.js': path.join(ROOT, 'node_modules/peerjs/dist/peerjs.min.js'),
  };
  await context.route(/^https:\/\/(cdnjs\.cloudflare\.com|unpkg\.com)\//, (route) => {
    const url = route.request().url().replace(/^https:\/\//, '');
    const file = files[url];
    if (!file) return route.fulfill({ status: 404, body: 'not vendored: ' + url });
    return route.fulfill({ status: 200, contentType: 'application/javascript', path: file });
  });
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.fulfill({ status: 404, body: '' }));
}
module.exports = { launchBrowser, routeVendoredScripts, ROOT };
