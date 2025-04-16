import { overrideMethod } from './utils/utils';

export function enableVueDevtools() {
    overrideMethod(window.Object, 'defineProperty', (originalMethod, args) => {
        if (args[1] === 'config') {
            const orig_getter = args[2].get;
            args[2].get = function () {
                const vueConfig = orig_getter();
                vueConfig.devtools = true;
                vueConfig.productionTip = true;
                return () => vueConfig;
            };
            window.Object.defineProperty = originalMethod;
        }
        return originalMethod.apply(window.Object, args);
    });
}

export function enableFastCanvasView() {
    Object.defineProperty(window.HTMLCanvasElement.prototype, 'aaa', {
        get(this: HTMLCanvasElement) {
            this.toBlob((blob: Blob) => {
                const blobUrl = URL.createObjectURL(blob);
                createPopupWin(blobUrl, 'Canvas', 800, 600);
            });

            return 1;
        }
    });
}

function createPopupWin(pageURL: string | URL, pageTitle: string, popupWinWidth: number, popupWinHeight: number) {
    const left = (screen.width - popupWinWidth) / 2;
    const top = (screen.height - popupWinHeight) / 4;
    return window.open(
        pageURL,
        pageTitle,
        'resizable=yes, width=' + popupWinWidth + ', height=' + popupWinHeight + ', top=' + top + ', left=' + left
    );
}
