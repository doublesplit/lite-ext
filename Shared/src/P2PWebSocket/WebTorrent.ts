import { Eventify } from '../utils/Eventify';
import { debounce } from '../utils/throttle-debounce';

export class WebTorrent extends Eventify {
    ws: WebSocket | null = null;
    reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    debounce_send: ReturnType<typeof debounce>;
    constructor(public url = 'wss://tracker.openwebtorrent.com') {
        super();
        this.debounce_send = debounce(this.send.bind(this), 200);
    }
    send(data: Record<string, any>) {
        if (this.isOpened()) this.ws!.send(JSON.stringify(data));
        else console.error("Can't send: ws not opened");
    }
    isOpened() {
        return this.ws && this.ws.readyState === this.ws.OPEN;
    }
    get isConnecting() {
        return this.ws && this.ws.readyState == this.ws.CONNECTING;
    }
    connect() {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => this.onOpen();
        this.ws.onerror = () => {
            this.emit('error');
            this.onClose();
        };
        this.ws.onclose = () => this.onClose();
        this.ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            this.emit('message', data);
        };
    }
    reset() {
        if (this.ws) {
            this.ws.onopen = this.ws.onerror = this.ws.onclose = this.ws.onmessage = null;
            this.ws.close();
            this.ws = null;
        }
    }
    onClose() {
        this.reset();
        this.emit('close');
    }
    onOpen() {
        this.emit('open');
    }
}
