type IGUNRTCPeerConnection = RTCPeerConnection & GunPeer;
interface MessageBody {
    $: IGunInstance<any>;
    '@'?: string;
    '#': string;
    ok: Ok;
}

export interface Ok {
    rtc: RTCMessage;
}

type RTCMessage =
    | { candidate?: RTCIceCandidateInit; id: string }
    | { answer?: RTCSessionDescription; id: string }
    | { offer?: RTCSessionDescription; id: string };

export default (function () {
    let GUN = Gun;
    GUN.on('opt', function (root: _GunRoot & { $: IGunInstance<any> }) {
        this.to.next(root);
        let opt = root.opt as GunOptions & {
            pid: string;
            peers: RTCPeerConnection[];
            mesh: MeshModule.MeshType;
            start: number;
        };
        if (root['once']) {
            return;
        }
        if (!GUN.Mesh) {
            return;
        }
        if (false === (RTCPeerConnection as any)) {
            return;
        }

        const pending = {} as Record<string, IGUNRTCPeerConnection>;
        const mediaCache = {} as Record<string, MediaStream>;

        const rtcConfig: RTCConfiguration = {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }]
        };
        let start = 0;
        // FIXME: Find the wire throwing ICE Failed
        const dataChannelDict = { ordered: false, maxRetransmits: 2 };
        const rtcOfferOptions = { mandatory: { OfferToReceiveAudio: false, OfferToReceiveVideo: false } } as RTCOfferOptions;
        const rtcMax = 55; // is this a magic number? // For Future WebRTC notes: Chrome 500 max limit, however 256 likely - FF "none", webtorrent does 55 per torrent.
        const roomId = location.hash.slice(1) || location.pathname.slice(1);

        function announce() {
            start = +new Date(); // handle room logic:
            root['$']
                .get(`/RTC/${roomId}<?99`)
                .get('+')
                .put(
                    opt.pid,
                    (ack: MessageBody & GunMessagePut) => {
                        if (!ack.ok || !ack.ok.rtc) {
                            return;
                        }
                        plan(ack);
                    },
                    // @ts-ignore
                    { acks: rtcMax }
                )
                .on(function (last: string, _key: string, msg) {
                    if (last === opt.pid || start > msg.put['>']) {
                        return;
                    }
                    plan({ '#': String(msg['#']), ok: { rtc: { id: last } }, $: undefined });
                });
        }

        function listenAnnounces() {
            root['$']
                .get(`/RTC/${roomId}<?99`)
                .get('+')
                .on(function (data, key, msg) {
                    console.log('RTC', { data, key, msg });
                });
        }

        opt.mesh ??= GUN.Mesh(root);
        let mesh: MeshModule.MeshType = opt.mesh;
        mesh.hear['rtc'] = plan;

        let parentWire = mesh.wire;
        mesh.wire = function (media: MediaStream) {
            try {
                parentWire && parentWire(media);
                if (!(media instanceof MediaStream)) {
                    return;
                }
                mediaCache[media.id] ??= media;
                for (const peer of Object.values(opt.peers) as IGUNRTCPeerConnection[]) {
                    if (!(peer instanceof RTCPeerConnection)) continue;
                    for (const track of media.getTracks()) {
                        peer.addTrack(track, media);
                    }
                    peer.createOffer(rtcOfferOptions).then((offer) => {
                        peer.setLocalDescription(offer);
                        // @ts-ignore
                        mesh.say({ '#': root.ask(plan), dam: 'rtc', ok: { rtc: { offer: offer, id: opt.pid } } }, peer);
                    });
                }
            } catch (e) {
                console.log(e);
            }
        };
        root.on('create', function (at) {
            this.to.next(at);
            setTimeout(announce, 1);
            setTimeout(listenAnnounces, 1);
        });

        async function plan(msg: MessageBody) {
            let rtc = msg.ok?.rtc;

            if (!rtc || rtc.id === opt.pid) return;

            const peer = open(msg, rtc);
            if ('candidate' in rtc) {
                await peer.addIceCandidate(new RTCIceCandidate(rtc.candidate!));
            } else if ('answer' in rtc) {
                await peer.setRemoteDescription(new RTCSessionDescription(makeSessionDescription(rtc.answer, 'answer')));
            } else if ('offer' in rtc) {
                await peer.setRemoteDescription(new RTCSessionDescription(makeSessionDescription(rtc.offer, 'offer')));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                // @ts-ignore
                root.on('out', { '@': msg['#'], ok: { rtc: { answer, id: opt.pid } } });
            }
        }
        function open(msg: MessageBody, rtcMessage: RTCMessage) {
            let existingPeer: IGUNRTCPeerConnection = opt.peers[rtcMessage.id] || pending[rtcMessage.id];
            if (existingPeer) return existingPeer;

            let peer = new RTCPeerConnection(rtcConfig) as IGUNRTCPeerConnection;
            peer.id = rtcMessage.id;
            peer.onconnectionstatechange = rtceve;
            peer.ontrack = rtceve;
            peer.onicecandidate = function (e) {
                rtceve(e);
                if (!e.candidate) return;
                // @ts-ignore
                root.on('out', { '@': (msg || '')['#'], '#': root.ask(plan), ok: { rtc: { candidate: e.candidate, id: opt.pid } } });
            };
            peer.ondatachannel = function (e) {
                rtceve(e);
                const dc = e.channel;
                dc.onmessage = wire.onmessage;
                dc.onopen = wire.onopen;
                dc.onclose = wire.onclose;
            };
            pending[rtcMessage.id] = peer;
            setTimeout(() => delete pending[rtcMessage.id], 1000 * 60);

            let wire = peer.createDataChannel('dc', dataChannelDict);
            peer.wire = wire;
            wire.onclose = () => mesh.bye(peer);
            wire.onerror = console.error;
            wire.onopen = function (e) {
                delete pending[rtcMessage.id];
                mesh.hi(peer);
            };
            wire.onmessage = function (msg) {
                if (msg) mesh.hear(msg.data || msg, peer);
            };

            function rtceve(eve: RTCTrackEvent | RTCPeerConnectionIceEvent | RTCDataChannelEvent) {
                // console.log('rtceve', this, eve);
                // eve['peer'] = peer; // ! Unnecessary
                // window['gun'].on('rtc', eve); // ! Unnecessary
            }
            // peer['$'] = window['gun']; // ! Unnecessary
            // @ts-ignore
            // peer.onremovetrack = rtceve; // ! Unnecessary

            if ('offer' in rtcMessage) {
                return peer;
            }
            for (let _m in mediaCache) {
                const m = mediaCache[_m] as MediaStream;
                m.getTracks().forEach((track) => {
                    peer.addTrack(track, m);
                });
            }
            peer.createOffer(rtcOfferOptions).then(
                function (offer) {
                    peer.setLocalDescription(offer);
                    // @ts-ignore
                    root.on('out', { '@': (msg || '')['#'], '#': root['ask'](plan), ok: { rtc: { offer: offer, id: opt.pid } } });
                },
                function () {}
            );
            return peer;
        }
    });

    function makeSessionDescription(desc: RTCSessionDescriptionInit, type: 'answer' | 'offer'): RTCSessionDescriptionInit {
        return {
            type,
            sdp: desc.sdp?.replace(/\\r\\n/g, '\r\n') ?? ''
        };
    }
})();
