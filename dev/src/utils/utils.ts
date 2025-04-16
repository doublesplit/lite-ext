type Child = any;
type Condition = (child: Child, depth: number) => boolean;
/**
 * Finds all nodes in the given tree structure that match the specified condition.
 */
export function find_node(where = window['agarApp'].home, cond: Condition) {
    const results = [];

    const find_static = (where = window['agarApp'].home, cond: Condition) => {
        function each_children(child: Child, depth) {
            depth += 1;
            child.forEach((ch: Child) => {
                if (cond(ch, depth)) results.push(ch);
                ch.children && each_children(ch.children, depth);
            });
        }
        each_children(where, -1);
        return results;
    };

    function each_children(child: Child, depth: number) {
        depth += 1;
        if (cond(child, depth)) results.push(child);
        child._staticTrees && find_static(child._staticTrees, cond);
        // console.log(depth, 'TAG:', child, child.$vnode?.tag)
        child.$children?.forEach((ch: Child) => {
            each_children(ch, depth);
        });
        child.children?.forEach((ch: Child) => {
            each_children(ch, depth);
        });
        child._vnode?.children?.forEach((ch: Child) => {
            each_children(ch, depth);
        });
        child._vnode?.componentOptions?.children?.forEach((ch: Child) => {
            each_children(ch, depth);
        });
    }
    each_children(where, -1);
    return results;
}

export type Methods<T extends Object> = Array<
    keyof {
        [P in keyof T]: T[P] extends (...args: any[]) => any ? P : never;
    }
>;

/**
@example
overrideMethod(ctx, 'drawImage', (originalMethod, args) => {
    return originalMethod.apply(ctx, args);
})
 */

export function overrideMethod<
    T extends Object,
    K extends {
        [P in keyof T]: T[P] extends (...args: any[]) => any ? P : never;
    }[keyof T],
    P extends T[K] extends (...args: infer A) => any ? A : never
>(obj: T, methodName: K, getMethod: (originalMethod: T[K], args: P) => T[K]) {
    const originalMethod = obj[methodName] as T[K];
    obj[methodName] = function () {
        return getMethod(originalMethod, arguments as unknown as P);
    } as T[K];
}

export function overridePrototype<
    T extends Object,
    K extends {
        [P in keyof T]: T[P] extends (...args: any[]) => any ? P : never;
    }[keyof T],
    P extends T[K] extends (...args: infer A) => any ? A : never
>(obj: T, methodName: K, getMethod: (originalMethod: T[K]) => (...args: P) => T[K]) {
    const originalMethod = obj[methodName] as T[K] & Function;
    return (obj[methodName] = getMethod(originalMethod) as unknown as T[K]);
}

export const updateCssString = (() => {
    const records = {} as Record<string, HTMLStyleElement>;
    return (name: string, css: string) => {
        if (!records[name]) {
            const style = document.createElement('style');
            style.setAttribute('data-css-name', name);
            document.head.appendChild(style);
            records[name] = style;
        }
        records[name].textContent = css;
    };
})();

export function setCssVariable(_line: number, name: string, value: string | number, dimension?: string) {
    const root = document.body;
    if (dimension) value += dimension;
    if (value === 0) {
        value = 'none';
    }
    root.style.setProperty(`--${name}`, String(value));
}

export function camelCaseToWords(s: string) {
    const result = s.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
}
