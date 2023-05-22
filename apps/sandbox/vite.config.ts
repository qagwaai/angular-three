/// <reference types="vitest" />

import analog from '@analogjs/platform';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, Plugin, splitVendorChunkPlugin } from 'vite';
import glslify from 'vite-plugin-glslify';
import tsConfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    return {
        publicDir: 'src/public',

        optimizeDeps: {
            include: ['@angular/common', '@angular/forms'],
        },
        build: {
            target: ['es2020'],
        },
        plugins: [
            glslify(),
            analog({
                ssrBuildDir: '../../dist/apps/sandbox/ssr',
                entryServer: 'apps/sandbox/src/main.server.ts',
                vite: {
                    inlineStylesExtension: 'css',
                    tsconfig: 'apps/sandbox/tsconfig.app.json',
                },
                nitro: {
                    rootDir: 'apps/sandbox',
                    output: {
                        dir: '../../../dist/apps/sandbox/analog',
                        publicDir: '../../../dist/apps/sandbox/analog/public',
                    },
                    publicAssets: [{ dir: `../../../dist/apps/sandbox/client` }],
                    serverAssets: [{ baseName: 'public', dir: `./dist/apps/sandbox/client` }],
                    buildDir: '../../dist/apps/sandbox/.nitro',
                },
                prerender: {
                    routes: ['/'],
                },
            }),
            tsConfigPaths({
                root: '../../',
            }),
            visualizer() as Plugin,
            splitVendorChunkPlugin(),
        ],
    };
});
