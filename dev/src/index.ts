import App from './App';
import { enableFastCanvasView, enableVueDevtools } from './dev';
import './ui/minimap.scss';
import './ui/style.scss';
import { isGM, registerCheckUpdates, registerMenuCommands } from './userscripting/Tampermonkey';
import { makeGLobal } from './utils/env';
import { find_node } from './utils/utils';
enableVueDevtools();
enableFastCanvasView();
const app = new App();
makeGLobal('app', app);
makeGLobal('find_node', find_node);

if (isGM() && !window.GM_skipMenu) {
    registerMenuCommands();
    registerCheckUpdates();
}
