import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Transcendental Math functions are "implementation-approximated" in ECMAScript, so they
// can differ between JS engines and break browser↔Node replay. The sim uses sim/core/dmath.
const NON_DETERMINISTIC_MATH = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'cbrt',
  'hypot',
];

export default defineConfig([
  globalIgnores([
    'dist/**',
    'reference/**',
    'docs/**',
    'test-results/**',
    'playwright-report/**',
    'coverage/**',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  // ── Architecture rule: the simulation is pure (docs/plan/05 §1, §4.3, §4.9) ──
  {
    files: ['src/sim/**/*.ts', 'src/content/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['three', 'react', 'react-dom', 'zustand'].map((name) => ({
            name,
            message: 'src/sim and src/content must stay pure: no rendering, UI or store imports.',
          })),
          patterns: [
            {
              group: [
                '**/render/**',
                '**/ui/**',
                '**/input/**',
                '**/audio/**',
                '**/app/**',
                '**/debug/**',
                '**/meta/**',
              ],
              message: 'src/sim and src/content may only import from src/sim, src/content and zod.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the sim RNG streams (sim/core/rng).' },
        ...NON_DETERMINISTIC_MATH.map((property) => ({
          object: 'Math',
          property,
          message: 'Not bit-exact across JS engines. Use sim/core/dmath.',
        })),
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'Date',
          'performance',
          'setTimeout',
          'setInterval',
          'requestAnimationFrame',
          'window',
          'document',
          'navigator',
        ].map((name) => ({
          name,
          message: 'The sim must not read wall-clock time or the environment.',
        })),
      ],
    },
  },
  {
    files: ['src/meta/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use a seeded RNG stream.' },
      ],
    },
  },
  {
    files: ['tools/**/*.ts', 'tests/**/*.ts', 'e2e/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
]);
