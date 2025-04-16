/** @type {import('tailwindcss').Config} */
module.exports = {
    important: true,
    content: ['./dev/src/**/*.{ts,tsx,scss,css}'],
    theme: {
        extend: {
            spacing: {
                18: '4.5rem',
                19: '4.75rem',
                100: '25rem',
                114: '28.5rem',
                128: '32rem',
                164: '41rem'
            }
        }
    },
    plugins: []
};
