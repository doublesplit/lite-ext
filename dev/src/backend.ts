import { Eventify } from '../../Shared/src/utils/Eventify';
import { waitGunCreate } from './utils/gun-simplepeer';

/*
[serverToken]
  positions
     [Position]
      x
      y
      mass
      name
      accountID
 users
    [User]
     name
     accountID
     position
      x
      y
      mass
      name
      accountID


.
└── [serverToken]
    ├── positions
    │   └── [Position]
    │       ├── x
    │       ├── y
    │       ├── mass
    │       ├── name
    │       └── accountID
    └── users
        └── [User]
            ├── name
            ├── accountID
            └── position
                ├── x
                ├── y
                ├── mass
                ├── name
                └── accountID

gun._.opt.peers - это обьект в котором есть записи обьектов пиоров. RTCPeer, и обьект с ключом вебсокета
Общие ключи пиров
SH - время
SI - id
batch - null
id - string
last - string
met - time
query - []
tail - null
wire - WS / RTCDataChannel
*/
waitGunCreate().then((root) => {
    // setUpRTC(root, Gun);
});
//gundb-service
// Инициализация GunDB
const endpoints = [/*'https://peer.wallie.io/gun',*/ 'https://gundb-multiserver.glitch.me/gun'];
export const gun = Gun({ peers: endpoints });

Object.assign(window, { gun: gun });
export function disconnectWs(gun: IGunInstance<any>) {
    for (const [key, entry] of Object.entries(gun._.opt['peers'])) {
        if (!endpoints.includes(key)) continue;
        const wire = entry['wire'];
        delete gun._.opt['peers'][key];
        wire.onclose = null;
        wire.close();
    }
}
Object.assign(window, { gun: gun, disconnectWs: () => disconnectWs(gun) });

// Интерфейсы
export interface BroadcastObject {
    x: number;
    y: number;
    name: string;
    size: number;
    userId: string;
    aid: number;
}

export interface ChatMessage {
    text: string;
    userId: string;
    username: string;
    ts: number;
}

export interface User {
    alias: string;
    pub: string;
}

/**
 * Класс для управления авторизацией
 */
export class Auth extends Eventify<{
    login: (user: { username: string; userId: string }) => void;
    logout: () => void;
}> {
    username: string = null;
    userId: string = null;
    private user: IGunUserInstance<any, any, any, IGunInstanceRoot<any, IGunInstance<any>>> = null;

    constructor() {
        super();
        // Проверяем состояние авторизации при инициализации
        gun.user().recall({ sessionStorage: true });
        const existingUser = gun.user().is;
        if (existingUser) {
            const user = gun.user();
            this.user = user;
            this.notifyLogin();
        }
    }

    private async notifyLogin() {
        if (!this.user) return;

        const username = await this.getCurrentUsername();
        const userId = this.getCurrentUserId();

        this.username = username;
        this.userId = userId;

        if (username && userId) {
            this.emit('login', { username, userId });
        }
    }

    /**
     * Создание нового пользователя
     */
    public async createUser(username: string, password: string): Promise<boolean> {
        try {
            return new Promise((resolve) => {
                gun.user().create(username, password, async (ack: any) => {
                    if (ack.err) {
                        console.error('Ошибка регистрации:', ack.err);
                        resolve(false);
                        return;
                    }

                    console.log('Пользователь создан успешно');
                    const success = await this.login(username, password);
                    gun.user().recall({ sessionStorage: true });
                    resolve(success);
                });
            });
        } catch (err) {
            console.error('Ошибка при создании пользователя:', err);
            return false;
        }
    }

    /**
     * Авторизация пользователя
     */
    public async login(username: string, password: string): Promise<boolean> {
        try {
            return new Promise((resolve) => {
                gun.user().auth(username, password, async (ack: any) => {
                    if (ack.err) {
                        console.error('Ошибка авторизации:', ack.err);
                        resolve(false);
                        return;
                    }

                    this.user = gun.user();
                    console.log('Авторизация успешна:', username);
                    await this.notifyLogin();
                    gun.user().recall({ sessionStorage: true });
                    resolve(true);
                });
            });
        } catch (err) {
            console.error('Ошибка при авторизации:', err);
            return false;
        }
    }

    /**
     * Выход из системы
     */
    public logout(): void {
        gun.user().leave();
        this.emit('logout');
        this.user = null;
        this.username = null;
        this.userId = null;
        console.log('Выполнен выход из системы');
    }

    /**
     * Проверка авторизации пользователя
     */
    public isAuthenticated(): boolean {
        return this.user !== null && gun.user().is !== null;
    }

    /**
     * Получение ID текущего пользователя
     */
    public getCurrentUserId(): string {
        if (!this.user || !this.user.is) return '';
        return this.user.is.pub || '';
    }

    /**
     * Получение имени текущего пользователя
     */
    public async getCurrentUsername(): Promise<string> {
        if (!this.user) return '';

        return new Promise((resolve) => {
            this.user.get('alias').once((alias: string) => {
                resolve(alias || '');
            });
        });
    }
}

