import { Eventify } from '../../Shared/src/utils/Eventify';
import App from './App';
import { Cell } from './Cell';
// import { ServerPlayer } from './ui/Stores';

export class World extends Eventify {
    static decoder = new TextDecoder('utf-8');
    static strlen = (view: DataView, offset: number) => {
        let length = 0;
        while (view.getUint8(offset + length++) !== 0) {}
        return length;
    };
    private app: App;
    private minimap: Array<{ x: number; y: number; size: number; mass: number }>;
    offsetX: number;
    offsetY: number;
    private borderX: number;
    private borderY: number;
    private targetX: number;
    private targetY: number;
    myCellIds: Set<number> = new Set();
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
    ownCells: Map<number, Cell> = new Map();
    cells: Map<number, Cell> = new Map();
    isPlay: boolean;
    get isAgar() {
        return this.ws?.url.includes('minic');
    }
    CLIENT_VERSION: string | null = null;
    client_version_int = 0;
    get clientVersion() {
        if (this.client_version_int) return this.client_version_int;
        if (window['MC'] && window['MC'].CLIENT_VERSION) {
            this.CLIENT_VERSION = window['MC'].CLIENT_VERSION;
        } else {
            this.CLIENT_VERSION = '3.11.28';
            alert('Failed to get CLIENT_VERSION, please report this issue');
        }

        const version2int = (x = '0') => x.split('.').reduce((n, c, i, a) => n + parseInt(c) * 100 ** (a.length - i - 1), 0);
        this.client_version_int = version2int(this.CLIENT_VERSION);
        return this.clientVersion;
    }
    constructor(app: App) {
        super();
        this.reset();
        this.app = app;
    }
    reset() {
        this.isPlay = false;
        this.ownCells.clear();
        this.cells.clear();
        this.minimap = [];
        this.offsetX = 0;
        this.offsetY = 0;
        this.borderX = 0;
        this.borderY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.myCellIds.clear();
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
        const target = _target as WebSocket & { _send: WebSocket['send']; _onopen: WebSocket['onopen']; _onmessage: WebSocket['onmessage'] };

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
            if (this.decryptionKey) msg = this.xorBuffer(msg, this.decryptionKey ^ this.clientVersion);
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
                    this.myCellIds.add(view.getUint32(offset, true));
                    break;
                case 69:
                    this.ghostCells(view, offset);
                    break;
                case 241:
                    this.decryptionKey = view.getUint32(offset, true);
                    offset += 4;
                    const strlen = World.strlen(view, offset);
                    const serverVersion = strlen ? World.decoder.decode(new Uint8Array(view.buffer, offset, strlen - 1)) : null;
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
    };
    eatCellEvent(eater: Cell, victim: Cell) {
        if (eater && victim) {
            this.removeCell(victim);
        } else {
            this.removeCell(victim);
        }
    }
    removeCell(cell: Cell) {
        if (cell) {
            this.cells.delete(cell.id);
            this.ownCells.delete(cell.id);
            const isMyCell = this.myCellIds.has(cell.id);
            if (isMyCell) {
                this.myCellIds.delete(cell.id);
                if (this.isPlay && this.myCellIds.size === 0) {
                    this.isPlay = false;
                }
            }
        }
    }
    handleMessages(message: Uint8Array) {
        let offset = 0;
        const view = new DataView(message.buffer);
        const opcode = view.getUint8(offset++);
        switch (opcode) {
            case 16:
                {
                    const eatRecordLength = view.getUint16(offset, true);
                    offset += 2;
                    for (let i = 0; i < eatRecordLength; i++) {
                        const eaterID = view.getUint32(offset, true);
                        offset += 4;
                        const victimID = view.getUint32(offset, true);
                        offset += 4;
                        const eater = this.cells.get(eaterID);
                        const victim = this.cells.get(victimID);
                        this.eatCellEvent(eater, victim);
                    }
                    while (true) {
                        const id = view.getUint32(offset, true);
                        offset += 4;
                        if (id === 0) break;
                        const targetX = this.receiveX(view.getInt32(offset, true));
                        offset += 4;
                        const targetY = this.receiveY(view.getInt32(offset, true));
                        offset += 4;
                        const size = view.getUint32(offset, true);
                        offset += 2;
                        const flags = view.getUint8(offset++);
                        const extendedFlags = flags & 128 ? view.getUint8(offset++) : 0;
                        const color =
                            flags & 2
                                ? view.getUint32(offset++, true) | (view.getUint32(offset++, true) << 8) | (view.getUint32(offset++, true) << 16)
                                : null;
                        if (flags & 4)
                            while (view.getInt8(offset++) !== 0) {
                                /* intentionally left empty */
                            }
                        const nameLength = flags & 8 ? World.strlen(view, offset) : 0;
                        const name = nameLength ? World.decoder.decode(new Uint8Array(view.buffer, offset, nameLength - 1)) : null;
                        offset += nameLength;
                        const accountID = extendedFlags & 4 ? ((offset += 4), view.getUint32(offset - 4, true)) : 0;

                        const isNew = !this.cells.has(id);
                        const cell = this.cells.get(id) || this.cells.set(id, new Cell()).get(id)!;
                        if (isNew) {
                            cell.construct(id, color, accountID);
                            name !== null && cell.setName(name);
                            this.cells.set(id, cell);
                        }
                        name !== null && cell.setName(name);
                        if (accountID !== 0) cell.accountID = accountID;
                        if (this.myCellIds.has(id)) {
                            this.targetX = targetX;
                            this.targetY = targetY;
                        }
                        if (this.myCellIds.has(id) && !this.ownCells.has(id)) {
                            this.ownCells.set(id, cell);
                            this.isPlay = true;
                        }
                        cell.setTarget(targetX, targetY, size);
                    }
                    const removeLength = view.getUint16(offset, true);
                    offset += 2;
                    for (let i = 0; i < removeLength; i++) {
                        const removedID = view.getUint32(offset, true);
                        offset += 4;
                        this.removeCell(this.cells.get(removedID));
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
    texts: Map<number, string> = new Map();
    drawMinimap(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, clear = true): number {
        function safe(number: number) {
            return number == 0 ? 1 : number;
        }
        if (clear) ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 0.5;
        this.minimap.forEach((cell) => {
            const x = (safe(cell.x + this.borderX / 2) / this.borderX) * canvas.width;
            const y = (safe(cell.y + this.borderY / 2) / this.borderY) * canvas.height;
            const size = (cell.size / this.borderX) * canvas.width + 1;
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
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
                const isAgar = /wasm:\/\/|wasm-function|WebAssembly.instantiate/.test(errorStack);
                const isAgarServer = url.includes('minic');
                if (isAgar && !isAgarServer) {
                    // window['core'].disableIntegrityChecks(true);
                }
                if (isAgar) self.emit('beforeConnect', url, isAgarServer);
                super(url, protocols);
                if (isAgar) Promise.resolve().then(() => self.overWriteWS(this));
            }
            static injectedOnce = false;
        }
        window.WebSocket = WS;
    }
}
