import { BasicSetting } from './Settngs';
import MicroColor from './utils/microColor';
import { parseColorToInta } from './utils/microColorUtils';

export class Color extends BasicSetting {
    microcolor = new MicroColor();
    string = '#FFFFFF'; // hex or rgba
    alpha: boolean;
    useCss: boolean;
    constructor({
        value = '#FF00FFFF',
        useAlpha = false,
        useCss = false,
        path
    }: {
        value?: number | string;
        useAlpha?: boolean;
        useCss?: boolean;
        path?: string;
    }) {
        super({ path });
        this.type = 'COL';
        this.value = 0;

        // this.hexa = '#FF00FF66' // 8-Digit hex
        // this.vector = new Float32Array(4)
        // this.rgba = new Uint8Array(4)
        this.alpha = useAlpha;
        this.default = value;
        this.useCss = useCss;
        this.setter(value);
    }
    get export() {
        return this.microcolor.toHEX8();
    }
    toJSON() {
        return this.export;
    }
    setter(string_or_number: string | number) {
        let inta = 0;
        if (typeof string_or_number === 'string') {
            if (string_or_number[0] == '#' && (string_or_number.length == 7 || string_or_number.length == 9)) {
                inta = MicroColor.temp.fromHex(string_or_number).getInta();
            } else {
                inta = parseColorToInta(string_or_number);
            }
        } else {
            inta = string_or_number;
        }
        this.microcolor.fromINT(inta);
        this.value = inta;
        this.string = this.alpha ? this.microcolor.fromINT(inta).toRgb(this.alpha) : this.microcolor.fromINT(inta).getHEX();
    }
}
export class Select<T = string | number> extends BasicSetting<T> {
    options: Record<string, T>;
    constructor({ name, options = {}, value, path }: { name?: string; options: Record<string, T>; value: T; path?: string }) {
        super({ name, path });
        this.type = 'SEL';
        this.options = options;
        this.value = value;
        this.default = value;
        this.setter(value);
    }
    get export() {
        return this.value;
    }
    toJSON() {
        return this.export;
    }
    setter(data: T) {
        let isError = true;
        for (const [, value] of Object.entries(this.options)) {
            if (value === data) {
                isError = false;
            }
        }
        if (isError) {
            console.error('Select: Invalid value ', data, ', fallback to default', this, this.default);
            this.value = this.default;
            return;
        }
        this.value = data;
    }
}
export class Slider<T = number> extends BasicSetting<T> {
    min: number;
    max: number;
    step: number;
    useCss: boolean;
    dim: string;
    unit: string;
    precision: number;
    constructor({
        name,
        min,
        max,
        step,
        value,
        useCss = false,
        dim = '',
        unit = '',
        path
    }: {
        name?: string;
        min: number;
        max: number;
        step: number;
        value: T;
        useCss?: boolean;
        dim?: string;
        path?: string;
        unit?: string;
    }) {
        super({ name, path });
        this.type = 'SLD';
        this.min = min;
        this.max = max;
        this.step = step;
        this.value = value;
        this.default = value;
        this.useCss = useCss;
        this.dim = dim;
        this.unit = unit;
        this.precision = step.toString().split('.')[1]?.length || 0;
        this.setter(value);
    }
    get export() {
        return this.value;
    }
    toJSON() {
        return this.export;
    }
    setter(data: T) {
        if (typeof data !== 'number' || typeof data == 'undefined') data = this.default;
        this.value = data;
    }
}
export class Option<T = boolean> extends BasicSetting<T> {
    constructor({ name, value, path }: { name?: string; value: T; path?: string }) {
        super({ name, path });
        this.type = 'OPT';
        this.value = value;
        this.default = value;
        this.setter(value);
    }
    get export() {
        return this.value;
    }
    toJSON() {
        return this.export;
    }
    setter(data: T) {
        this.value = data;
    }
}
export class Input<T = string> extends BasicSetting<T> {
    csshook: (arg: T) => T;
    useCss: boolean;
    options: Record<string, string | number>;
    constructor({
        name,
        value,
        csshook = (s) => s,
        path,
        useCss = false,
        options = {}
    }: {
        name?: string;
        value: T;
        csshook?: (arg: T) => T;
        path?: string;
        useCss?: boolean;
        options?: Record<string, string | number>;
    }) {
        super({ name, path });
        this.type = 'INP';
        this.value = value;
        this.default = value;
        this.csshook = csshook;
        this.useCss = useCss;
        this.options = options;
        this.setter(value);
    }
    get export() {
        return this.value;
    }
    toJSON() {
        return this.export;
    }
    setter(data: T) {
        if (typeof data !== 'string' || typeof data == 'undefined') data = this.default;
        this.value = String(data) as T;
    }
    cssValue() {
        return this.csshook ? this.csshook(this.value) : this.value;
    }
}
