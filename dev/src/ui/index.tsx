import { render } from 'preact';
import App from '../App';
import { AppContext } from './Contexts';
import { Menu, MenuButtons } from './Menu';
import { Minimap } from './Minimap';
import Portal from './componetns/preact-portal';

// import './style.scss' with { type: 'cssfile' };
export function initLiteui(app: App) {
    // import('./style.scss', { type: 'cssfile' }).then((module) => {});
    const liteui = document.createElement('div');
    liteui.style = 'display:flex; flex-direction:column; overflow:hidden;';
    document.getElementById('instructions').insertAdjacentElement('afterend', liteui);
    render(
        <>
            <Portal into={liteui}>
                <>
                    {/* necessary for preact portal */}
                    <div data-portal className="w-full" style="overflow: hidden;display: flex;height: 100%;flex-direction: column;">
                        <AppContext.Provider value={app}>
                            <MenuButtons></MenuButtons>
                        </AppContext.Provider>
                        <AppContext.Provider value={app}>
                            <Menu></Menu>
                        </AppContext.Provider>
                    </div>
                </>
            </Portal>
        </>,
        document.body
    );

    {
        const promoPanel = document.querySelector('#mainui-promo');
        const replacement = document.createElement('div');
        replacement.style = 'width: 100%; height: 100%; background-color: #fff';
        render(<AppContext.Provider value={app}></AppContext.Provider>, replacement);
        promoPanel.insertAdjacentElement('afterbegin', replacement);
    }

    {
        const minimapElem = document.createElement('div');
        render(
            <AppContext.Provider value={app}>
                <Minimap />
            </AppContext.Provider>,
            minimapElem
        );
        document.body.insertAdjacentElement('afterbegin', minimapElem);
    }

    {
        const observer = new window.MutationObserver((mtRecs) => {
            for (const mtRec of mtRecs) {
                const elem = mtRec.target as HTMLElement;
                if (elem.style.display !== 'none') {
                    elem.style.display = 'flex';
                    elem.style.display = 'flex-direction:column';
                }
            }
        });
        observer.observe(window.document.querySelector('#mainPanel'), {
            attributeFilter: ['style']
        });
    }
}
