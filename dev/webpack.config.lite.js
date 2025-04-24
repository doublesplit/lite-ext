// @ts-check
/* eslint-disable @typescript-eslint/no-var-requires */
import yargs from 'yargs';
const args = yargs(process.argv).argv;
import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import CopyPlugin from 'copy-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import webpack from 'webpack';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import TerserPlugin from 'terser-webpack-plugin';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import postcss from 'postcss';
import PreactRefreshPlugin from '@prefresh/webpack';
import fs from 'fs';
class RemoveLicenseFilePlugin {
    apply(compiler) {
        compiler.hooks.emit.tap('RemoveLicenseFilePlugin', (compilation) => {
            for (let name in compilation.assets) {
                if (name.endsWith('LICENSE.txt')) {
                    delete compilation.assets[name];
                }
            }
        });
    }
}

/** @type {'production'|'development'} */
const mode = args['mode'];

const srcDir = path.resolve(__dirname, './');
const CLIENT_DIR = srcDir;
const OUTPUT_DIR = path.resolve(__dirname, '../dist');

const userscriptHeaderSrc = path.resolve(__dirname, './src/userscript-header.txt');
const userscriptHeaderString = fs.readFileSync(userscriptHeaderSrc, 'utf8');

const babelPluginProduction = ['@babel/plugin-transform-runtime'];
if (mode /* !== 'production'*/) babelPluginProduction.length = 0;

const babelPresetsProduction = [
    [
        '@babel/env',
        {
            targets: {
                browsers: ['last 2 versions']
            },
            // The magic sauce
            modules: false
        }
    ]
];

if (mode /* !== 'production'*/) babelPresetsProduction.length = 0;

/** @type { import('webpack').ModuleOptions['rules'] } */
const rules = [
    {
        with: { type: 'cssfile' },
        test: /\.css$/i,
        // exclude: /\.module\.scss$/,
        use: [
            // { loader: 'thread-loader' },
            // MiniCssExtractPlugin.loader, //1
            { loader: 'style-loader' },
            { loader: 'css-loader', options: { importLoaders: 1 } }, // We always need to apply postcss-loader before css-loader (importLoaders)
            {
                loader: 'postcss-loader', // required for tailwind
                options: {
                    implementation: postcss,
                    postcssOptions: { config: path.resolve(__dirname, './postcss.config.cjs') }
                }
            }
        ]
    },
    {
        test: /\.css$/i,
        use: [
            // { loader: 'thread-loader' },
            // MiniCssExtractPlugin.loader, //1
            { loader: 'style-loader' },
            { loader: 'css-loader', options: { importLoaders: 1 } }, // We always need to apply postcss-loader before css-loader (importLoaders)
            {
                loader: 'postcss-loader', // required for tailwind
                options: {
                    implementation: postcss,
                    postcssOptions: { config: path.resolve(__dirname, './postcss.config.cjs') }
                }
            }
        ]
    },
    {
        // with: { type: 'css' },
        test: /\.module\.scss$/,
        use: [
            // { loader: 'thread-loader' },
            { loader: 'style-loader' }, // <style>
            {
                loader: 'css-loader',
                options: {
                    importLoaders: 1, // 1 -> postcss-loader
                    modules: {
                        namedExport: true,
                        auto: /\.css$/,
                        localIdentName: '[name]__[local]--[hash:base64:5]'
                    }
                }
            },
            {
                loader: 'postcss-loader',
                options: {
                    implementation: postcss,
                    postcssOptions: { config: path.resolve(__dirname, './postcss.config.cjs') }
                }
            }
        ]
    },
    {
        test: /^(?!.*worker).*\.tsx?$/,
        exclude: /node_modules/,
        use: [
            { loader: 'thread-loader' },
            {
                loader: 'babel-loader',
                options: {
                    // /presets
                    presets: [
                        ['@babel/typescript', { jsxPragma: 'h' }], // [
                        ...babelPresetsProduction
                        //     '@babel/preset-react',
                        //     {
                        //         pragma: 'h',
                        //         pragmaFrag: 'Fragment'
                        //     }
                        // ],
                    ],
                    plugins: [
                        mode == 'development' && ['@prefresh/babel-plugin'],
                        // ['react-refresh/babel'],
                        ['@babel/transform-react-jsx', { runtime: 'automatic', importSource: 'preact' }],
                        '@babel/plugin-syntax-import-attributes',
                        ...babelPluginProduction
                    ].filter(Boolean)
                }
            },
            {
                loader: 'ts-loader',
                options: { transpileOnly: true, happyPackMode: true /*, compilerOptions: { noEmit: false }*/ }
            }
        ]
    },
    {
        // HMR + PREFRESH
        test: /\.js$/,
        type: 'javascript/auto',
        use: [
            {
                loader: 'babel-loader',
                options: {
                    plugins: [['@babel/transform-react-jsx', { runtime: 'automatic', importSource: 'preact' }]]
                }
            }
        ]
    }
];

