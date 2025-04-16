import { Eventify } from '../../Shared/src/utils/Eventify';
import App from './App';

export class World extends Eventify {
    private app: App;
    private minimap: Array<{ x: number; y: number; size: number; mass: number }>;
    offsetX: number;
    offsetY: number;
    private borderX: number;
    private borderY: number;
    private targetX: number;
    private targetY: number;
    myCellIds: number[];
    private decryptionKey: number;
    private mapOffsetFixed: boolean;
    private ws?: WebSocket;
    mapShiftX: number;
    mapShiftY: number;

    mapOffsetX: number;
    mapOffsetY: number;
    mapMinX: number;
    mapMinY: number;
    mapMaxX: number;
    mapMaxY: number;
    mapMidX: number;
    mapMidY: number;
    mapSizeH: number;
    mapSizeV: number;
    mapShrinkW: number;
    mapShrinkH: number;
    viewX: number;
    viewY: number;
    private mirrorV: boolean;
    private mirrorH: boolean;
    get isAgar() {
        return this.ws?.url.includes('minic');
    }
    constructor(app: App) {
        super();
        this.reset();
        this.app = app;
    }
    reset() {
        this.minimap = [];
        this.offsetX = 0;
        this.offsetY = 0;
        this.borderX = 0;
        this.borderY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.myCellIds = [];
        this.decryptionKey = 0;
        this.mapOffsetFixed = false;

        this.mapShiftX = 0;
        this.mapShiftY = 0;
        this.mapOffsetX = 0;
        this.mapOffsetY = 0;
        this.mapMinX = 0;
        this.mapMinY = 0;
        this.mapMaxX = 0;
        this.mapMaxY = 0;
        this.mapMidX = 0;
        this.mapMidY = 0;
        this.mapSizeH = 0;
        this.mapSizeV = 0;
        this.mapShrinkW = 1;
        this.mapShrinkH = 1;
        this.viewX = 0;
        this.viewY = 0;
        this.mirrorV = false;
        this.mirrorH = false;
    }
    xorBuffer = (buffer: ArrayBuffer, key: number) => {
        const dataView = new DataView(buffer);
        for (let i = 0; i < dataView.byteLength; i++) {
            dataView.setUint8(i, dataView.getUint8(i) ^ ((key >>> ((i % 4) * 8)) & 255));
        }
        return buffer;
    };
    uncompressMessage(input: Uint8Array, output: Uint8Array) {
        for (let i = 0, j = 0; i < input.length; ) {
            const byte = input[i++];
            let literalsLength = byte >> 4;
            if (literalsLength > 0) {
                let length = literalsLength + 240;
                while (length === 255) {
                    length = input[i++];
                    literalsLength += length;
                }
                const end = i + literalsLength;
                while (i < end) output[j++] = input[i++];
                if (i === input.length) return output;
            }
            const offset = input[i++] | (input[i++] << 8);
            if (offset === 0 || offset > j) return -(i - 2);
            let matchLength = byte & 15;
            let length = matchLength + 240;
            while (length === 255) {
                length = input[i++];
                matchLength += length;
            }
            let pos = j - offset;
            const end = j + matchLength + 4;
            while (j < end) output[j++] = output[pos++];
        }
        return output;
    }
    overWriteWS = (_target: WebSocket) => {
        const target = _target as WebSocket & { _onopen: WebSocket['onopen']; _onmessage: WebSocket['onmessage'] };
        setTimeout(() => {
            this.ws = target;
            target._onopen = target.onopen;
            target._onmessage = target.onmessage;
            target.onopen = (e) => {
                this.reset();
                target._onopen(e);
            };
            target.onmessage = (message) => {
                target._onmessage(message);
                let offset = 0;
                let msg = message.data;
                if (this.decryptionKey) msg = this.xorBuffer(msg, this.decryptionKey ^ 31122);
                const view = new DataView(msg);
                const opcode = view.getUint8(offset++);
                switch (opcode) {
                    case 17:
                        const playerX = view.getFloat32(offset, true);
                        offset += 4;
                        const playerY = view.getFloat32(offset, true);
                        offset += 4;
                        this.targetX = this.receiveX(playerX);
                        this.targetY = this.receiveY(playerY);
                        break;
                    case 32:
                        this.myCellIds.push(view.getUint32(offset, true));
                        break;
                    case 69:
                        this.ghostCells(view, offset);
                        break;
                    case 241:
                        this.decryptionKey = view.getUint32(offset, true);
                        break;
                    case 255:
                        this.handleMessages(
                            this.uncompressMessage(new Uint8Array(view.buffer.slice(5)), new Uint8Array(view.getUint32(offset, true))) as Uint8Array
                        );
                        break;
                    default:
                        this.handleMessages(new Uint8Array(msg));
                }
            };
        }, 0);
    };
    handleMessages(message: Uint8Array) {
        let offset = 0;
        const view = new DataView(message.buffer);
        const opcode = view.getUint8(offset++);
        switch (opcode) {
            case 16:
                {
                    const eatRecordLength = view.getUint16(offset, true);
                    offset += 2;
                    for (let i = 0; i < eatRecordLength; i++) offset += 8;
                    while (true) {
                        const id = view.getUint32(offset, true);
                        offset += 4;
                        if (id === 0) break;
                        const targetX = this.receiveX(view.getInt32(offset, true));
                        offset += 4;
                        const targetY = this.receiveY(view.getInt32(offset, true));
                        offset += 4;
                        offset += 2;
                        const flags = view.getUint8(offset++);
                        const extendedFlags = flags & 128 ? view.getUint8(offset++) : 0;
                        if (flags & 2) offset += 3;
                        if (flags & 4)
                            while (view.getInt8(offset++) !== 0) {
                                /* intentionally left empty */
                            }
                        if (flags & 8)
                            while (view.getInt8(offset++) !== 0) {
                                /* intentionally left empty */
                            }
                        if (extendedFlags & 4) offset += 4;
                        if (this.myCellIds.indexOf(id) !== -1) {
                            this.targetX = targetX;
                            this.targetY = targetY;
                        }
                    }
                    const removeLength = view.getUint16(offset, true);
                    offset += 2;
                    for (let i = 0; i < removeLength; i++) {
                        const removedID = view.getUint32(offset, true);
                        offset += 4;
                        if (this.myCellIds.includes(removedID)) this.myCellIds = this.myCellIds.filter((id) => id != removedID);
                    }
                }
                break;

            case 64:
                const minx = view.getFloat64(offset, true);
                offset += 8;
                const miny = view.getFloat64(offset, true);
                offset += 8;
                const maxx = view.getFloat64(offset, true);
                offset += 8;
                const maxy = view.getFloat64(offset, true);
                if (!this.mapOffsetFixed) {
                    this.offsetX = (minx + maxx) / 2;
                    this.offsetY = (miny + maxy) / 2;
                    this.borderX = maxx - minx;
                    this.borderY = maxy - miny;
                    this.setMapOffset(minx, miny, maxx, maxy);
                    this.mapOffsetFixed = true;
                }
                break;
        }
    }
    setMapOffset(left: number, top: number, right: number, bottom: number) {
        const isAgar = this.ws.url.includes('minic');
        if ((right - left > 14000 && bottom - top > 14000) || !isAgar) {
            if (this.mapOffsetFixed) return;
            if (isAgar) {
                const side = 14142;
                this.mapShrinkW = side / (right - left);
                this.mapShrinkH = side / (bottom - top);

                left = this.shrinkX(left);
                top = this.shrinkY(top);
                right = this.shrinkX(right);
                bottom = this.shrinkY(bottom);
            }

            this.mapShiftY = 0;
            this.mapShiftX = 0;
            const prX = -(right - left) * 0.5;
            const prY = -(bottom - top) * 0.5;

            const diffX = prX - left;
            const diffY = prY - top;

            this.mapShiftX = -diffX;
            this.mapShiftY = -diffY;

            left = this.shiftX(left);
            top = this.shiftY(top);
            right = this.shiftX(right);
            bottom = this.shiftY(bottom);

            this.mapOffsetX = (right - left) * 0.5 - right;
            this.mapOffsetY = (bottom - top) * 0.5 - bottom;

            this.mapMinX = left;
            this.mapMinY = top;
            this.mapMaxX = right;
            this.mapMaxY = bottom;
            this.mapMidX = (this.mapMaxX + this.mapMinX) * 0.5;
            this.mapMidY = (this.mapMaxY + this.mapMinY) * 0.5;

            this.mapSizeH = this.mapMaxX - this.mapMinX;
            this.mapSizeV = this.mapMaxY - this.mapMinY;

            if (!this.mapOffsetFixed) {
                this.viewX = (right + left) * 0.5;
                this.viewY = (bottom + top) * 0.5;
            }
            this.mapOffsetFixed = true;
        } else {
        }
    }
    ghostCells(view: DataView, offset: number) {
        this.minimap = [];
        let x = 0,
            y = 0,
            mass = 0;
        const length = view.getUint16(offset, true);
        offset += 2;
        for (let i = 0; i < length; i++) {
            x = this.receiveX(view.getInt32(offset, true));
            offset += 4;
            y = this.receiveY(view.getInt32(offset, true));
            offset += 4;
            mass = view.getUint32(offset, true);
            offset += 5;
            this.minimap.push({
                x: x,
                y: y,
                size: ~~Math.sqrt(100 * mass),
                mass: mass
            });
        }
    }

