import { define } from "rstack"
import { fusionPlugin } from "@synergy-js/fusion/rsbuild"
import { pluginSolid } from "@rsbuild/plugin-solid"
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss"
import { pluginBabel } from "@rsbuild/plugin-babel"

define.app({
    root: ".",
    dev: {
        browserLogs: {
            stackTrace: "none",
        },
        lazyCompilation: true,
    },
    output: {
        minify: true,
        polyfill: "off",
        overrideBrowserslist: ["last 2 versions"],
    },
    splitChunks: {
        preset: "per-package",
        chunks: "all",
    },
    performance: {
        removeConsole: true,
    },
    plugins: [
        fusionPlugin({
            preset: "bun",
            logLevel: "verbose",
        }),
        pluginBabel({
            include: /\.(?:jsx|tsx)$/,
        }),
        pluginSolid(),
        pluginTailwindcss(),
    ],
    server: {
        port: 5007,
        publicDir: false,
    },
    source: {
        entry: {
            index: "./src/index.tsx",
        },
        tsconfigPath: "./tsconfig.app.json",
    },
    tools: {
        lightningcssLoader: {
            minify: true,
        },
        swc: {
            module: {
                type: "nodenext",
                lazy: true,
            },
        },
    },
    html: {
        title: "Solid Sandbox",
    },
})
