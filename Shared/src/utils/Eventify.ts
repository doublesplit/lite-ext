// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OmitFirst<T extends any[]> = T extends [any, ...infer R] ? R : never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OmitLast<T extends any[]> = T extends [...infer R, any] ? R : never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = {}> = new (...args: any[]) => T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConstructorABS<T = {}> = abstract new (...args: any[]) => T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LISTENER = (...agr: any[]) => void;
type EVENT = string | number;

type Listener = (...args: any[]) => Promise<any> | void;
export type _DefaultEventMap = {
    [event in string | symbol | number]: LISTENER;
} & {
    /**
     * __proto__ key not allowed due to implementation
     * add prefix, if you want to use this keyword
     */
    __proto__?: never;
};

type EventsMemory<EventMap extends _DefaultEventMap = _DefaultEventMap> = { [K in keyof EventMap]: LISTENER[] };
type EventName<EventMap extends _DefaultEventMap> = keyof EventMap;
type EventNames<EventMap extends _DefaultEventMap> = Array<EventName<EventMap>>;
// https://stackoverflow.com/questions/50071115/typescript-promise-rejection-type
//https://github.com/microsoft/TypeScript/issues/24122
export function EventMixin<
    BaseClass extends Constructor<{}> | ConstructorABS<{}> = Constructor<{}> | ConstructorABS<{}>,
    DefaultEventMap extends _DefaultEventMap = _DefaultEventMap
