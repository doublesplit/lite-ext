import SimplePeer, { Instance } from 'simple-peer';
import { DebuggerMixin } from '../utils/Debugger';
import { Eventify } from '../utils/Eventify';
import { MessageAnswer, MessageOffer } from './types';
import { WebTorrent } from './WebTorrent';

const randomid = () =>
    Array(5)
        .fill(0)
        .map(() => Math.random().toString(36).substring(2, 6))
        .join('');

export function getHash(input = Math.random().toString(36), length = 20) {
    function hash(str = '') {
        let i = str.length,
            h = 5381;
        for (; i--; ) h = (h * 33) ^ str.charCodeAt(i);
        return h >>> 0;
    }
    const result = [];
    for (let len = 0; length > len; ) {
        const str: string = hash(result[result.length - 1] || input).toString(16);
        len += str.length;
        result.push(str);
    }
    return result.join('').slice(0, length);
}

const iceServers: RTCIceServer[] = [
    {
        urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478', 'stun:freeturn.net:3478', 'stun:freeturn.net:5349']
    },
    {
        urls: ['turn:freeturn.net:3478', 'turns:freeturn.net:5349'],
        credential: 'free',
        username: 'free'
    }
    // {
    //     urls: [
    //         'turn:159.69.83.64:3478?transport=tcp',
    //         'turn:159.69.83.64:3479?transport=tcp',
    //         'turn:159.69.83.64:3478?transport=udp',
    //         'turn:159.69.83.64:3479?transport=udp'
    //     ],
    //     username: 'test',
    //     credential: 'b2397c884a604e333d3e980da73f0a58'
    // }
];

declare module 'simple-peer' {
    interface Instance {
        id: string;
        _pc: RTCPeerConnection;
    }
}

export class MicroPeer extends DebuggerMixin(Eventify) {
    id: string = randomid().substring(0, 20);
    isLogging = true;
    state = 'stopped';
    destroyed = false;
    reconnecting = false;
    socket: WebTorrent;
    info_hash: string;

    offers = new Map<string, Instance>();
    connected = new Map<string, Instance>();
    answers = new Map<string, Instance>();

    intervalAnnounce = 5;
    timerAnnounce: ReturnType<typeof setInterval> | null = null;
    isGeneration = false;
    constructor(
        { info_hash }: { info_hash: string },
        socket: WebTorrent,
        public callbacks = { connected: () => {}, data: () => {}, disconnected: () => {} }
    ) {
        super();
        this.setPrefix('[Peer ' + this.id + ']:');
        this.socket = socket;
        this.info_hash = getHash(info_hash, 20);
        this.initSocket();
        this.start();
    }
    start() {
        // Start interval
        if (this.destroyed == true) return this.log('already destroyed');
        this.setInterval();
    }
    destroy() {
        // Destroying peer
        if (this.destroyed == true) return this.log('already destroyed');
        this.unlisten();
        this.stop();
        for (const [, peer] of this.offers) peer.destroy();
        for (const [, peer] of this.connected) peer.destroy();
        this.events = {};
    }
    stop() {
        // Stopping announces
        clearInterval(this.timerAnnounce!);
        this.socket.send(this.generateStopInfo());
        // this.unlisten()
    }
    setInterval() {
        clearInterval(this.timerAnnounce!);
        this.timerAnnounce = setInterval(() => {
            this.emit('announceinterval');
        }, this.intervalAnnounce * 1000);
    }
    async announce(opts: { event?: string; numwant?: number; uploaded?: number; downloaded?: number; left?: number } = {}, callback?: () => void) {
        if (this.destroyed || this.reconnecting) return;
        if (!this.socket.isOpened()) {
            !this.socket.isConnecting && this.socket.connect();
            this.socket.once('open', () => {
                this.announce(opts);
            });
            return;
        }
        const params = Object.assign(
            {
                numwant: 0,
                uploaded: 0,
                downloaded: 0,
                left: 0
            },
            opts,
            {
                action: 'announce',
                info_hash: this.info_hash,
                peer_id: this.id,
                offers: undefined
            }
        );
        // if (this._trackerId) params.trackerid = this._trackerId
        if (opts.event === 'stopped' || opts.event === 'completed') {
            opts.event = this.state = 'stopped';
            params.numwant = 0;
            params.uploaded = 0;
            params.downloaded = 0;
            params.left = 0;
            // Don't include offers with 'stopped' or 'completed' event
            this.socket.send(params);
            callback && callback();
            return;
        } else if (this.state != 'stopped' || opts.event == 'started') {
            opts.event = this.state == 'started' ? 'update' : 'started';
            if (this.isGeneration) return;
            // Limit the number of offers that are generated, since it can be slow
            const numwant = Math.min(opts.numwant!, 10);
            this.generateOffers(numwant).then((offers) => {
                params.numwant = offers!.length;
                Object.assign(params, { offers });
                this.socket.send(params);
                callback && callback();
            });
        }
    }
    async generateOffers(numwant: number) {
        if (this.isGeneration) return;
        this.isGeneration = true;
        const result_offers = [];
        const promises = [];
        for (let targetWant = numwant - this.offers.size; targetWant--; )
            (() => {
                const peer = new SimplePeer({
                    initiator: true,
                    trickle: false,
                    iceCompleteTimeout: 1000,
                    // @ts-ignore
                    wrtc: typeof wrtc !== 'undefined' ? wrtc : undefined,
                    config: { iceServers }
                });
                peer.once('error', (e: Error) => {
                    this.error('Error', e);
                });
                peer['id'] = randomid().substring(0, 20);

                const promised = new Promise((res, rej) => {
                    peer.once('error', rej);
                    peer.once('signal', res);
                })
                    .then((e) => {
                        this.offers.set(peer['id'], peer);

                        peer.once('connect', () => {
                            this.emit('connect', peer);
                            this.connected.set(peer['id'], peer);
                            this.offers.delete(peer['id']);
                            removeUnnecessaryPeerEvents(peer);
                        });
                        peer.on('close', () => {
                            this.connected.delete(peer['id']);
                            this.offers.delete(peer['id']);
                            removeUnnecessaryPeerEvents(peer);
                        });
                        peer.on('error', () => {
                            this.offers.delete(peer['id']);
                            this.connected.delete(peer['id']);
                            removeUnnecessaryPeerEvents(peer);
                        });
                        return e;
                    })
                    .catch(() => {
                        destroyPeer(peer);
                    });
                promises.push(promised);
            })();

        await Promise.all(promises);

        for (const [id, peer] of this.offers) {
            result_offers.push({
                offer: peer['_pc'].localDescription,
                offer_id: peer['id']
            });
        }
        this.isGeneration = false;
        return result_offers;
    }
    initSocket() {
        this.listenTo(this.socket, 'open', () => {});
        this.listenTo(
            this.socket,
            'message',
            /**
             * @param {MessageAnswer | MessageOffer | MessageStats} data
             */
            (data) => {
                if ('complete' in data && 'incomplete' in data) {
                    // this.log({ hash: data.info_hash, 'have in': data.complete, 'not loaded in': data.incomplete });
                }
                // MessageOffer
                if ('offer' in data) this.onOffer(data);

                // MessageAnswer
                if ('answer' in data) {
                    this.groupCollapsed('Answer is received, connecting to peer...');
                    this.log(data);
                    console.groupEnd();
                    const peer = this.offers.get(data.offer_id);
                    if (!peer) return this.error('Error: for this answer not found corresponding offer', data.offer_id);
                    // console.log('answer for',peer)
                    // peer.remotePeerId = data.peer_id
                    // peer.remoteOfferId = data.to_offer_id
                    peer.signal(data.answer);
                }
            }
        );
    }

