import { find_node, overrideMethod } from './utils/utils';

export function coreInitPatch() {
    overrideMethod(window['core'], 'setFpsCap', (originalMethod) => {
        return originalMethod(-1);
    });
}

export function coreUiPatch() {
    document.querySelector('#title').innerHTML = 'Doublesplit';
}

export function coreAdsPatch() {
    // Ads delete
    find_node(undefined, (child) => {
        return child.$vnode?.tag.includes('-ads');
    })[0]?.$destroy();
    find_node(undefined, (child) => {
        return child.$vnode?.tag.includes('-promo');
    })[0]?.$destroy();
    find_node(undefined, (child) => {
        return child.elm?.id?.includes('agar-io');
    }).forEach((child) => {
        child.elm.parentElement?.removeChild(child.elm);
    });

    find_node(undefined, (child) => child.playVideoAd).forEach((elem) => {
        elem.getVideoTimestamp = () => Date.now();
    });

    {
        const vnode = find_node(undefined, (child) => Object.getPrototypeOf(child).hasOwnProperty('hasBottomAd'))?.[0];
        if (vnode) {
            Object.defineProperties(vnode, {
                fastEntry: { get: () => true }
            });
        }
    }

    // Youtube, FB buttons
    {
        const vnode = find_node(undefined, (child) => {
            if (child?.elm?.id == 'socialButtons') return true;
        })[0];
        if (vnode) {
            vnode.elm.parentElement.removeChild(vnode.elm);
        }
    }

    // Skin floating badge
    {
        const bubble = find_node(undefined, (child) => child.data?.staticClass?.includes('bubble'))[0];
        bubble?.elm?.parentElement.removeChild(bubble?.elm);
    }

    {
        const vnode = find_node(undefined, (child) => Object.getPrototypeOf(child).hasOwnProperty('hasBottomAd'))?.[0];
        if (vnode) {
            ['hasBottomAd', 'hasSideAds'].map((prop) => {
                vnode._computedWatchers[prop]['getter'] = () => false;
            });
            Object.defineProperties(vnode, {
                hasBottomAd: { get: () => false },
                // hasSideAds: {get:()=> false},
                // hasTopAd: {get:()=> false},
                // showSideBanners: {get:()=> false},
                // showBottomBanners: {get:()=> false},
                fastEntry: { get: () => true }
            });
        }
    }

    document.documentElement.style.setProperty(`--bottom-banner-height`, '0px');

    let agarapp = window['agarApp'];
    Object.defineProperty(window, 'agarApp', {
        get() {
            return agarapp;
        },
        set(value) {
            agarapp = value;
            onAgarApp();
        }
    });

    function onAgarApp() {
        window['agarApp'].ads ??= {};
        Object.assign(window['agarApp'].ads, {
            requestAds() {},
            requestAd() {},
            refreshAd() {},
            destroyAd() {},
            adSlots() {},
            enableTargetedAds() {},
            disableTargetedAds() {},
            isTargeted() {},
            supersonicAds: {
                BrandConnectReadyEvent() {},
                BrandConnectDoneEvent() {},
                BrandConnectOpenEvent() {},
                BrandConnectCloseEvent() {},
                BrandConnectCompletedEvent() {},
                hasEngagement() {
                    return false;
                }
            }
        });

        if (window['agarApp']?.main)
            [
                'sendEndSession',
                'initDataDog',
                'sendAnalyticsInitEvent',
                'onGoliathReady',
                'onGoliathUnload',
                'initAnalytics',
                'initGuestAnalytics',
                'sendAnalyticsInitEvent',
                'initBrowserId'
            ].forEach((prop) => {
                window['agarApp'].main[prop] = () => {};
            });
        if (window['agarApp']?.MCSDK) ['sendMatchEvent'].forEach((prop) => (window['agarApp'].MCSDK[prop] = () => {}));
    }
    try {
        onAgarApp();
    } catch (e) {}
}

/**
 * Endpoints for connecting to the Agar.io game server.
 */
export type AgarioEndpoints = {
    http: string | '0.0.0.0:0';
    https: string | '0.0.0.0:0';
};

/**
 * Response from an Agar.io game server.
 */
export type AgarioServerResponse = {
    endpoints: AgarioEndpoints;
    token: string;
    region: string;
    gamemode: string;
    status: 'ok' | 'no_servers';
};

export function fixNoServers() {
    let AgarioEndpoints: Record<string, Object> = null;
    class HookXMLHttpRequest extends window.XMLHttpRequest {
        constructor() {
            super();
        }

        open(method: string, _url: string | URL, async?: boolean, username?: string | null, password?: string | null): void {
            const url = new URL(_url, location.href);
            if (url.pathname.endsWith('/info')) {
                this.addEventListener('load', () => {
                    const regions = JSON.parse(this.responseText);
                    AgarioEndpoints = regions;
                });
            }
            if (url.pathname.endsWith('/findServerWithFriends')) {
                console.log('Hooked XMLHttpRequest:', method, url);
                this.addEventListener('load', (e) => {
                    const endpoints = JSON.parse(this.responseText) as AgarioServerResponse;

                    if (endpoints.status == 'no_servers') {
                        const escapeIndex = (index: number, count: number): number => ((index % count) + count) % count;
                        const otherRegions = Object.keys(AgarioEndpoints.regions);
                        const targetRegion = window['MC'].getRegion();
                        const regionIndex = otherRegions.indexOf(targetRegion);
                        const tryRegion = escapeIndex(regionIndex + 1, otherRegions.length);
                        console.log('Trying region:', otherRegions[tryRegion]);
                        setTimeout(() => {
                            window['MC'].setRegion(otherRegions[tryRegion], true);
                        }, 0);
                    }
                    if (false && endpoints.status == 'no_servers') {
                        e.stopPropagation();
                        e.stopImmediatePropagation();

                        window['core'].disableIntegrityChecks(true);
                        ['responseText', 'response'].forEach((prop) => {
                            Object.defineProperty(this, prop, {
                                value: JSON.stringify({
                                    endpoints: {
                                        http: 'imsolo.pro:2102',
                                        https: 'imsolo.pro:2102'
                                    },
                                    status: 'ok',
                                    count: 0
                                })
                            });
                        });
                        this.dispatchEvent(new ProgressEvent('load', e));
                    }
                });
            }
            super.open(method, url, async, username, password);
        }
    }
    window.XMLHttpRequest = HookXMLHttpRequest;
}