>(Base: BaseClass) {
    class EventifyBase<EventMap extends DefaultEventMap = DefaultEventMap> extends Base {
        /* Stores events */
        events: EventsMemory<EventMap> = {} as EventsMemory<EventMap>;
        /* Stores delegated events */
        // ev: Array<[EventifyBase, EventName<EventMap>, LISTENER]> = [];
        ev: Array<{
            delegated: EventifyBase;
            event: EventName<EventMap>;
            listener: LISTENER;
        }> = [];
        blockRemovingListeners = false;
        on<T = LISTENER>(...rest: [EventName<EventMap>, ...EventNames<EventMap>, T]): T {
            if (rest.length < 2) throw new Error('Eventify.on() need at least 2 arguments');
            const length = rest.length;
            const listener = rest[length - 1] as LISTENER;
            for (let i = 0; length - 1 > i; i++) {
                const event = rest[i] as EventName<EventMap>;
                if (typeof this.events[event] !== 'object') {
                    this.events[event] = [];
                }
                this.events[event].push(listener);
            }
            return listener as T;
        }

        removeListener(event: EventName<EventMap>, listener: LISTENER) {
            if (typeof this.events[event] === 'object') {
                const idx = this.events[event].indexOf(listener);
                if (idx > -1) {
                    this.events[event].splice(idx, 1);
                }
                if (this.events[event].length === 0) {
                    delete this.events[event];
                }
            }
        }
        emit<EventKey extends keyof EventMap>(event: EventKey, ...rest: Parameters<EventMap[EventKey]>) {
            // this.blockRemovingListeners = true;
            if (typeof this.events[event] === 'object') {
                const listeners = this.events[event].slice();

                for (const listener of listeners) {
                    listener.apply(this, rest);
                }
            }
            // this.blockRemovingListeners = false;
        }
        once(event: EventName<EventMap>, listener: LISTENER) {
            const once_listener = (...args: unknown[]) => {
                this.removeListener(event, once_listener);
                listener.apply(this, args);
            };
            this.on(event, once_listener);
            return once_listener;
        }
        waitTimeout<T>(event: EventName<EventMap>, timeout: number, abortController?: AbortController): Promise<T | null> {
            const ret = this.waitfor<T | null, (resolve: (v: T) => void, reject: (e: Error) => void) => () => void>(event, (_, rejector) => {
                const timeoutId = setTimeout(() => {
                    const error = new Error(`Waiting "${event.toString()}" Timeout`);
                    error.cause = 'timeout';
                    rejector(error);
                }, timeout);
                if (abortController) {
                    function abort() {
                        clearTimeout(timeoutId);
                        const error = new Error(`Waiting "${event.toString()}" Aborted`);
                        error.cause = 'aborted';
                        rejector(error);
                    }
                    if (abortController.signal.aborted) {
                        abort();
                    } else {
                        abortController.signal.addEventListener('abort', abort, { once: true });
                    }
                }
                return () => {
                    clearTimeout(timeoutId);
                };
            });
            return ret;
        }
        waitfor<V, T extends (resolve: (v: V) => void, reject: () => void) => () => void>(event: EventName<EventMap>, reject_callback: T) {
            return new Promise<V>((_resolve, _reject) => {
                let destroyCallbackCalled = false;
                const removeListener = () => {
                    this.removeListener(event, resolver);
                    this.removeListener(event, rejector);
                    if (destroyCallbackCalled) return;
                    destroyCallbackCalled = true;
                    destroyRejectCallback();
                };

                function resolver(v: V) {
                    _resolve(v);
                    removeListener();
                }
                function rejector(e: Error) {
                    _reject(e);
                    removeListener();
                }
                // @ts-ignore
                const destroyRejectCallback = reject_callback(resolver, rejector);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const self = this as unknown as EventifyBase<EventMap>;
                self.listenSelf(event, resolver);
                self.listenSelf(event, rejector);
            });
        }
        delegateTo<L extends LISTENER, TRMAP extends DefaultEventMap, TRGBASE extends EventifyBase<TRMAP>>(
            target: TRGBASE,
            ...rest: [...EventNames<EventMap>, L]
        ): L {
            if (arguments.length < 3) throw new Error('Eventify.delegateTo() need at least 3 arguments');
            const length = rest.length,
                listener = rest[length - 1] as L;
            for (let i = 0; length - 1 > i; i++) {
                const event = rest[i] as EventName<EventMap>;
                if (typeof target.events[event as EventName<TRMAP>] !== 'object') {
                    target.events[event as EventName<TRMAP>] = [];
                }
                const _target = target as EventifyBase<TRMAP>;
                target.ev.push({
                    delegated: this as EventifyBase<DefaultEventMap>,
                    event: event as EventName<TRMAP>,
                    listener: listener
                });
                this.on(event, listener);
            }
            return listener;
        }
        listenTo<TRMAP extends DefaultEventMap, E extends EventifyBase<TRMAP>, L extends LISTENER>(
            target: E,
            ...rest: [...OmitLast<OmitFirst<Parameters<E['delegateTo']>>>, L]
        ): L {
            return target.delegateTo<L, EventMap, EventifyBase<EventMap>>(this, ...rest);
        }
        listenSelf(this: EventifyBase<EventMap>, ...rest: [...EventNames<EventMap>, LISTENER]) {
            return this.listenTo(this, ...rest);
        }
        /**
         * Removes delegated events
         */
        unlisten() {
            const before = this.ev.slice();
            for (let i = 0; before.length > i; i++) {
                const target = before[i].delegated;
                const eventName = before[i].event as EventName<DefaultEventMap>;
                const listener = before[i].listener;
                target.removeListener(eventName, listener);
                const idx = this.ev.indexOf(before[i]);
                if (idx > -1) this.ev.splice(idx, 1);
            }
            if (this.ev.length > 0) {
                console.error('We have error in unlisten()', before, this.ev);
            }
        }
    }
    return EventifyBase as unknown as new <T extends DefaultEventMap = DefaultEventMap>(
        ...args: ConstructorParameters<BaseClass>
    ) => EventifyBase<T> & InstanceType<BaseClass>;
}
class Eventify<DefaultEventMap extends _DefaultEventMap = _DefaultEventMap> extends EventMixin(class {})<DefaultEventMap> {}
export { Eventify };
// const es = new Eventify<{ lol: () => void }>();
// es.on('lol', () => {});

