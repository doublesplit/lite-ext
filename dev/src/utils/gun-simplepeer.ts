import { disconnectWs } from '../backend';

type IGUNRTCPeerConnection = RTCPeerConnection & GunPeer;
interface MessageBody {
    $: IGunInstance<any>;
    '@'?: string;
    '#': string;
    ok: Ok;
}

/**
 * Multiple peers, numwant, and other options are not implemented yet.
 * Нужно запилить поисковик пиров, с настройками количества пиров. и круто бы сжатие msgpack
 */

const hmsms = () => {
    const d = new Date();
    return `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}:${d.getMilliseconds()}`;
};

export interface Ok {
    rtc: RTCMessage;
}

type RTCMessage = {
    signal?: RTCSessionDescriptionInit;
    id: string;
};
export default (function () {
    const decoder = new TextDecoder('utf-8');
    let GUN = Gun;
    GUN.on('opt', function (root: _GunRoot & { $: IGunInstance<any> }) {
        this.to.next(root);
        let opt = root.opt as GunOptions & {
            pid: string;
            peers: RTCPeerConnection[];
            mesh: MeshModule.MeshType;
            start: number;
        };

        if (root['once']) return;
        if (!GUN.Mesh) return;

        const rtcMax = 55;
        const rtcMin = 1;
        const roomId = location.hash.slice(1) || location.pathname.slice(1);

        opt.mesh ??= GUN.Mesh(root);
        let mesh: MeshModule.MeshType = opt.mesh;

        class Peers {
            static pending = new Map<string, Instance>();
            static connected = new Map<string, Instance>();
            static afterPeerConnect = () => {
                if (this.connected.size >= rtcMin) {
                    disconnectWs(root['$']);
                }
            };
            static onPeerDisconnect = () => {};
            static plan = async (msg: MessageBody) => {
                let rtc = msg.ok?.rtc;

                if (!rtc || rtc.id === opt.pid) return;
                console.log(hmsms(), 'GOT SIGNAL:', rtc.signal);
                const peer = Peers.getPeer(msg, rtc);

                if ('signal' in rtc) {
                    peer.signal(rtc.signal);
                }
            };
            static announce = () => {
                let start = +new Date(); // handle room logic:
                root['$']
                    .get(`/SP/${roomId}<?99`)
                    .get('+')
                    .put(
                        opt.pid,
                        (ack: MessageBody & GunMessagePut) => {
                            if (!ack.ok || !ack.ok.rtc) {
                                return;
                            }
                            Peers.plan(ack);
                        },
                        // @ts-ignore
                        { acks: rtcMax }
                    )
                    .on(function (last: string, _key: string, msg) {
                        if (last === opt.pid || start > msg.put['>']) {
                            return;
                        }
                        Peers.plan({ '#': String(msg['#']), ok: { rtc: { id: last } }, $: undefined });
                    });
            };
            static listenAnnounces = () => {
                root['$']
                    .get(`/SP/${roomId}<?99`)
                    .get('+')
                    .on(function (data, key, msg) {
                        console.log('RTC', { data, key, msg });
                    });
            };
            static getPeer(msg: MessageBody, rtcMessage: RTCMessage) {
                const existingPeer: Instance = opt.peers[rtcMessage.id] || Peers.pending.get(rtcMessage.id);
                if (existingPeer) return existingPeer;

                const peer: Instance = new SimplePeer({
                    initiator: !('signal' in rtcMessage),
                    trickle: true,
                    iceCompleteTimeout: 3000,
                    config: {
                        iceServers: iceServers
                    }
                });
                peer.addListener('signal', (description) => {
                    console.log(hmsms(), 'EMIT SIGNAL:', description);
                    // @ts-ignore
                    root.on('out', { '@': (msg || '')['#'], '#': root.ask(Peers.plan), ok: { rtc: { signal: description, id: opt.pid } } });
                });
                peer.addListener('connect', () => {
                    this.connected.set(rtcMessage.id, peer);
                    clearTimeout(destroyId);
                    mesh.hi(peer);
                    Peers.afterPeerConnect();

                    console.log('Peer connection opened:', rtcMessage.id);
                });
                peer.addListener('data', (buffer: Uint8Array) => {
                    const msg = decoder.decode(buffer);
                    console.log('Peer data received:', msg, buffer);
                    if (msg) mesh.hear(msg, peer);
                });
                peer.addListener('error', (err) => {
                    console.error('Peer error:', err);
                });
                peer.addListener('close', () => {
                    mesh.bye(peer);
                    console.log('Peer connection closed:', rtcMessage.id);
                    destroyPeer();
                });

                Object.assign(peer, { close: () => peer.destroy() });
                Object.assign(peer, { id: rtcMessage.id, wire: peer });

                const destroyPeer = () => {
                    this.connected.delete(rtcMessage.id);
                    this.pending.delete(rtcMessage.id);
                    peer.destroy();
                    peer.removeAllListeners('error');
                    peer.removeAllListeners('data');
                    peer.removeAllListeners('connect');
                    peer.removeAllListeners('signal');
                };
                this.pending.set(rtcMessage.id, peer);
                const destroyId = setTimeout(destroyPeer, 1000 * 60);
                return peer;
            }
            static {
                mesh.hear['rtc'] = Peers.plan;

                root.on('create', function (at) {
                    this.to.next(at);
                    setTimeout(Peers.announce, 1);
                    // setTimeout(Peers.listenAnnounces, 1);
                });
            }
        }
    });
})();

const iceServers: RTCIceServer[] = [
    {
        urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun.cloudflare.com:3478',
            'stun:global.stun.twilio.com:3478',
            'stun:freeturn.net:3478',
            'stun:freeturn.net:5349'
        ]
    }
];
const turnIceServers: RTCIceServer[] = [
    {
        urls: [
            'turn:159.69.83.64:3478?transport=tcp',
            'turn:159.69.83.64:3479?transport=tcp',
            'turn:159.69.83.64:3478?transport=udp',
            'turn:159.69.83.64:3479?transport=udp'
        ],
        username: 'test',
        credential: 'b2397c884a604e333d3e980da73f0a58'
    }
];