/** @type { import('webpack').Configuration } */
const common = {
    cache: {
        type: 'memory'
        // buildDependencies: {
        //     config: [__filename]
        // }
    },
    externals: {
        preact: 'preact',
        window: 'unsafeWindow',
        'preact/compat': 'preactCompat',
        'preact/hooks': 'preactHooks',
        react: 'preactCompat'
    },
    experiments: {
        topLevelAwait: true
    },
    stats: {
        children: true
    },
    entry: {
        'doublesplit.user': path.resolve(srcDir, './src/index')
    },
    output: {
        publicPath: undefined,
        path: OUTPUT_DIR,
        filename: '[name].js',
        chunkFilename: '[id].[contenthash].js',
        globalObject: 'self',
        iife: false, // Disables Webpack`s IIFE
        libraryTarget: 'assign',
        library: 'MyLibrary'
    },
    optimization: {
        usedExports: true,
        mangleExports: false,
        minimize: false, //mode === 'production',
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    format: {
                        inline_script: false,
                        semicolons: true, // keeps semicolons at the end of lines
                        beautify: true, // enables formatted output
                        indent_level: 2, // sets indentation level
                        comments: false, // removes comments (or true to keep them)
                        keep_numbers: true, // preserves numeric values
                        keep_quoted_props: true, // keeps quotes around object keys
                        width: 160, // max line width
                        shorthand: false, // enables shorthand variable names
                        braces: true, // keeps curly braces
                        shebang: true, // preserves shebang (#!) at the top
                        quote_style: 3, // quote style (0 - auto, 1 - single, 2 - double, 3 - preserve)
                        ie8: false // IE8 support
                    },
                    ie8: false, // IE8 support
                    keep_fnames: true, // preserve function names
                    keep_classnames: true, // preserve class names
                    module: true,
                    compress: {
                        passes: 0,
                        inline: 0,
                        dead_code: true,
                        join_vars: false,
                        loops: false,
                        if_return: false,
                        reduce_vars: false,
                        reduce_funcs: false,
                        unused: true,
                        conditionals: false,
                        booleans_as_integers: false,
                        comparisons: false,
                        collapse_vars: false,
                        hoist_funs: false,
                        hoist_vars: false,
                        hoist_props: !false,
                        directives: false,
                        expression: false,
                        computed_props: false,
                        negate_iife: false,
                        sequences: false, // disables comma operator optimizations
                        booleans: false,
                        arrows: false,
                        properties: false,
                        unsafe: false,
                        unsafe_arrows: false,
                        unsafe_comps: false,
                        unsafe_Function: false,
                        unsafe_math: false,
                        unsafe_proto: false,
                        unsafe_regexp: false,
                        unsafe_methods: false,
                        unsafe_undefined: false,
                        unsafe_symbols: false,
                        side_effects: true,
                        switches: false
                    },
                    ecma: 2020, // ECMAScript version
                    mangle: false // disable variable name mangling
                }
            })
        ],
        splitChunks: {
            chunks: 'initial',
            maxInitialRequests: 30,
            minRemainingSize: 0,
            minSize: mode === 'production' ? 170000 : undefined,
            cacheGroups: {
                common: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'common',
                    priority: -20, // for workers
                    // reuseExistingChunk: true,
                    chunks: 'all',
                    minSize: 0,
                    enforce: true
                },
                styles: {
                    name: 'styles',
                    test: /\.(css|sass|scss)$/,
                    chunks: 'all',
                    enforce: true,
                    minChunks: 1,
                    reuseExistingChunk: true
                },
                workers: {
                    name: 'workers',
                    test: /\.worker\.ts$/,
                    chunks: 'initial',
                    enforce: true,
                    minChunks: 1,
                    reuseExistingChunk: false
                },
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name(module) {
                        // get the name. E.g. node_modules/packageName/not/this/part.js
                        // or node_modules/packageName
                        // @ts-ignore
                        const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
                        const random = Math.random().toString(36).substring(7);
                        // npm package names are URL-safe, but some servers don't like @ symbols
                        return random;
                        // return `npm.${packageName.replace('@', '')}`;
                    }
                }
            }
        }
    },
    resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.sass', '.css'],
        alias: {
            react: 'preact/compat',
            'react-dom': 'preact/compat',
            'react/jsx-runtime': 'preact/jsx-runtime'
        }
    },
    module: {
        rules: rules
    },
    // @ts-ignore
    plugins: [
        mode == 'development' && new webpack.HotModuleReplacementPlugin(), // @ts-ignore
        mode == 'development' && new PreactRefreshPlugin(),
        new webpack.optimize.ModuleConcatenationPlugin(),
        new webpack.optimize.LimitChunkCountPlugin({
            maxChunks: 1
        }),
        new webpack.BannerPlugin({
            raw: true,
            banner: userscriptHeaderString + `(function (window) {`,
            stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT
        }),
        new webpack.BannerPlugin({
            raw: true,
            banner: `})(typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);`,
            stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
            footer: true
        }),
        new CleanWebpackPlugin({
            // @ts-ignore
            root: process.cwd(),
            verbose: true,
            dry: false,
            cleanOnceBeforeBuildPatterns: ['**/*'],
            dangerouslyAllowCleanPatternsOutsideProject: true
        }),
        new CopyPlugin({
            patterns: [
                {
                    from: path.resolve(srcDir, './static/'),
                    to: OUTPUT_DIR,
                    noErrorOnMissing: true,
                    globOptions: {
                        dot: false
                    }
                }
            ]
        }),
        new HtmlWebpackPlugin({
            minify: false,
            template: path.resolve(srcDir, './src/template.html'),
            filename: 'index.html', // Output file name
            chunks: ['doublesplit.user'],
            hash: true,
            inject: false
        }),
        new RemoveLicenseFilePlugin()
    ].filter(Boolean)
};

