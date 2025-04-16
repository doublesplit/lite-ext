let canvas: HTMLCanvasElement | undefined;
let ctx: CanvasRenderingContext2D | undefined;
export function parseColorToInta(input: string): number {
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        ctx = canvas.getContext('2d');
    }

    if (!ctx) return 0;

    ctx.clearRect(0, 0, 1, 1);

    try {
        ctx.fillStyle = input;
    } catch {
        return 0;
    }

    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;

    return (a << 24) | (r << 16) | (g << 8) | b;
}
