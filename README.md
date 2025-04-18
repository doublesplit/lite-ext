# Doublesplit – Agar.io Extension

Doublesplit is a powerful userscript extension for [Agar.io](https://agar.io/), designed to enhance your gameplay experience.

## Userscript Features

- **Minimap**: See more of the map and track your position.
- **Custom Server Connection**: Connect to any Agar.io server, not just the official ones.
- **FPS Boost**: Optimizations for higher frame rates and smoother gameplay.
- **Extended Zoom**: Zoom out further to get a better overview.
- **Advanced Map Overlays**: Sector grid, sector labels, and map border rendering.
- **Auto Respawn**: Option to automatically rejoin the game after death.
- **Adblocker**: Removes in-game ads (see userscript header).

## Installation

To install the userscript, use the following link:

[Install Doublesplit Userscript](https://github.com/doublesplit/lite-ext/raw/refs/heads/main/dist/doublesplit.user.js)

**Important:**  
Before installing, you must have [**Tampermonkey**](https://www.tampermonkey.net/) installed in your browser and **Developer Mode** enabled in the extension settings.  
See how to enable Developer Mode: https://youtu.be/sZeUZjhOfgM

## Technologies Used

- **TypeScript**: Type-safe JavaScript for robust development.
- **Preact**: Fast React-like UI library for rendering components.
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development.
- **SCSS**: Enhanced CSS with variables and nesting.
- **Webpack**: Bundler for building and optimizing the extension.
- **Hot Module Replacement (HMR)**: Fast development with live reloading.
- **PostCSS**: For Tailwind and CSS processing.
- **Babel**: For transpiling modern JavaScript/TypeScript.
- **Custom WebAssembly Patcher**: For patching core WASM at runtime.
- **Extensive VSCode Integration**: Editor settings, Tailwind IntelliSense, and SCSS support.

## Development

To start development, clone the repository and install dependencies:

```sh
git clone https://github.com/doublesplit/lite-ext.git
cd lite-ext
npm ci
```

For development build with hot reload:

```sh
npm run devlite
```

**Note:**  
For local development you will also need the [special userscript](https://deltav4.gitlab.io/delta.user.js), and this link: [https://agar.io/patcheddev](https://agar.io/patcheddev)

For production build:

```sh
npm run buildlite
```

The built userscript will be in the `dist/` directory.

## Contribution

Contributions are welcome from everyone! If you want to improve or extend the code, feel free to submit your changes.

- All changes must be public and visible to everyone.
- You may not claim the code as your own or steal authorship.
- Any modifications should be shared openly with the community.

## License

This project follows an open and transparent development model. All contributions and changes must remain public. Do not misrepresent the origin of the code.

## Disclaimer

This project is provided for educational and personal use only. The authors and contributors are not responsible for any misuse or damages resulting from the use of this extension. We strictly adhere to good, conscientious, and ethical development practices. All development is carried out in good faith and with respect for the community and legal requirements.

For more details, see the source code and documentation in this repository.
