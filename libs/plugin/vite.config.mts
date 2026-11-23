/// <reference types="vitest" />
//
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/libs/plugin',
	plugins: [tsconfigPaths()],
	// Uncomment this if you are using workers.
	// worker: {
	//  plugins: [ tsconfigPaths() ],
	// },
	test: {
		watch: false,
		globals: true,
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		reporters: ['default'],
		coverage: { reportsDirectory: '../../coverage/libs/plugin', provider: 'v8' },
	},
});
