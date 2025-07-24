import { useContext, useRef } from 'preact/hooks';

import { settings } from '../settings';
import { useEventify } from './componetns/hooks';
import { AppContext } from './Contexts';
import { SettingsList } from './SettingsList';

export function MenuButtons() {
    const app = useContext(AppContext);
    const inputRef = useRef<HTMLInputElement>();
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
            <button style={{ width: '242px' }} type="submit" class="btn menu-button " onClick={() => app.spetate()}>
                Spectate
            </button>
            <div
                style={{
                    display: 'flex',
                    gap: '4px',
                    paddingTop: '4px'
                }}
            >
                <input class="input-addon" placeholder="server" ref={inputRef} />
                <button type="submit" class="btn menu-button" onClick={() => app.connect(inputRef.current.value)}>
                    Connect
                </button>
            </div>
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