export type EventifyInstance = InstanceType<typeof Eventify<{}>>;
/* LIB : EVENTIFY ANY OBJECT */
const props = [
    'on',
    'removeListener',
    'emit',
    'once',
    'listenTo',
    'delegateTo',
    'listenSelf',
    'unlisten',
    'ev',
    'events',
    'waitfor',
    'waitTimeout'
] as const;
export const eventify = function <T extends Object>(object: T) {
    const EVENTIFY = new Eventify();
    props.forEach((key) => {
        Object.defineProperty(object, key, { value: EVENTIFY[key], enumerable: false, writable: false });
    });
    return object as unknown as { [K in (typeof props)[number]]: EventifyInstance[K] };
};

type ObjectToEventMap<OBJ> = { [K in keyof OBJ]: (current: OBJ[K], previous: OBJ[K]) => void };

export type EventObjectEvents<OBJ> = ObjectToEventMap<OBJ> & {
    [K in keyof OBJ as `change:${string & K}`]: (current: OBJ[K], previous: OBJ[K]) => void;
} & {
    '*': (key: keyof OBJ, current: OBJ[keyof OBJ], previous: OBJ[keyof OBJ]) => void;
    'before*': (key: keyof OBJ, current: OBJ[keyof OBJ]) => void;
    'change:*': (key: keyof OBJ, current: OBJ[keyof OBJ]) => void;
};
type _EventObject<OBJ> = typeof Eventify<EventObjectEvents<OBJ>>;

export function EventObject<
    OBJ extends Record<EventKey, any>,
    EventMap extends ObjectToEventMap<OBJ> = ObjectToEventMap<OBJ>,
    EventKey extends keyof EventMap = keyof EventMap
>(object: OBJ) {
    // = instead extends
    const _Eventify = eventify(object) as InstanceType<_EventObject<OBJ>>;
    const eventObject = new Proxy(object, {
        set(target: OBJ, prop: Extract<keyof OBJ, string>, val: unknown) {
            const prev = object[prop];
            const curr = val;
            // @ts-ignore
            _Eventify.emit('before*', prop, val);
            //@ts-ignore
            object[prop] = val;
            try {
                // @ts-ignore
                _Eventify.emit(prop, val, prev);
                if (prev !== curr) {
                    // @ts-ignore
                    _Eventify.emit('change:*', prop, val); // @ts-ignore

                    _Eventify.emit(('change:' + String(prop)) as E, val, prev);
                }
                // @ts-ignore
                _Eventify.emit('*', prop, val, prev);
            } catch (message) {
                console.error(message);
            }
            return true;
        }
    });
    Object.defineProperty(eventObject, 'raw', {
        get() {
            return object;
        }
    });
    return eventObject as unknown as InstanceType<_EventObject<OBJ>> & OBJ;
    // return eventObject as EventObjectReturnType<OBJ>;
}

export function deferrify<T, R = unknown>(params?: { signal: AbortSignal | Promise<unknown> }) {
    let resolve = null as unknown as (value: T | PromiseLike<T>) => void;
    let reject = null as unknown as (reason?: R) => void;

    const promise = new Promise<T>((resolveFunc, rejectFunc) => {
        resolve = resolveFunc;
        reject = rejectFunc;
        if (params?.signal instanceof Promise) {
            params.signal.catch(reject);
        } else if (params?.signal?.aborted) {
            reject();
        }
    });
    return { promise, resolve, reject };
}

export class Promised<T> extends Promise<T> {
    resolve!: (value: T | PromiseLike<T>) => void;
    reject!: (reason?: any) => void;
    constructor(executor: ConstructorParameters<PromiseConstructor>['0']) {
        super((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            // @ts-ignore
            if (executor !== undefined) executor(resolve, reject);
        });
    }
}

export const sleep = (delay: number) =>
    function chainDelay<T>(args?: T) {
        return new Promise<T | undefined>((res) => {
            setTimeout(() => res(args), delay);
        });
    };

/** Converts enum to EventMap */
export type EnumToEventMap<T extends Record<string, any>> = {
    [K in T[keyof T] as `${Extract<K, string>}`]?: any;
};
/** Converts interface to EventMap */
export type EventTypesToEventMap<T extends Record<string, any>> = { [K in keyof T as `${Extract<K, string>}`]: T[K] };
export type EventTypesToEventMapStrict<T extends Record<string, any>> = { [K in keyof T as Extract<K, string>]: T[K] };
