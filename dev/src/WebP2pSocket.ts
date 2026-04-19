import { P2PWebSocket } from '../../Shared/src/P2PWebSocket/P2PWebSocket';

const OriginalWebSocket = window.WebSocket;

export const WebSocket = new Proxy(OriginalWebSocket, {
    construct(target, args, newTarget) {
        const url = String(args[0]);
        const protocols = args[1];

        if (/[a-z0-9]{20}$/.test(url)) {
            return new P2PWebSocket(url.replace(/^wss?:/, 'hash:'), protocols);
        }

        return Reflect.construct(target, args, newTarget);
    },

    get(target, prop, receiver) {
        return Reflect.get(target, prop, receiver);
    },

    set(target, prop, value, receiver) {
        return Reflect.set(target, prop, value, receiver);
    },

    has(target, prop) {
        return Reflect.has(target, prop);
    },

    ownKeys(target) {
        return Reflect.ownKeys(target);
    },

    getOwnPropertyDescriptor(target, prop) {
        return Reflect.getOwnPropertyDescriptor(target, prop);
    }
});
