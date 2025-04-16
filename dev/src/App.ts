import { deferrify, EventObject } from '../../Shared/src/utils/Eventify';
import { coreAdsPatch, coreInitPatch, coreUiPatch, fixNoServers } from './agario-patches';
import { settings } from './settings';
import { initLiteui } from './ui';
import { makeGLobal } from './utils/env';
import { Sampler } from './utils/Sampler';
import { storage } from './utils/storage';
import { find_node, Methods, overrideMethod, overridePrototype } from './utils/utils';
import { applyPatch } from './utils/wasmPatcher';
import { World } from './World';

export default class App {
    sampler = new Sampler();
    world: World;
    performance_now = 0; // for speedhack
    timer_mp = 1; // time multiplier
    waitForSpawn = false; // respawn ways
    sector = 5;
    stopmovement = false;
    /*** camera zoom ****/
    scale = 1;
    /** target cursor world */
    mouse = {
        x: 0,
        y: 0
    };
    /** cursor on canvas display */
    mouseDisplay = {
        x: 0,
        y: 0
    };
    /** world camera position */
    camera = {
        x: 0,
        y: 0
    };
    state = EventObject({
        play: false,
        pause: false,
        ws: ''
    });
    memory = EventObject({
        skinUrl: ''
    });
    /** vue ui */
    mainui = null as any;
    /** exposed emscripten module */
    emsc = null as any;
    /** main game canvas */
    canvas: HTMLCanvasElement;
    display_vue() {
        return find_node(window['agarApp'].home, (child, depth) => {
            console.log(child, child?.$vnode?.tag);
            return true;
        });
    }

    constructor() {
        this.world = new World(this);
        this.world.on('beforeConnect', this.beforeConnect.bind(this));
        const storageName = 'lite_settings';
        settings.import({ ...settings.export(), ...storage.get(storageName) });
        settings.on('*', (_) => {
            storage.set(storageName, settings.export());
        });

        Object.assign(this.memory, storage.get('memory'));

        this.memory.on('*', () => {
            console.log('nick', this.memory);
            storage.set('memory', this.memory);
        });

        // this.memory.on('skinUrl', () => {
        //     // @ts-ignore
        //     if (this.memory.skinUrl)
        //         try {
        //             window['core'].registerSkin(
        //                 document.getElementById('nick').value,
        //                 null,
        //                 this.memory.skinUrl,
        //                 2,
        //                 null
        //             );
        //         } catch (e) {}
        // })();

        this.initObserver().then(() => {
            this.world.initialize();
            this.waitCore().then(() => {
                this.handleCoreInit();
            });
        });

        overrideMethod(window.console, 'log', function (o, args) {
            if (args[0].startsWith?.('       ,,,,,')) return (window.console.log = o);
            return o.apply(this, args);
        });
    }