/**
 * Класс для управления чатом комнаты
 */
export class ChatRoom extends Eventify {
    roomId: string;
    private roomRef: IGunChain<any, IGunChain<any, IGunInstance<any>, IGunInstance<any>, 'chat_r'>, IGunInstance<any>, string> = null;
    private messageCallbacks: Set<(msg: ChatMessage) => void> = new Set();
    private processedMessages: Set<string> = new Set();
    private unsubscribeFn: (() => void) | null = null;

    constructor() {
        super();
    }
    /**
     * Подключение к комнате чата
     */
    public connect(roomId: string = this.roomId): void {
        if (this.roomRef) return;
        this.roomId = roomId;
        const roomRef = gun.get(`chat_r`).get(this.roomId);
        this.roomRef = roomRef;
        this.setupMessageListener();
    }

    private setupMessageListener() {
        if (!this.roomRef) return;

        const messageCallback = (data: any, key: string) => {
            if (data && data.text && data.userId && data.ts) {
                const messageId = `${data.userId}-${data.ts}-${data.text}`;

                if (!this.processedMessages.has(messageId)) {
                    const message: ChatMessage = {
                        text: data.text,
                        userId: data.userId,
                        username: data.username || 'Anonymous',
                        ts: data.ts
                    };

                    this.processedMessages.add(messageId);
                    this.messageCallbacks.forEach((callback) => callback(message));
                }
            }
        };

        this.roomRef.get('messages').map().on(messageCallback);

        // Сохраняем функцию отписки
        this.unsubscribeFn = () => {
            if (this.roomRef) {
                // @ts-ignore
                this.roomRef.get('messages').map().off(messageCallback);
            }
        };
    }

    /**
     * Отправка сообщения в комнату чата
     */
    public async sendMessage(userId: string, username: string, text: string): Promise<void> {
        if (!this.roomRef || !text.trim()) return;

        const message: ChatMessage = {
            text,
            userId,
            username,
            ts: Date.now()
        };

        this.roomRef.get('messages').set(message);
    }

    /**
     * Подписка на новые сообщения комнаты
     */
    public subscribeToMessages(callback: (msg: ChatMessage) => void): () => void {
        // Автоматически подключаемся при первой подписке
        if (!this.roomRef) {
            this.connect();
        }

        this.messageCallbacks.add(callback);
        return () => {
            this.messageCallbacks.delete(callback);

            // Если это была последняя подписка, отключаемся
            if (this.messageCallbacks.size === 0) {
                this.disconnect();
            }
        };
    }

    /**
     * Получение последних сообщений из комнаты
     */
    public async getLastMessages(limit: number = 20): Promise<ChatMessage[]> {
        if (!this.roomRef) {
            this.connect();
        }

        return new Promise((resolve) => {
            const messages: ChatMessage[] = [];
            const processedIds = new Set<string>();

            this.roomRef!.get('messages')
                .map()
                .once((data: any) => {
                    if (data && data.text && data.userId && data.ts) {
                        const messageId = `${data.userId}-${data.ts}-${data.text}`;
                        if (!processedIds.has(messageId)) {
                            processedIds.add(messageId);
                            messages.push({
                                text: data.text,
                                userId: data.userId,
                                username: data.username || 'Anonymous',
                                ts: data.ts
                            });
                        }
                    }
                })
                .then()
                .then(() => {
                    const sortedMessages = messages.sort((a, b) => b.ts - a.ts).slice(0, limit);
                    console.log('Полученные сообщения:', sortedMessages);
                    resolve(sortedMessages);
                });
        });
    }

