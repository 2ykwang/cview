import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sharedExclude = [
  '**/node_modules/**',
  '**/dist/**',
  'src/frontend/node_modules/**',
];

const domSuffix = '**/*.dom.test.?(c|m)[jt]s?(x)';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          exclude: [...sharedExclude, domSuffix],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: [domSuffix],
          exclude: sharedExclude,
        },
      },
    ],
  },
});
