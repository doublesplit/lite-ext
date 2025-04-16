export class Sampler {
    samplerIndex = 0;
    sampler = new Float32Array(30).fill(0);
    averagePerSecond = 0;
    renderedFrames = 0;
    average = 0;
    now: number = 0;
    step() {
        const now = Date.now();
        const elapsed = now - this.now;
        this.now = now;
        const delta = elapsed / 1000;
        const perSecond = 1 / delta;
        let average = 0;
        let howmuchSamples = 0;
        this.sampler[this.samplerIndex] = Math.round(perSecond);
        this.samplerIndex = (this.samplerIndex + 1) % this.sampler.length;
        for (let i = 0; i < Math.min(this.sampler.length, this.renderedFrames); i++) {
            average += this.sampler[i];
            howmuchSamples++;
        }
        average = Math.round(average / howmuchSamples);
        this.average = average;
        if (this.renderedFrames <= this.sampler.length) this.renderedFrames++;
    }
}