/** @type { import('webpack').Configuration } */
const production = {
    ...common
};

/** @type { import('webpack').Configuration & {devServer:import('webpack-dev-server').Configuration}} */
const development = {
    ...common,
    devtool: 'eval-source-map',
    devServer: {
        open: true,
        allowedHosts: 'all',
        devMiddleware: {},
        setupMiddlewares: (middlewares) => {
            return middlewares.filter((middleware) => middleware.name !== 'cross-origin-header-check');
        },

        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers':
                'X-Requested-With, content-type, Authorization, access-control-expose-headers, Sec-Fetch-Mode, Sec-Fetch-Site',
            'Access-Control-Expose-Headers':
                'Content-Encoding, X-Parse-Job-Status-Id, X-Parse-Push-Status-Id, Access-Control-Expose-Headers, intervention, pragma'
        },
        static: {
            directory: path.join(__dirname, CLIENT_DIR, '/dist')
        },
        client: {
            overlay: {
                errors: !true,
                warnings: false,
                runtimeErrors: true
            },
            logging: 'info'
        },
        historyApiFallback: true,
        compress: true,
        port: 8080,
        /** Files for immediatly reloading */
        watchFiles: {
            paths: ['./dev/src/**/*'], // include all files in /src
            options: {
                ignored: ['**/dev/src/ui/**'] // ignore all files in /src/ui
            }
        },

        hot: true,
        liveReload: true
        // hot: "only",
    }
};

const buildModes = { production, development };
const toExport = buildModes[args['mode']];
if (!toExport) {
    throw new Error(`No such build mode: ${args['mode']} in webpack.config.js`);
}
export default toExport;
