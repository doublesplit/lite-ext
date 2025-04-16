import { Eventify } from '../../Shared/src/utils/Eventify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class BasicSetting<V = any> {
    exportable = true;
    path?: string;
    name?: string;
    type = 'NONE';
    private _value: V = null as unknown as V;
    default: V = null as unknown as V;
    constructor({ path = 'DEFAULT', name = '' }: { path?: string; name?: string }) {
        this.path = path;
        this.name = name;
    }
    get value() {
        return this._value;
    }
    set value(data: V) {
        this._value = data;
    }
    setter(data: V) {
        this.value = data;
    }
    get export() {
        return this.value;
    }
}

type ObjectToEventMap<OBJ extends Record<string, BasicSetting>> = {
    [K in keyof OBJ]: (current: OBJ[K]['value'], previous: OBJ[K]['value']) => void;
};
type BuiltInEvents<
    OBJ extends Record<EventKey, BasicSetting>,
    EventMap extends ObjectToEventMap<OBJ> = ObjectToEventMap<OBJ>,
    EventKey extends keyof EventMap = keyof EventMap
> = {
    'before*': (key: EventKey, newValue: OBJ[EventKey]['value']) => void;
    '*': (key: EventKey, newValue: OBJ[EventKey]['value'], prvValue: OBJ[EventKey]['value']) => void;
};

export class Settings<
    OBJ extends Record<EventKey, BasicSetting>,
    EventMap extends ObjectToEventMap<OBJ> = ObjectToEventMap<OBJ>,
    EventKey extends keyof EventMap = keyof EventMap
> extends Eventify<EventMap & BuiltInEvents<OBJ>> {
    raw: { readonly [K in keyof OBJ]: OBJ[K] };
    proxy: InstanceType<typeof Proxy<{ [K in keyof OBJ]: OBJ[K]['value'] }>>;
    constructor(descriptions: OBJ) {
        super();
        this.raw = descriptions;
        const self: Eventify<BuiltInEvents<OBJ>> = this as Eventify<BuiltInEvents<OBJ>>;
        this.proxy = new Proxy(this.raw, {
            set: (target: OBJ, prop: Exclude<EventKey, number>, newValue: OBJ[EventKey]['value']) => {
                const previous = target[prop].value as OBJ[EventKey]['value'];
                self.emit('before*', prop, newValue); // before set
                target[prop].setter(newValue);
                try {
                    newValue !== previous && self.emit.call(this, prop, newValue, previous); // on set
                    newValue !== previous && self.emit('*', prop, newValue, previous); // on any
                } catch (message) {
                    console.error(message);
                }
                return true;
            },
            get(target: OBJ, prop: Exclude<EventKey, number>) {
                return target[prop].value;
            }
        });
    }
    import(object: Record<string, ReturnType<(typeof JSON)['parse']>>) {
        if (!object) return;
        for (const option in this.raw) {
            if (this.raw.hasOwnProperty(option) && object.hasOwnProperty(option)) {
                this.proxy[option] = object[option];
            }
        }
    }
    export() {
        const export_data = {} as { [K in keyof OBJ]: OBJ[K]['value'] };
        for (const option in this.raw) {
            export_data[option] = this.raw[option].export;
        }
        return export_data;
    }
    restore() {
        for (const opt in this.raw) {
            const option: Extract<keyof OBJ, string> = opt;
            if (this.raw.hasOwnProperty(option)) {
                this.proxy[option] = this.raw[option].default;
            }
        }
    }
}
