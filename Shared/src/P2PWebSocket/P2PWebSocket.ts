import { Instance } from 'simple-peer';
import { MicroPeer, getHash } from './MicroPeer';
import { WebTorrent } from './WebTorrent';

const ws = new WebTorrent('wss://tracker.openwebtorrent.com');

const myPeer = new MicroPeer(
    {
        info_hash: 'null'
    },
    ws
);

export class P2PWebSocket extends EventTarget implements WebSocket {
    static CONNECTING: WebSocket['CONNECTING'] = 0;
    static OPEN: WebSocket['OPEN'] = 1;
    static CLOSING: WebSocket['CLOSING'] = 2;
    static CLOSED: WebSocket['CLOSED'] = 3;
    static isFake = true;
    CONNECTING = P2PWebSocket.CONNECTING;
    OPEN = P2PWebSocket.OPEN;
    CLOSING = P2PWebSocket.CLOSING;
    CLOSED = P2PWebSocket.CLOSED;

    #_readyState: WebSocket['readyState'] = P2PWebSocket.CONNECTING;
    #_binaryType: WebSocket['binaryType'] = 'blob';

    bufferedAmount = 0;
    extensions = '';
    websocket!: WebSocket;
    get readyState() {
        return this.#_readyState;
    }
    set binaryType(x: WebSocket['binaryType']) {
        this.websocket && (this.websocket.binaryType = x);
        this.#_binaryType = x;
    }
    get binaryType() {
        return this.#_binaryType;
    }

    isFake = true;

    url: string;
    protocol: string = '';
    DcInitialized = false;
    timeoutError: ReturnType<typeof setTimeout>;

    // myPeer: MicroPeer = myPeer;
    Web!: Instance;
    #connect_handler: ((peer: Instance) => void) | null = null;
    onopen: WebSocket['onopen'] = () => {};
    onmessage: WebSocket['onmessage'] = () => {};
    onclose: WebSocket['onclose'] = () => {};
    onerror: WebSocket['onerror'] = () => {};
    send: WebSocket['send'] = () => {};
    constructor(url: string, protocol?: string) {
        super();
        const hash = url.substring(7);
        this.url = url;
        if (protocol) this.protocol = protocol;

        this.send = (data) => {
            // @ts-ignore
            this.Web.send(data);
        };

        this.timeoutError = setTimeout(() => {
            this.onerror && this.onerror(new Event('timeout'));
            this.close(undefined, 'timeout');

            myPeer.stop();
            // myPeer.socket.ws?.close()
        }, 5000);

        myPeer['info_hash'] = getHash(hash, 20);
        const connect_handler = (peer: Instance) => {
            // myPeer.removeListener('connect', this.connect_handler);
            if (this.DcInitialized) return console.error('DC already initialized');
            this.DcInitialized = true;

            if (this.#connect_handler) {
                myPeer.removeListener('connect', this.#connect_handler);
                this.#connect_handler = null;
            }

            clearTimeout(this.timeoutError);
            myPeer.stop();
            myPeer.socket.ws?.close();
            this.Web = peer;
            this.#connect(peer);
        };
        this.#connect_handler = connect_handler;
        myPeer.on('connect', connect_handler);
        const opts = {
            event: 'started',
            numwant: 1,
            uploaded: 0,
            downloaded: 0
            // left: null,
            // complete: 0,
        };

        if (!ws.isOpened()) {
            !ws.isConnecting && ws.connect();
            ws.once('open', () => {
                myPeer.announce(opts);
            });
            return;
        }

        myPeer.announce(
            {
                event: 'started',
                numwant: 1,
                uploaded: 0,
                downloaded: 0
                // left: null,
                // complete: 0,
            },
            () => {}
        );
    }
    #connect(peer: Instance) {
        this.#_readyState = P2PWebSocket.OPEN;

        const event_open = new Event('open');
        this.onopen?.(event_open);
        this.dispatchEvent(event_open);

        peer.on('error', (e: Error) => {
            const event = new ErrorEvent(e.message);
            this.dispatchEvent(event);
            this.close();
            this.onerror?.(event);
        });
        peer.on('data', (e: Uint8Array) => {
            const event = new MessageEvent('message', { data: e.buffer });
            this.onmessage?.(event);
            this.dispatchEvent(event);
        });
        peer.on('close', () => {
            this.close(1006, 'close');
            peer.removeAllListeners('error');
            peer.removeAllListeners('data');
            peer.removeAllListeners('close');
        });
    }
    close(code?: number | undefined, reason?: string | undefined) {
        if (this.#_readyState === P2PWebSocket.CLOSING || this.#_readyState === P2PWebSocket.CLOSED) {
            return;
        }

        const event = new CloseEvent('close', { code, reason });
        clearTimeout(this.timeoutError);
        if (this.Web && this.Web.destroyed == false) {
            this.Web.destroy();
        }
        if (this.#connect_handler) {
            myPeer.removeListener('connect', this.#connect_handler);
            this.#connect_handler = null;
        }
        this.send = () => {};

        this.#_readyState = P2PWebSocket.CLOSING;

        this.onclose?.(event);
        this.dispatchEvent(event);

        this.#_readyState = P2PWebSocket.CLOSED;

        Object.assign(this, { Web: undefined });
    }
}
