export function vh(v: number) {
    const h = window.innerHeight;
    return (v * h) / 100;
}

export function vw(v: number) {
    const w = window.innerWidth;
    return (v * w) / 100;
}

export function vmin(v: number) {
    return Math.min(vh(v), vw(v));
}

export function vmax(v: number) {
    return Math.max(vh(v), vw(v));
}
export function gcd(a = window.innerWidth, b = window.innerHeight) {
    return b == 0 ? a : gcd(b, a % b);
}
