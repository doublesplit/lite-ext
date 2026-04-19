import { useContext, useRef } from 'preact/hooks';

import { settings } from '../settings';
import { useEventify } from './componetns/hooks';
import { AppContext } from './Contexts';
import { SettingsList } from './SettingsList';

const TRAINING_SERVER_URL = 'https://delt.io/v7/BrowserServer.html?gamemode=party';
const TRAINING_SERVER_WINDOW_NAME = 'delta-training-server';

export function MenuButtons() {
    const app = useContext(AppContext);
    const inputRef = useRef<HTMLInputElement>();
    const trainingWindowRef = useRef<Window | null>(null);

    const openTrainingServer = () => {
        const openedWindow = trainingWindowRef.current;
        if (openedWindow && !openedWindow.closed) {
            openedWindow.focus();
            return;
        }

        const newWindow = window.open(TRAINING_SERVER_URL, TRAINING_SERVER_WINDOW_NAME);
        if (!newWindow) return;

        trainingWindowRef.current = newWindow;
        newWindow.focus();
    };

    useEventify((e) => {
        e.listenTo(app.state, 'ws', () => {
            inputRef.current.value = app.state.ws;
        })();
    }, []);
    return (
        <div
            class={'menu-addon'}
            style={{
                marginTop: '4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}
        >
            <button style={{ width: '242px' }} type="submit" class="btn menu-button " onClick={() => app.spectate()}>
                Spectate
            </button>
            <div
                style={{
                    display: 'flex',
                    gap: '4px',
                    paddingTop: '4px',
                    alignItems: 'center'
                }}
            >
                <input class="input-addon" placeholder="server" ref={inputRef} />
                <button type="submit" class="btn menu-button" onClick={() => app.connect(inputRef.current.value)}>
                    Connect
                </button>
            </div>
            <button style={{ width: '242px' }} type="submit" class="btn menu-button" onClick={openTrainingServer}>
                Training server
            </button>
        </div>
    );
}

export const Menu = () => {
    return (
        <div className="h-full" style={{ overflowY: 'scroll' }} onWheel={(e) => e.stopPropagation()}>
            <div className="mx-2">
                <SettingsList array={Object.entries(settings.raw)} target={settings} />
            </div>
        </div>
    );
};
