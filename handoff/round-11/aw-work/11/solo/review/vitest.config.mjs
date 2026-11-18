export default {
  root: '/home/user/aw-work/wt-p11solo-review',
  test: {
    include: ['/home/user/aw-work/11/solo/review/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    environment: 'node',
    fileParallelism: false,
  },
  server: { fs: { strict: false } },
};
