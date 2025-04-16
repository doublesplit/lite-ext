type Constructor<T = {}> = new (...args: any[]) => T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConstructorABS<T = {}> = abstract new (...args: any[]) => T;

export function DebuggerMixin<T extends Constructor<{}> | ConstructorABS<{}>>(Base: T) {
    return class DebuggerBase extends Base {
        bindings: { [P in keyof Console]?: Console[P] } = {};
        prefix: string[] = [];
        proxyPrefix = false;
        timeLogging = false;
        _useProxy = false;
        isLogging = true;
        dummy() {}
        proxy: Console['log'] = () => {};

        resetBindings() {
            this.bindings = {};
        }

        set useProxy(value: boolean) {
            this.resetBindings();
            this._useProxy = value;
        }

        get useProxy(): boolean {
            this.resetBindings();
            return this._useProxy;
        }

        setPrefix(...prefix: string[]): void {
            this.resetBindings();
            this.prefix = prefix;
        }

        getBindinng<T extends Extract<keyof Console, string>>(method: T): Console[T] | (() => void) {
            if (!this.isLogging) return this.dummy;

            const time = this.timeLogging
                ? new Date().toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: 'numeric',
                      second: 'numeric',
                      hourCycle: 'h23'
                  })
                : null;
            if (time) this.bindings[method] = undefined;
            if (!this.useProxy) {
                this.bindings[method] ??= this.timeLogging
                    ? // @ts-ignore
                      console[method].bind(console, ...this.prefix, time)
                    : // @ts-ignore
                      console[method].bind(console, ...this.prefix);
                return this.bindings[method]!;
            } else {
                return (
                    this.bindings[method] ||
                    // @ts-ignore
                    (this.bindings[method] = new Proxy(console[method].bind(console[method]), {
                        apply: (target, thisArg, argumentsList) => {
                            if (this.proxyPrefix) this.proxy(method, [...this.prefix, ...argumentsList]);
                            else this.proxy(method, argumentsList);
                            return Reflect.apply(target, thisArg, argumentsList);
                        }
                    }))
                );
            }
        }

        get info() {
            return this.getBindinng('info');
        }
        get log() {
            return this.getBindinng('log');
        }
        get warn() {
            return this.getBindinng('warn');
        }
        get access() {
            return this.getBindinng('warn');
        }
        get debug() {
            return this.getBindinng('debug');
        }
        get error() {
            return this.getBindinng('error');
        }
        get fatal() {
            return this.getBindinng('error');
        }
        get print() {
            return this.getBindinng('log');
        }
        get trace() {
            return this.getBindinng('trace');
        }
        get groupCollapsed() {
            return this.getBindinng('groupCollapsed');
        }
    };
}

class Debgr extends DebuggerMixin(class {} as Constructor<{}>) {}
export { Debgr };