    /**
     * Отключение от комнаты чата
     */
    public disconnect(): void {
        if (this.unsubscribeFn) {
            this.unsubscribeFn();
            this.unsubscribeFn = null;
        }

        this.messageCallbacks.clear();
        this.processedMessages.clear();
        if (this.roomRef) {
            this.roomRef.off();
            this.roomRef = null;
        }
    }
}

/**
 * Класс для бродкастинга объектов в комнат
 */
export class BroadcastRoom extends Eventify<any> {
    roomId: string = 'unknown';
    private roomRef: IGunChain<any, IGunChain<any, IGunInstance<any>, IGunInstance<any>, '耍'>, IGunInstance<any>, string>;
    private localData: Map<string, BroadcastObject> = new Map();
    private objectCallbacks: Set<(data: BroadcastObject, userId: string) => void> = new Set();
    private unsubscribeFn: (() => void) | null = null;

    constructor() {
        super();
    }

    /**
     * Подключение к комнате бродкаста
     */
    public connect(roomId: string = this.roomId): void {
        if (this.roomRef) return;
        this.roomId = roomId;
        const roomRef = gun.get(`耍`).get(this.roomId);
        this.roomRef = roomRef;
        this.setupObjectListener();
    }

    private setupObjectListener() {
        if (!this.roomRef) return;

        const objectCallback = (_data: string, b) => {
            console.log('Получен объект:', _data, b);
            if (!_data) return;
            const data = JSON.parse(LZString.decompress(_data)) as Partial<BroadcastObject>;
            if (data && data.x !== undefined && data.y !== undefined && data.userId) {
                const broadcastObj: BroadcastObject = {
                    x: data.x,
                    y: data.y,
                    name: data.name,
                    size: data.size || 0,
                    userId: data.userId,
                    aid: data.aid || 0
                };

                this.localData.set(data.userId, broadcastObj);
                this.objectCallbacks.forEach((callback) => callback(broadcastObj, data.userId));
            }
        };

        this.roomRef.map().get('+').on(objectCallback);
        // .on(function (last: string, _key: string, msg) {
        //     if (msg.put['>']) {
        //         return;
        //     }
        // });

        // Сохраняем функцию отписки
        this.unsubscribeFn = () => {
            if (this.roomRef) {
                this.roomRef.map().off();
            }
        };
    }
    public removeMinimapObject(userId: string) {
        // this.roomRef.get(`u${userId}<?1`).get('+').put(null);
        this.roomRef.get(`u${userId}<?1`).put(null);
    }
    /**
     * Отправка объекта в комнату бродкаста
     */
    public broadcast(data: Partial<BroadcastObject>): void {
        if (!this.roomRef) {
            this.connect();
        }

        const broadcastObj: Partial<BroadcastObject> = {
            ...data
        };

        this.localData.set(data.userId, broadcastObj as BroadcastObject);
        this.roomRef!.get(`u${data.userId}<?1`)
            .get('+')
            .put(LZString.compress(JSON.stringify(broadcastObj)));
    }

    /**
     * Подписка на обновления объектов в комнате
     */
    public subscribe(callback: (data: BroadcastObject, userId: string) => void): () => void {
        // Автоматически подключаемся при первой подписке
        if (!this.roomRef) {
            this.connect();
        }

        this.objectCallbacks.add(callback);
        return () => {
            this.objectCallbacks.delete(callback);

            // Если это была последняя подписка, отключаемся
            if (this.objectCallbacks.size === 0) {
                this.disconnect();
            }
        };
    }

    /**
     * Получение всех актуальных объектов из комнаты
     */
    public getAllObjects(): BroadcastObject[] {
        if (!this.roomRef) {
            this.connect();
        }
        return Array.from(this.localData.values());
    }

    public getLocalData(): Map<string, BroadcastObject> {
        return this.localData;
    }

    /**
     * Отключение от комнаты и очистка данных
     */
    public disconnect(): void {
        if (this.unsubscribeFn) {
            this.unsubscribeFn();
            this.unsubscribeFn = null;
        }

        this.objectCallbacks.clear();
        this.localData.clear();
        if (this.roomRef) {
            this.roomRef.off();
            this.roomRef = null;
        }
    }
}
export const createChatRoom = () => new ChatRoom();
export const createBroadcastRoom = () => new BroadcastRoom();
