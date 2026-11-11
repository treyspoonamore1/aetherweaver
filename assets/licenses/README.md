# Third-party licences

What the build ships from other people's work, and the licence it comes under. The licence text
of each package is in this folder, copied from `node_modules`.

**No third-party asset ships.** There is no image, model, sound or video file in the build.
Every model is built in code from three.js primitives, and every sound is synthesised with
WebAudio. The only files in the build that are not the game's own code and style are the font
files below. `tools/licenses.ts` checks this against every build.

The list is rebuilt from the build's source maps (the code), from its font files, and from the
runtime dependencies in `package.json` and theirs, so a package that is missing here fails the
check. Run it after `npm run build`:

```bash
npm run licenses            # check the record against dist/
npm run licenses -- --write # rebuild this table and the copies below from the build
```

<!-- licenses:begin (written by tools/licenses.ts --write) -->

| Package                      | Version | Licence | What of it ships                            |
| ---------------------------- | ------- | ------- | ------------------------------------------- |
| `@fontsource/cinzel`         | 5.3.0   | OFL-1.1 | font files                                  |
| `@fontsource/inter`          | 5.3.0   | OFL-1.1 | font files                                  |
| `@fontsource/jetbrains-mono` | 5.3.0   | OFL-1.1 | font files                                  |
| `react`                      | 19.3.1  | MIT     | code                                        |
| `react-dom`                  | 19.3.1  | MIT     | code                                        |
| `scheduler`                  | 0.28.0  | MIT     | code                                        |
| `tailwindcss`                | 4.3.3   | MIT     | generated CSS and helper code, by the build |
| `three`                      | 0.186.1 | MIT     | code                                        |
| `vite`                       | 8.3.5   | MIT     | generated CSS and helper code, by the build |
| `zod`                        | 4.6.7   | MIT     | code                                        |
| `zustand`                    | 5.0.16  | MIT     | code                                        |

<!-- licenses:end -->

`tailwindcss` and `vite` are development dependencies.
Their generated CSS and small runtime helpers are emitted into the build, so their licences are
kept here too. The other development dependencies (the compiler, the linter, the test runners)
produce nothing that ships.

The fonts are self-hosted from the `@fontsource` packages under the SIL Open Font License 1.1.
The licence text in each folder here is the package's own; the font files themselves carry the
foundry's copyright and reserved names, which the licence lets us keep unchanged.
