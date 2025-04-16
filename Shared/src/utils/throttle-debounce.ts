type ThrottleFunction<F extends (...args: any[]) => void> = (f: F, t: number) => (...args: Parameters<F>) => void;

type DebounceFunction<F extends (...args: any[]) => void> = (f: F, t: number) => (...args: Parameters<F>) => void;

export const throttle: ThrottleFunction<any> = (f, t) => {
    let lastCall: number | undefined;

    return (...args: Parameters<any>) => {
        const previousCall = lastCall;
        lastCall = Date.now();

        if (
            previousCall === undefined || // function is being called for the first time
            lastCall - previousCall > t
        ) {
            f(...args);
        }
    };
};

export const debounce: DebounceFunction<any> = (f, t) => {
    let lastCall: number | undefined;
    let lastCallTimer: NodeJS.Timeout | undefined;

    return (...args: Parameters<any>) => {
        const previousCall = lastCall;
        lastCall = Date.now();

        if (previousCall && lastCall - previousCall <= t) {
            if (lastCallTimer) {
                clearTimeout(lastCallTimer);
            }
        }

        lastCallTimer = setTimeout(() => f(...args), t);
    };
};

/**
 * example usage:
 * const throttled = throttleWithLimit(() => console.log('hello'), 1000, 5);
 */
export function throttleWithLimit<T extends (...args: IArguments[number]) => void, E extends (methodArgs: IArguments) => void>(
    handler: T,
    timeLimit: number,
    callLimit: number,
    handleError?: E,
    passContext: boolean = true
) {
    const shtraf = 0;
    let lastCallTime = 0;
    let firstMsgCallTime = 0;
    let maxQueue = 0;
    return function (this: unknown) {
        const now = performance.now();
        const firstCallElapsed = now - firstMsgCallTime;
        const lastCallElapsed = now - lastCallTime;

        if (lastCallElapsed < timeLimit) {
            maxQueue++;
            if (firstCallElapsed < timeLimit) {
            } else {
                lastCallTime += lastCallElapsed;
            }
        }
        if (firstCallElapsed > timeLimit) {
            firstMsgCallTime = now;
            maxQueue = 0;
        }
        if (maxQueue > callLimit) {
            firstMsgCallTime = now + shtraf;
            if (handleError !== undefined) {
                return (passContext ? handleError.call(this, arguments) : handleError(arguments)) as ReturnType<E>;
            } else {
                return;
            }
        }
        lastCallTime = now;
        // @ts-ignore
        return handler.apply(this, arguments) as ReturnType<T>;
    };
}
