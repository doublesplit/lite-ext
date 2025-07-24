let measureCanvas: HTMLCanvasElement = null;

export default class TC {
    private text = '';
    private trimmedText = '';
    private fontSize = 24;
    private fontWeight = 400;
    private fontFamily = 'Arial';
    private lineWidth = 0;
    private strokeStyle = '#000000';
    private fillStyle = '#ffffff';
    x = 0;
    y = 0;
    w = 0;
    h = 0;
    originX = 0.0;
    originY = 0.0;
    dirty = false;
    dirtyId = 0;
    c: HTMLCanvasElement | OffscreenCanvas = null;
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D = null;
    private dpr = Infinity;
    constructor() {
        this.init();
    }
    setDpr(dpr: number) {
        if (this.dpr === dpr) return;
        this.dpr = dpr;
        this.dirty = true;
    }
    setFont(fontSize: number, fontWeight: number, fontFamily: string) {
        this.fontSize = fontSize;
        this.fontWeight = fontWeight;
        this.fontFamily = fontFamily;
        this.dirty = true;
    }
    setStyle(strokeStyle: string, fillStyle: string, lineWidth: number) {
        this.strokeStyle = strokeStyle || '#000000';
        this.fillStyle = fillStyle || '#ffffff';
        this.lineWidth = lineWidth || 0;
        this.dirty = true;
    }
    measureText(text: string, fontWeight: number, fontSize: number, fontFamily: string) {
        measureCanvas ??= document.createElement('canvas') as HTMLCanvasElement;
        const canvas = measureCanvas;
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const w = ctx.measureText(text).width;
        const h = fontSize * 1.5;
        return { width: w, height: h };
    }

    init(text?: string) {
        this.setText(text);
        this.c = document.createElement('canvas') as HTMLCanvasElement;
        this.ctx = this.c.getContext('2d');
        return this;
    }

    setText(text?: string) {
        if (text && text !== this.text) {
            this.text = text + '';
            this.trimmedText = text.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
            this.dirty = true;
        }
        return this.dirty;
    }
    update(dirtyId: number) {
        this.dirty = this.dirty || this.dirtyId !== dirtyId;
        if (this.dirtyId !== dirtyId) this.dirtyId = dirtyId;
        // Measure phase
        if (this.dirty) this.measure();
    }
    measure() {
        const m = this.measureText(this.trimmedText, this.fontWeight, this.fontSize, this.fontFamily);
        this.w = this.c.width = m.width;
        this.h = this.c.height = m.height;
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.render();
        if (this.w === 0 || this.h === 0) return;
        try {
            ctx.drawImage(this.c, ~~(this.x - this.originX * this.w), ~~(this.y - this.originY * this.h));
        } catch (e) {
            // todo
            console.error(e, 'Fatal error in TC.draw', this, this.c, ~~(this.x - this.originX * this.w), ~~(this.y - this.originY * this.h));
            if (!globalThis['Fatal tc.draw']) {
                globalThis['Fatal tc.draw'] = true;
            }
        }
    }
    render() {
        if (this.dirty === false) return;
        this.ctx.lineJoin = 'round';
        this.ctx.font = `${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
        this.ctx.fillStyle = this.fillStyle;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        if (this.lineWidth > 0) {
            this.ctx.lineWidth = this.lineWidth;
            this.ctx.strokeStyle = this.strokeStyle;
            this.ctx.strokeText(this.trimmedText, this.w >> 1, this.h >> 1);
        }
        this.ctx.fillText(this.trimmedText, this.w >> 1, this.h >> 1);
        this.dirty = false;
    }
}