    async loadAndPatchCore(url: string, resolve: () => void) {
        try {
            const request = new XMLHttpRequest();
            request.open('GET', url, false);
            request.onload = () => {
                const patchedText = this.observerPatcher(request.responseText);
                const blob = new Blob([patchedText], { type: 'text/javascript' });
                const blobURL = URL.createObjectURL(blob);
                const script = document.createElement('script');
                script.id = 'agario.core.js';
                script.src = blobURL;
                script.onload = () => {
                    URL.revokeObjectURL(blobURL);
                    resolve();
                };
                document.body.appendChild(script);
            };
            request.send();
        } catch (error) {
            console.error('[ERROR] Failed to load and patch core:', error);
        }
    }
    initObserver() {
        const deferred = deferrify<void>();
        const observer = new window.MutationObserver((mtRecs) => {
            for (const mtRec of mtRecs) {
                for (let i = 0; i < mtRec.addedNodes.length; i++) {
                    const elem = mtRec.addedNodes[i] as HTMLScriptElement;
                    const [t] = (elem.src && elem.src.match(/agario\.core\.js.+/i)) || [];
                    if (t) {
                        observer.disconnect();

                        elem.remove();
                        elem.parentNode?.removeChild(elem);
                        this.loadAndPatchCore(t, deferred.resolve);
                    }
                }
            }
        });
        observer.observe(document, {
            childList: true,
            subtree: true
        });
        return deferred.promise;
    }
    patchWasm(u: ArrayBuffer) {
        let anyFail = false;
        const patchedUint8Array = applyPatch(
            new Uint8Array(u),
            [
                {
                    pattern: [0x45, 0x0d, 0x00, 0x20, 0x02, 0x10, 0x0f, 0x20, 0x01, 0x20, 0x02, 0x10, 0x1e, 0x21, 0x01],
                    payload: [0x20, 0x00, 0x28, 0x02, 0x1c, 0x45, 0x04, 0x40, 0x0f, 0x0b],
                    type: 'insertAfter'
                },
                {
                    pattern: [0x81, 0x03, 0x84, 0x03, 0x10, 0x87, 0x03, 0x86, 0x03, 0x85, 0x03, 0x0a],
                    payload: [203],
                    type: 'replaceAfter'
                },
                {
                    pattern: [0x00, 0x20, 0x00, 0x20, 0x04, 0x37, 0x03, 0x08, 0x20, 0x03, 0x41, 0x10, 0x6a, 0x24, 0x00, 0x0b],
                    payload: [138],
                    type: 'replaceAfter'
                },
                {
                    pattern: [
                        0x01, 0x2d, 0x00, 0x07, 0x20, 0x02, 0x41, 0x1b, 0x6c, 0x41, 0x01, 0x6a, 0x73, 0x3a, 0x00, 0x07, 0x20, 0x1f, 0xbf, 0x44, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00
                    ],
                    payload: [0, 0],
                    type: 'replaceAfter'
                }
            ],
            () => (anyFail = true)
        );
        if (anyFail) return u;

        return patchedUint8Array.buffer;
    }

