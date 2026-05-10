module.exports = {
    testMatch: [
        "<rootDir>/src/**/*.test.ts",
        "<rootDir>/src/**/*.test.tsx",
        "<rootDir>/scripts/**/*.test.ts",
    ],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
    },
    modulePaths: ["<rootDir>/src"],
    transform: {
        "^.+\\.(ts|tsx)$": [
            "babel-jest",
            {
                // Skip babel.config.js so babel-preset-expo doesn't rewrite `process.env.EXPO_PUBLIC_*` into imports of `expo/virtual/env.js`, which Jest can't parse.
                configFile: false,
                babelrc: false,
                presets: [
                    ["@babel/preset-env", { targets: { node: "current" } }],
                    "@babel/preset-typescript",
                ],
            },
        ],
    },
    collectCoverageFrom: [
        "src/lib/eventLogParser.ts",
        "src/lib/settingsUtils.ts",
        "src/lib/logger.ts",
        "src/lib/performanceLogger.ts",
        "src/components/**/helpers.ts",
        "src/context/searchConfig.ts",
    ],
}