    unshrinkX(x: number) {
        return x / this.mapShrinkW;
    }
    unshrinkY(y: number) {
        return y / this.mapShrinkH;
    }
    shrinkX(x: number) {
        return x * this.mapShrinkW;
    }
    shrinkY(y: number) {
        return y * this.mapShrinkH;
    }

    unshiftX(x: number) {
        return x - -this.mapShiftX;
    }
    unshiftY(y: number) {
        return y - -this.mapShiftY;
    }
    shiftX(x: number) {
        return x - this.mapShiftX;
    }
    shiftY(y: number) {
        return y - this.mapShiftY;
    }

    invflipX(x: number) {
        return this.mirrorH ? x : this.mapMaxX - (x - this.mapMinX);
    }
    invflipY(y: number) {
        return this.mirrorV ? y : this.mapMaxY - (y - this.mapMinY);
    }
    flipX(x: number) {
        return !this.mirrorH ? x : this.mapMaxX - (x - this.mapMinX);
    }
    flipY(y: number) {
        return !this.mirrorV ? y : this.mapMaxY - (y - this.mapMinY);
    }

    receiveX(x: number) {
        x = this.shrinkX(x);
        x = this.shiftX(x);
        x = this.flipX(x);
        return x;
    }

    receiveY(y: number) {
        y = this.shrinkY(y);
        y = this.shiftY(y);
        y = this.flipY(y);
        return y;
    }

