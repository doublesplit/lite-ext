class Storage {
    #namespace = 'ds_';
    set(key: string, object: ReturnType<JSON['parse']>, namespace = this.#namespace, middleware = <T>(d: T) => d) {
        localStorage.setItem(namespace + key, middleware(JSON.stringify(object)));
    }
    get(key: string, namespace = this.#namespace, middleware = <T>(d: T) => d) {
        let obj = {};
        const rawData = localStorage.getItem(namespace + key);
        if (typeof rawData === 'string') {
            try {
                obj = JSON.parse(middleware(rawData));
            } catch (e) {
                console.error(e);
            }
        }
        return obj;
    }
    clear(key: string, namespace = this.#namespace) {
        return localStorage.removeItem(namespace + key);
    }
}

export const storage = new Storage();
