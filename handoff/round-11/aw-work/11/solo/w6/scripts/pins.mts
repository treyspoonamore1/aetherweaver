const root = process.argv[2]!;
const { CONTENT_VERSION } = await import(`${root}/src/content/index.ts`);
const { SIM_VERSION } = await import(`${root}/src/sim/constants.ts`);
const { DEFAULT_SETTINGS } = await import(`${root}/src/app/settings.ts`).catch(() => ({ DEFAULT_SETTINGS: { version: '?' } }));
console.log(JSON.stringify({ CONTENT_VERSION, SIM_VERSION, settings: DEFAULT_SETTINGS.version }));