    serverX(x: number) {
        x = this.flipX(x);
        x = this.unshiftX(x);
        x = this.unshrinkX(x);
        return x;
    }

    serverY(y: number) {
        y = this.flipY(y);
        y = this.unshiftY(y);
        y = this.unshrinkY(y);
        return y;
    }

    drawMinimap(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, clear = true) {
        function safe(number: number) {
            return number == 0 ? 1 : number;
        }
        if (clear) ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.minimap.forEach((cell) => {
            const x = (safe(cell.x + this.borderX / 2) / this.borderX) * canvas.width;
            const y = (safe(cell.y + this.borderY / 2) / this.borderY) * canvas.height;
            const size = (cell.size / this.borderX) * canvas.width + 1;
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        });
        const playerX = (safe(this.targetX + this.borderX / 2) / this.borderX) * canvas.width;
        const playerY = (safe(this.targetY + this.borderY / 2) / this.borderY) * canvas.height;
        ctx.fillStyle = '#00bfff';
        ctx.beginPath();
        ctx.arc(playerX, playerY, 5, 0, Math.PI * 2);
        ctx.fill();
        const sectorSizeX = canvas.width / 5;
        const sectorSizeY = canvas.height / 5;
        const sectorCol = Math.floor(playerX / sectorSizeX);
        const sectorRow = Math.floor(playerY / sectorSizeY);
        const activeSectorIndex = sectorRow * 5 + sectorCol;
        return Number.isFinite(activeSectorIndex) ? activeSectorIndex : -1;
    }
    websocketHooked = false;
    initialize() {
        if (this.websocketHooked) return console.error('Error: WebSocket already hooked');
        this.websocketHooked = true;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        class WS extends window.WebSocket {
            constructor(url: string, protocols: string | string[]) {
                const errorStack = new Error().stack;
                const isAgar = /wasm:\/\//.test(errorStack);
                const isAgarServer = url.includes('minic');
                if (isAgar && !isAgarServer) {
                    // window['core'].disableIntegrityChecks(true);
                }
                if (isAgar) self.emit('beforeConnect', url, isAgarServer);
                super(url, protocols);
                if (isAgar) self.overWriteWS(this);
            }
            static injectedOnce = false;
        }
        window.WebSocket = WS;
    }
}
