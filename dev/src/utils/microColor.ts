export default class MicroColor {
    r: number;
    g: number;
    b: number;
    a: number;
    vector: Float32Array;
    bytes: Uint8Array;
    dataview: DataView;
    // representation rgba in float number
    float: number;
    u32: number;
    string: string;
    int: number;
    inta: number;
    static int8: Int8Array;
    static int32: Int32Array;
    static float32: Float32Array;
    static {
        this.int8 = new Int8Array(4);
        this.int32 = new Int32Array(this.int8.buffer, 0, 1);
        this.float32 = new Float32Array(this.int8.buffer, 0, 1);
    }
    static temp = new MicroColor();
    constructor(red = 255, green = 255, blue = 255, alpha = 255) {
        this.r = red;
        this.g = green;
        this.b = blue;
        this.a = alpha;
        this.vector = new Float32Array(4);
        this.bytes = new Uint8Array(4);
        this.dataview = new DataView(this.bytes.buffer);
        this.string = '#000000';
        this.int = 0;
        this.inta = 0;
        this.updVector();
        this.updString();
        this.updInt();
    }
    updVector() {
        this.vector[0] = this.r / 255;
        this.vector[1] = this.g / 255;
        this.vector[2] = this.b / 255;
        this.vector[3] = this.a / 255;

        this.bytes[0] = this.r;
        this.bytes[1] = this.g;
        this.bytes[2] = this.b;
        this.bytes[3] = this.a;
        this.float = this.dataview.getFloat32(0, true);
        this.u32 = this.r | (this.g << 8) | (this.b << 16) | (this.a << 24);
        // for (let i = 0; i < 4; i++) {
        //     this.u32 |= this.bytes[i] << (8 * i);
        // }
    }
    updString() {
        this.string = this.toRgb(true);
    }
    updInt() {
        this.int = this.getInt();
        this.inta = this.getInta();
    }
    cloneFrom(t: MicroColor) {
        this.r = t.r;
        this.g = t.g;
        this.b = t.b;
        this.a = t.a;
        this.updVector();
        this.updString();
        return this;
    }

    fromHSL(h: number, s: number, l: number, a = 255) {
        s /= 100;
        l /= 100;

        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;
        let r = 0;
        let g = 0;
        let b = 0;

        if (0 <= h && h < 60) {
            (r = c), (g = x), (b = 0);
        } else if (60 <= h && h < 120) {
            (r = x), (g = c), (b = 0);
        } else if (120 <= h && h < 180) {
            (r = 0), (g = c), (b = x);
        } else if (180 <= h && h < 240) {
            (r = 0), (g = x), (b = c);
        } else if (240 <= h && h < 300) {
            (r = x), (g = 0), (b = c);
        } else if (300 <= h && h < 360) {
            (r = c), (g = 0), (b = x);
        }
        // Having obtained RGB, convert channels to hex
        this.r = Math.round((r + m) * 255);
        this.g = Math.round((g + m) * 255);
        this.b = Math.round((b + m) * 255);
        this.a = a;
        return this;
    }
    fromRGB(r: number, g: number, b: number, a = 255) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
        this.updVector();
        this.updString();
        return this;
    }
    // fromINTA(int: number, alpha = 255) {
    //     const a = (int >> 24) & alpha;
    //     return this.fromINT(color);
    // }
    fromINT(int: number, reorder?: boolean) {
        this.a = (4278190080 & int) >>> 24;
        this.r = (16711680 & int) >>> 16;
        this.g = (65280 & int) >>> 8;
        this.b = (255 & int) >>> 0;
        if (reorder) Object.assign(this, { r: this.a, g: this.r, b: this.g, a: this.b });
        this.updVector();
        this.updString();
        return this;
    }
    fromHex(hex: string) {
        const len = hex.length;
        if (!hex || (len !== 7 && len !== 9)) return this;

        let i = hex.length === 9 ? 32 : 24;
        const n = parseInt(hex.slice(1), 16);
        const r = (n >> (i -= 8)) & 255;
        const g = (n >> (i -= 8)) & 255;
        const b = (n >> (i -= 8)) & 255;
        const a = i ? (n >> (i - 8)) & 255 : 255;

        return this.fromRGB(r, g, b, a);
    }
    get getNormalFromSecure() {
        return MicroColor.rgbToInt(Math.ceil(this.r / 0.9), Math.ceil(this.g / 0.9), Math.ceil(this.b / 0.9));
    }
    toRgb(useAlpha?: boolean) {
        return useAlpha ? `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a / 255})` : `rgb(${this.r}, ${this.g}, ${this.b})`;
    }
    getHEXA() {
        let r = this.r.toString(16);
        let g = this.g.toString(16);
        let b = this.b.toString(16);
        let a = this.a.toString(16);

        if (r.length == 1) r = '0' + r;
        if (g.length == 1) g = '0' + g;
        if (b.length == 1) b = '0' + b;
        if (a.length == 1) a = '0' + a;
        return '#' + r + g + b + a;
    }
    getFloat() {
        const bits = (this.a << 24) | (this.b << 16) | (this.g << 8) | this.r;
        return MicroColor.pack(bits & 0xfeffffff);
    }
    getHEX() {
        return '#' + (16777216 | this.getInt()).toString(16).substring(1);
    }
    getInt() {
        return (this.r << 16) | (this.g << 8) | this.b;
    }
    getIntaShader(alpha: number) {
        return this.r | (this.g << 8) | (this.b << 16) | ((alpha < 0 ? this.a : alpha) << 24);
    }
    getIntShader() {
        return this.r | (this.g << 8) | (this.b << 16);
    }
    getInta() {
        return (this.a << 24) | (this.r << 16) | (this.g << 8) | this.b;
    }
    getSecureHex() {
        return MicroColor.colorIntToHex(MicroColor.rgbToInt(~~(this.r * 0.9), ~~(this.g * 0.9), ~~(this.b * 0.9)));
    }
    static rgbToInt(r: number, g: number, b: number) {
        return (r << 16) | (g << 8) | b;
    }
    static colorIntToHex(int: number) {
        let s = int.toString(16);
        for (; s.length < 6; ) {
            s = '0' + s;
        }
        return '#' + s;
    }

    static isValidHex = (hex: string) => /^#([A-Fa-f0-9]{3,4}){1,2}$/.test(hex);
    static getChunksFromString = (st: string, chunkSize: number): string[] => st.match(new RegExp(`.{${chunkSize}}`, 'g')) as string[];
    static convertHexUnitTo256 = (hexStr: string) => parseInt(hexStr.repeat(2 / hexStr.length), 16);
    static getAlphafloat = (a: number, alpha: number) => {
        if (typeof a !== 'undefined') {
            return a / 255;
        }
        if (typeof alpha != 'number' || alpha < 0 || alpha > 1) {
            return 1;
        }
        return alpha;
    };
    static inta2shader(int: number) {
        const a = (0xff000000 & int) >>> 24;
        const r = (0xff0000 & int) >>> 16;
        const g = (0xff00 & int) >>> 8;
        const b = (0xff & int) >>> 0;
        return r | (g << 8) | (b << 16) | (a << 24);
    }
    static hexToRGBA = (hex: string) => {
        if (!MicroColor.isValidHex(hex)) {
            throw new Error('Invalid HEX');
        }
        const chunkSize = Math.floor((hex.length - 1) / 3);
        const hexArr = MicroColor.getChunksFromString(hex.slice(1), chunkSize);
        return hexArr.map(MicroColor.convertHexUnitTo256);
    };
    toHEX8() {
        return `#${(16777216 | this.getInt()).toString(16).substring(1)}${this.a.toString(16).padStart(2, '0')}`;
    }
    static pack(i: number) {
        MicroColor.int32[0] = i;
        return MicroColor.float32[0];
    }

    static unpack(f: number) {
        MicroColor.float32[0] = f;
        return MicroColor.int32[0];
    }
    static darkenColor(color: string | number, percent: number) {
        const num = typeof color == 'string' ? parseInt(color, 16) : color,
            amt = Math.round(2.55 * percent),
            R = (num >> 16) + amt,
            B = ((num >> 8) & 0x00ff) + amt,
            G = (num & 0x0000ff) + amt;
        return (255 << 24) | (R << 16) | (G << 8) | B;
    }
    static brighten(int: number, amount: number = 10) {
        const a = (4278190080 & int) >>> 24;
        let r = (16711680 & int) >>> 16;
        let g = (65280 & int) >>> 8;
        let b = (255 & int) >>> 0;

        r = Math.max(0, Math.min(255, r - Math.round(255 * -(amount / 100))));
        g = Math.max(0, Math.min(255, g - Math.round(255 * -(amount / 100))));
        b = Math.max(0, Math.min(255, b - Math.round(255 * -(amount / 100))));
        return (a << 24) | (r << 16) | (g << 8) | b;
    }
    static multiplyAlpha(int: number, alpha: number): number {
        return ((((int >>> 24) * alpha) & 0xff) << 24) | (int & 0x00ffffff);
    }
}
