// postcss.config.js
const tailwindcss = require('@tailwindcss/nesting');
module.exports = {
    plugins: {
        'postcss-import': {},
        '@tailwindcss/nesting': {},
        tailwindcss: tailwindcss,
        autoprefixer: {}
    }
};
