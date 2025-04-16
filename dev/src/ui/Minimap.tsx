import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { settings } from '../settings';
import { AppContext } from './Contexts';

export default function Minimap() {
    const app = useContext(AppContext);
    const [minimapEnabled, setMinimapEnabled] = useState(settings.raw.Minimap);
    const $canvas = useRef<HTMLCanvasElement>(null);
    const $sectors = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const ctx = $canvas.current.getContext('2d');
        const sectors = $sectors.current.querySelectorAll('.sector') as NodeListOf<HTMLDivElement>;
        let sectorIndex = -1;
        let rafId: number;

        function render() {
            const sectorId = app.world.drawMinimap(ctx, $canvas.current);
            setSector(sectorId);
            rafId = requestAnimationFrame(render);
        }

        function setSector(index: number) {
            if (index === sectorIndex || index < 0) return;
            index = Math.min(index, sectors.length - 1);
            sectorIndex !== -1 && sectors[sectorIndex].classList.remove('active');
            sectors[index].classList.add('active');
            sectorIndex = index;
        }

        if (minimapEnabled) rafId = requestAnimationFrame(render);

        const minimapListener = settings.on('Minimap', (value) => setMinimapEnabled(value));
        return () => {
            settings.removeListener('Minimap', minimapListener);
            cancelAnimationFrame(rafId);
        };
    }, []);

    return (
        <div id="ds-minimap" style={{ zIndex: 1000 }}>
            <div class="background" ref={$sectors}>
                <div class="sector">A1</div>
                <div class="sector">A2</div>
                <div class="sector">A3</div>
                <div class="sector">A4</div>
                <div class="sector">A5</div>
                <div class="sector">B1</div>
                <div class="sector">B2</div>
                <div class="sector">B3</div>
                <div class="sector">B4</div>
                <div class="sector">B5</div>
                <div class="sector">C1</div>
                <div class="sector">C2</div>
                <div class="sector">C3</div>
                <div class="sector">C4</div>
                <div class="sector">C5</div>
                <div class="sector">D1</div>
                <div class="sector">D2</div>
                <div class="sector">D3</div>
                <div class="sector">D4</div>
                <div class="sector">D5</div>
                <div class="sector">E1</div>
                <div class="sector">E2</div>
                <div class="sector">E3</div>
                <div class="sector">E4</div>
                <div class="sector">E5</div>
            </div>
            <canvas id="minimap" width="200" height="200" ref={$canvas}></canvas>
        </div>
    );
}
