import App from './App';
import { enableFastCanvasView, enableVueDevtools } from './dev';
import './ui/minimap.css';
import './ui/style.css';
import { isGM, registerCheckUpdates, registerMenuCommands } from './userscripting/Tampermonkey';
import { makeGLobal } from './utils/env';
import { find_node } from './utils/utils';

if (window.location.href.includes('agar.io')) {
    enableVueDevtools();
    enableFastCanvasView();
    const app = new App();
    makeGLobal('app', app);
    makeGLobal('find_node', find_node);

    if (isGM() && !window.GM_skipMenu) {
        registerMenuCommands();
        registerCheckUpdates();
    }
} else {
    import('./ui/backend.test');
}
