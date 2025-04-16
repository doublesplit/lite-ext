export function makeGLobal<T>(name: string, value: T) {
    window[name] = value;
    return value;
}