    onOffer(data: MessageOffer) {
        this.log('STEP 2: accept offer of remote peers', data);
        const SP = SimplePeer;
        const peer = new SP({
            initiator: false,
            trickle: false,
            iceCompleteTimeout: 1000,
            // @ts-ignore
            wrtc: typeof wrtc !== 'undefined' ? wrtc : undefined,
            config: { iceServers }
        });

        peer['id'] = ('-' + randomid()).substring(0, 20);
        peer.signal(data.offer);

        const promised = new Promise((res, rej) => {
            peer.once('error', rej);
            peer.once('signal', res);
        });
        promised.then(() => {
            const json: MessageAnswer = {
                action: 'announce',
                info_hash: this.info_hash,
                peer_id: this.id,
                to_peer_id: data.peer_id,
                to_offer_id: peer['id'], // this is not protocol specified, but it can be used
                answer: peer['_pc'].localDescription!,
                offer_id: data.offer_id
            };
            this.socket.send(json);

            let onConnect: () => void;
            let onClose: () => void;
            let onError: () => void;

            peer.on(
                'connect',
                (onConnect = () => {
                    this.emit('connect', peer);
                    this.connected.set(peer['id'], peer);
                    console.log('Connected my answer');
                    removeUnnecessaryPeerEvents(peer);
                })
            );
            peer.on(
                'close',
                (onClose = () => {
                    this.connected.delete(peer['id']);
                    removeUnnecessaryPeerEvents(peer);
                    removeListeners();
                })
            );
            peer.on(
                'error',
                (onError = () => {
                    this.connected.delete(peer['id']);
                    removeUnnecessaryPeerEvents(peer);
                    removeListeners();
                })
            );
            function removeListeners() {
                peer.removeListener('connect', onConnect);
                peer.removeListener('close', onClose);
                peer.removeListener('error', onError);
            }
        });
        promised.catch((error) => {
            this.error(error);
            destroyPeer(peer);
        });
    }
    generateStopInfo() {
        const json = {
            action: 'announce',
            event: 'stopped',
            numwant: 0,
            uploaded: 0,
            downloaded: 0,
            left: 0,
            info_hash: this.info_hash,
            peer_id: this.id
        };
        return json;
    }
    async scrape() {
        const json = {
            action: 'scrape',
            info_hash: null
            // "info_hash": this.info_hash
        };
        this.socket.send(json);
    }
}

function removeUnnecessaryPeerEvents(peer: SimplePeer.Instance) {
    peer.removeAllListeners('signal');
}
function destroyPeer(peer: SimplePeer.Instance) {
    removeUnnecessaryPeerEvents(peer);
    peer.removeAllListeners('connect');
    peer.removeAllListeners('data');
    peer.removeAllListeners('close');
    peer.removeAllListeners('error');
    peer.destroy();
}
