import { Inputs, useEffect, useMemo } from 'preact/hooks';
import { _DefaultEventMap, Eventify, EventObject } from '../../../../Shared/src/utils/Eventify';
import { gcd, vh, vw } from '../../utils/minmax';

export const scaling = EventObject({
    uiScale: 1
});

function calcScale() {
    const gc = gcd();
    let sizeOfMap = 1;
    const { w, h } = { w: 4, h: 3 };
    if ((gc * window.innerWidth) / (gc * window.innerHeight) > w / h) {
        sizeOfMap = vh(27) / 200;
    } else {
        sizeOfMap = (h * vw(27)) / w / 200;
    }
    scaling.uiScale = Math.min(1, sizeOfMap);
}
window.addEventListener('resize', calcScale);
calcScale();

export function useEventify<DefaultEventMap extends _DefaultEventMap = any>(
    effect: (eventify: InstanceType<typeof Eventify<DefaultEventMap>>) => void | (() => void),
    deps?: Inputs
) {
    const eventify = useMemo(() => new Eventify<DefaultEventMap>(), []);
    useEffect(() => {
        const destroy = effect(eventify);
        return () => {
            if (destroy) destroy();
            eventify.unlisten();
        };
    }, deps);
}
