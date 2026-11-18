// Wrapper config for /home/user/aw-work/7/e2e.sh: runs a worktree's e2e specs against that
// worktree's own production build, on its own port, with output kept out of the worktree.
// No imports (this file lives outside any node_modules tree); the values mirror the repo's
// playwright.config.ts and Playwright's "Desktop Chrome" device.
const ROOT = process.env.PW_ROOT as string;
const PORT = Number(process.env.PW_PORT ?? 4173);
const HERE = process.env.PW_HERE ?? '/tmp/pw-here';

export default {
  testDir: `${ROOT}/e2e`,
  outputDir: `${HERE}/test-results`,
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    defaultBrowserType: 'chromium',
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    cwd: ROOT,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
};