    observerPatcher = (e: string) => {
        const randomKey = 'app_' + Math.random().toString(36).slice(2, 10);
        window[randomKey] = this;
        const app = 'window.' + randomKey;

        const replacements: Record<string, Array<[regexp: RegExp, replacer: string]>> = {
            registerSkin: [
                [
                    /("\s?registerSkin\s?"\s?:\s?function\s?\(\s?(.+?)\s?,\s?(.+?)\s?,\s?(.+?)\s?,\s?(.+?)\s?,\s?(.+?)\s?\)\s?\{\s?)/i,
                    `$1${app}.onRegisterSkin($2,$3,$4,$5,$6);`
                ]
            ],
            onConnect: [[/(;..?\s?\.\s?onopen\s?=\s?function\s?\(\s?\)\s?\{\s?)/i, `$1${app}.onConnect(this.url, this);`]],
            mobileData: [
                [
                    /(\s?if\s?\(\s?window\s?\[\s?"\s?MC\s?"\s?]\s?&&\s?window\s?\[\s?"\s?MC\s?"\s?]\s?\[\s?"\s?onMobileData\s?"\s?]\s?\)\s?window\s?\[\s?"\s?MC\s?"\s?]\s?\[\s?"\s?onMobileData\s?"\s?]\s?\(\s?(.+?)\s?\))/i,
                    `$2=${app}.onPacket($2);$1`
                ]
            ],
            'Emscripten hook': [[/(\w+)\W+instantiateWasm/, `(${app}.onEmscripten($1)), $&`]],
            'Mouse hook': [
                [/("\s?setTarget\s?"\s?:\s?function\s?\(\s?(.+?)\s?,\s?(.+?)\s?\)\s?\{\s?)/i, `$1 var [$2, $3] = ${app}.syncMouse($2, $3);`]
            ],
            'Player Zoom': [[/("\s?playerZoom\s?"\s?:\s?function\s?\(\s?(.+?)\s?\)\s?\{\s?)/i, `$1$2=${app}.onPlayerZoom($2);`]],
            'WebSocket onclose': [[/(;..?\s?\.\s?onclose\s?=\s?function\s?\(\s?\)\s?\{\s?)/i, `$1${app}.onDisconnect(this);`]],
            'WebSocket onerror': [[/(;..?\s?\.\s?onerror\s?=\s?function\s?\(\s?\)\s?\{\s?)/i, `$1${app}.onDisconnect(this);`]],
            'Binary Patch': [[/(instantiate\(\s?)([^,]+)/, `$1${app}.patchWasm($2)`]],
            something: [
                [/([a-z]{6}\s?[a-z|A-Z]{16}\s?\(\s?([a-z]{6})\s?,\s?[a-z|A-Z]{10}\s?,\s?[a-z|A-Z]{7}\s?,\s?[a-zA-Z]{8}\s?\)\s?\{\s?)/i, '$1$2=true;']
            ]
        };

        for (const [name, array] of Object.entries(replacements)) {
            let current = 0;
            for (const [regexp, replacer] of array) {
                if (regexp.test(e)) {
                    e = e.replace(regexp, replacer);
                    current++;
                } else {
                    console.log(`[Not Found - ${current}]: `, name);
                }
            }
        }
        return e;
    };

    async waitCore() {
        const deferred = deferrify<void>();
        addEventListener('core_init_complete', () => {
            if (!window['core']) {
                // backup event
                if (window['MC']?.['onAgarioCoreLoaded']) {
                    const old_loaded = window['MC']['onAgarioCoreLoaded'];
                    window['MC']['onAgarioCoreLoaded'] = function () {
                        deferred.resolve();
                        window['MC']['onAgarioCoreLoaded'] = old_loaded;
                        return old_loaded.apply(this, arguments);
                    };
                    return;
                }
                // deadline mode
                Object.defineProperty(window, 'core', {
                    get: () => window['_core'],
                    set: (value) => ((window['_core'] = value), deferred.resolve())
                });

                return;
            }
            deferred.resolve();
        });

        addEventListener('event_regions_update', async () => {});

        // let rafRequest: any = null;
        // function watchVue() {
        //     rafRequest = requestAnimationFrame(() => {
        //         if (window['agarApp']) cancelAnimationFrame(rafRequest);
        //         coreAdsPatch();
        //     });
        // }
        // watchVue();
        // addEventListener('free_coins_timer', async (e) => {
        //     console.log('coins ready', e['detail'] == 0);
        //     window['agarApp'].API.getFreeCoins();
        // });

        // Object.defineProperty(window, 'mcReady', {
        //     get: () => () => {},
        //     set: () => {}
        // });
        return deferred.promise;
    }
    handleCoreInit() {
        coreInitPatch();
        coreAdsPatch();
        fixNoServers();
        coreUiPatch();
        this.init();
        this.onCoreInit();

        initLiteui(this);
    }
    modifyScore(sourceString: string) {
        if (!this.state.play) sourceString = '';
        return `${sourceString}`;
    }
    init() {
        const modifyScore = this.modifyScore.bind(this);
        const onPlayerSpawn = this.onPlayerSpawn.bind(this);
        const onPlayerDeath = this.onPlayerDeath.bind(this);

        // timelord.activate();
        // this.performance_now = window.performance['_now']();
        // const updateRealTime = (realTime_ms: number) => {
        //     const dt = realTime_ms - this.performance_now;
        //     timelord.stepTime(dt * (settings.proxy.AnimationDelay / 100), dt * this.timer_mp);
        //     this.performance_now = realTime_ms;
        //     window['_requestAnimationFrame'](updateRealTime);
        // };
        // updateRealTime(this.performance_now);

        overridePrototype(CanvasRenderingContext2D.prototype, 'fillText', (o) => {
            return function () {
                if (arguments[0].includes('Scor')) {
                    arguments[0] = modifyScore(arguments[0]);
                } else if (arguments[0].startsWith('Leaderboard')) {
                    arguments[0] = settings.proxy.LeaderboardTitle;
                }
                return o.apply(this, arguments);
            };
        });

        overridePrototype(CanvasRenderingContext2D.prototype, 'measureText', (o) => {
            return function () {
                if (arguments[0].includes('Scor')) {
                    arguments[0] = modifyScore(arguments[0]);
                }
                return o.apply(this, arguments);
            };
        });

        overrideMethod(window['MC'], 'onPlayerSpawn', function (o, args) {
            o.apply(this, args);
            onPlayerSpawn(...args);
        });

        overrideMethod(window['MC'], 'onPlayerDeath', function (o, args) {
            o.apply(this, args);
            onPlayerDeath(...args);
        });
    }
    calls: string[] = [];
    onEmscripten(Module: any) {
        this.emsc = Module;
        makeGLobal('emsc', Module);
        console.log('emsc', Module);

        this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
        const ctx = this.canvas.getContext('2d');
        const world = this.world;

        function numberIsInRange(value: number, min: number, max: number) {
            return value >= min && value <= max;
        }

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const traceCalls: Methods<CanvasRenderingContext2D> = [
            'clearRect',
            'drawImage',
            'fillText',
            'strokeText',
            'fillRect',
            'strokeRect',
            // 'beginPath',
            'moveTo',
            // 'lineTo',
            // 'arc',
            'scale',
            'save',
            'restore',
            'translate',
            'transform',
            'setTransform'
        ] as unknown as Methods<CanvasRenderingContext2D>;

        let gotScale = false;

        let callNumber = -1;
        traceCalls.forEach((method) => {
            // @ts-ignore
            overrideMethod(ctx, method, function (o, args) {
                callNumber++;
                // self.calls.push(method);
                // if (callNumber === 3)  console.log('scale', ...args);
                // if (callNumber === 2) {
                //     console.log('translate', ...args);
                // }
                // if (numberIsInRange(callNumber - 1, 1, 7))  function () {}; // Off grid

                const cmd = o.apply(ctx, args);
                return cmd;
            });
        });

        overrideMethod(ctx, 'scale', function (o, args) {
            if (!gotScale) {
                gotScale = true;
                self.scale = args[0];
            }
            const cmd = o.apply(ctx, args);

            return cmd;
        });

        // if (callNumber == 9) console.log('canvas', args[0], args[1]);
        // if (callNumber == 11) console.log('cam', args[0], args[1]);

        overrideMethod(ctx, 'drawImage', function (o, args) {
            let dx = 0,
                dy = 0,
                dw = 0,
                dh = 0;
            if (args.length == 9) {
                dx = args[5];
                dy = args[6];
                dw = args[7];
                dh = args[8];
            } else if (args.length == 3) {
                dx = args[1];
                dy = args[2];
            }
            const cmd = o.apply(ctx, args);
            return cmd;
        });

        /*** Camera hook ***/
        let translateCall = -1;
        overrideMethod(ctx, 'translate', function (o, args) {
            translateCall++;
            if (translateCall == 2) {
                self.camera.x = args[0];
                self.camera.y = args[1];
                self.drawBackground(ctx, world, o);
            }
            return o.apply(ctx, args);
        });

        /*** Before render ***/
        Module['preMainLoop'] ??= () => {};
        overrideMethod(Module, 'preMainLoop', (o, args) => {
            this.calls = [];
            o.apply(this, args);
        });

        /*** After render ***/
        Module['postMainLoop'] ??= () => {};
        overrideMethod(Module, 'postMainLoop', (o, args) => {
            this.sampler.step();
            callNumber = -1;
            translateCall = -1;
            gotScale = false;
            this.drawHud(ctx);
            o.apply(this, args);
        });
    }
    onRegisterSkin() {
        // console.log('register skin', arguments);
    }
    onCoreInit() {
        settings.on('AcidMode', (v: boolean) => {
            window['core'].setAcid(v);
        })(settings.proxy.AcidMode);
    }
    get menuShow() {
        if (!this.mainui) this.mainui = find_node(window['agarApp'].home, (child) => child.$vnode?.tag?.toLowerCase().includes('mainui'))[0];
        if (!this.mainui) return false;
        return this.mainui.menuShow;
    }
    beforeConnect(url: string, isAgar: boolean) {}
    onConnect(url: string) {
        console.log('Connected', url);
        this.state.ws = url;
        //onconnect
        if (this.waitForSpawn) {
            window['MC'].playGame();
            this.waitForSpawn = false;
        }
        // window['core'].setFadeout(false);
        // window['core'].setFadeout = () => {};
        this.disableMenuBackground();
    }
    disableMenuBackground() {
        if (!this.world.isAgar) return;
        this.emsc._ac_special_on();
        window['core'].setFpsCap(-1);
        window['core'].setFadeout(false);
        requestAnimationFrame(() => {
            window['core'].setFadeout(true);
        });
        this.emsc._ac_spectate();
    }
    spetate() {
        find_node(undefined, (child) => child?.spectate)[0]?.spectate();
    }
    connect(url: string) {
        window['core'].disableIntegrityChecks(!url.includes('minic'));

        if (window['raga'] && url.indexOf('raga') > -1) {
            window['raga'].isSwitchingGameMode = true;
            window['raga'].gameMode = 'ragaffa-16x';
        }
        window['core'].connect(url);
        // window['core'].disconnect()
        // window['MC'].reconnect(true)
    }
    respawn() {
        if (this.state.play) {
            this.connect(this.state.ws);
            this.waitForSpawn = true;
        } else {
            window['core'].setFadeout(false);
            window['core'].sendSpectate();
            window['MC'].playGame();
            setTimeout(() => {
                // MC.playGame()
                // window['agarApp'].home.$children[0].$children[0].spectate()
                // window['agarApp'].home.$children[0].$children[0].play()
                // window['agarApp'].home.$children[0].onHideMainMenu()
                // window['agarApp'].home.$children[0].onGameStart()
            }, 200);
        }
    }
    onPlayerSpawn(...args: any[]) {
        this.state.play = true;
        this.reset();
    }
    onPlayerDeath(...args: any[]) {
        find_node(undefined, (child) => {
            if (child.fastEntry !== undefined) return true;
            else return false;
        }).forEach((child) => {
            !child.fastEntry &&
                Object.defineProperty(child, 'fastEntry', {
                    get: () => true,
                    set: (x) => x
                });
        });
        window['core'].setFadeout(true);

        const setInterval = window['_setInterval'] || window.setInterval;
        const clearInterval = window['_clearInterval'] || window.clearInterval;
        const setTimeout = window['_setTimeout'] || window.setTimeout;
        const clearTimeout = window['_clearTimeout'] || window.clearTimeout;

        this.state.play = false;
        this.reset();
        if (!window['agarApp'].home.$children[0].$children[0].showMenu && settings.proxy.AutoRespawn) {
            this.respawn();
            return true;
        } else {
            const prev = this.timer_mp;
            this.timer_mp = 10000;
            setTimeout(() => (this.timer_mp = prev), 800);
        }
        // window.setTimeout(MC.showNickDialog, 500);
    }
    onPacket(packet: any) {
        return packet;
    }
    reset() {
        this.stopmovement = false;
        this.world.myCellIds = [];
    }
    dumpMem() {
        const blob = new Blob([this['emsc'].buffer]);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'dump.bin';
        a.click();
        URL.revokeObjectURL(a.href);
    }
    onDisconnect(obj) {
        console.log('disconnected', obj);
    }
    onPlayerZoom(zoom: number) {
        return zoom;
    }
    syncCamera(x: number, y: number) {
        this.camera.x = x;
        this.camera.y = y;
    }

    syncMouse(mouseDisplayX: number, mouseDisplayY: number) {
        this.mouseDisplay.x = mouseDisplayX;
        this.mouseDisplay.y = mouseDisplayY;
        this.calcMosuseWorld();
        if (this.state.pause) {
            return [this.canvas.width / 2, this.canvas.height / 2];
        }
        return [mouseDisplayX, mouseDisplayY];
    }

    calcMosuseWorld() {
        const camX = this.camera.x + this.world.offsetX;
        const camY = this.camera.y + this.world.offsetY;
        const canvasCenterX = this.canvas.width / 2;
        const canvasCenterY = this.canvas.height / 2;
        this.mouse.x = -((canvasCenterX - this.mouseDisplay.x) / this.scale + camX);
        this.mouse.y = -((canvasCenterY - this.mouseDisplay.y) / this.scale + camY);
    }

    renderLoop() {}
    drawBackground(ctx: CanvasRenderingContext2D, world: World, translate = ctx['translate']) {
        const offsetX = this.camera.x + this.world.offsetX;
        const offsetY = this.camera.y + this.world.offsetY;
        const initialAlpha = ctx.globalAlpha;
        translate(offsetX, offsetY);

        /*** Map Border ****/
        if (settings.proxy.MapBorder) {
            ctx.globalAlpha = 0.2;
            ctx.lineWidth = 20;
            ctx.fillStyle = 'green';
            ctx.strokeRect(this.world.mapMinX, this.world.mapMinY, this.world.mapSizeH, this.world.mapSizeV);
            ctx.globalAlpha = initialAlpha;
        }

        const parselw = this.world.mapSizeH / this.sector;
        const parselh = this.world.mapSizeV / this.sector;

        /*** Map Sectors ****/
        if (settings.proxy.MapSectors) {
            ctx.beginPath();
            ctx.lineWidth = 10;
            ctx.strokeStyle = 'green';
            ctx.globalAlpha = 0.2;
            for (let zi = 1; zi < this.sector; zi++) {
                ctx.moveTo(this.world.mapMinX, this.world.mapMinY + parselw * zi);
                ctx.lineTo(this.world.mapMaxX, this.world.mapMinY + parselw * zi);
                ctx.moveTo(this.world.mapMinX + parselh * zi, this.world.mapMinY);
                ctx.lineTo(this.world.mapMinX + parselh * zi, this.world.mapMaxY);
            }
            ctx.stroke();
            ctx.closePath();
            ctx.globalAlpha = initialAlpha;
        }

        /*** Sector Label ****/
        if (settings.proxy.MapSectorLabels) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = parselw / 2.8 + 'px Segoe Print';
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = 'green';
            const bucw = parselw / 2,
                buch = parselh / 2;
            for (let sat = 0; sat < this.sector; sat++) {
                const label = String.fromCharCode(65 + sat);
                for (let sut = 0; sut < this.sector; sut++) {
                    ctx.fillText(label + (sut + 1), this.world.mapMinX + parselw * sut + bucw, this.world.mapMinY + parselh * sat + buch);
                }
            }
            ctx.globalAlpha = initialAlpha;
        }

        /*** C3 sign ****/
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.font = '380px Segoe Print';
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#808080';
        ctx.fillText('Doublesplit', 0, 0);
        ctx.globalAlpha = initialAlpha;

        translate(-offsetX, -offsetY);

        // ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        // ctx.scale(1 / this.zoomvalue, 1 / this.zoomvalue);
        // ctx.fillRect(0, 0 + ctx.canvas.height / 2 - 150, 200, 100);
        // ctx.scale(this.zoomvalue, this.zoomvalue);
        return;
        /*** Mini Map ****/
        if (false) {
            const minimapWidth = 100;
            const minimapHeight = 100;
            const mapMinX = this.world.mapMinX;
            const mapMinY = this.world.mapMinY;
            const mapMaxX = this.world.mapMaxX;
            const mapMaxY = this.world.mapMaxY;
            const mapWidth = this.world.mapSizeH;
            const mapHeight = this.world.mapSizeV;

            const viewX = this.camera.x;
            const viewY = this.camera.y;
            const mw = minimapWidth / 5;
            const blurrylines = 0;

            let leftrate = (viewX - mapMinX) / mapWidth;
            let toprate = (viewY - mapMinY) / mapHeight;
            let minileft = Math.round(minimapWidth * leftrate * 100) / 100;
            let minitop = Math.round(minimapHeight * toprate * 100) / 100;
            ctx.beginPath();
            ctx.clearRect(0, 0, minimapWidth, minimapHeight);
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = 'blue'; //settings.raw.border.string;
            ctx.strokeRect(blurrylines + mw, blurrylines + mw, minimapWidth - mw * 2, minimapHeight - mw * 2);
            ctx.strokeRect(blurrylines + mw * 2, blurrylines + mw * 2, minimapWidth - mw * 4, minimapHeight - mw * 4);
            ctx.globalAlpha = 1;

            ctx.fillStyle = 'red'; //settings.raw.miniblob.string;
            ctx.arc(minileft, minitop, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.closePath();

            ctx.beginPath();
            ctx.fillStyle = 'red';
            leftrate = minimapWidth / mapWidth;
            toprate = minimapHeight / mapHeight;
            minileft = Math.round((mapWidth / 2 + (this.mouse.x - offsetX)) * leftrate);
            minitop = Math.round((mapHeight / 2 + (this.mouse.y - offsetY)) * toprate);
            ctx.arc(minileft, minitop, 3, 0, 2 * Math.PI);

            ctx.fill();
            ctx.closePath();
        }
    }
    drawHud(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, 0, 0);
    }
}

// if ('hot' in module) {
//     // @ts-ignore
//     module['hot'].decline();
//     // @ts-ignore
//     module['hot'].dispose(() => {
//         location.reload();
//     });
// }
