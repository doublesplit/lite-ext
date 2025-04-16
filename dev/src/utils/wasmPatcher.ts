type PatchOperation = {
    pattern: number[];
    payload: number[];
    type: 'insertAfter' | 'insertBefore' | 'replaceAfter' | 'replaceBefore';
};

export function applyPatch(u8: Uint8Array, operations: PatchOperation[], anyFail: () => {}): Uint8Array {
    let result = u8;

    for (const { pattern, payload, type } of operations) {
        const index = findPattern(result, pattern);
        if (index === -1) {
            console.warn(`Pattern not found: ${pattern.map((b) => b.toString(16)).join(' ')}`);
            anyFail();
            continue;
        }

        let patchIndex = index;
        if (type === 'insertAfter') patchIndex = index + pattern.length;
        else if (type === 'insertBefore') patchIndex = index;
        else if (type === 'replaceAfter') {
            patchIndex = index + pattern.length;
            const sliceBefore = result.slice(0, patchIndex);
            const sliceAfter = result.slice(patchIndex + payload.length);
            result = concatUint8Arrays([sliceBefore, new Uint8Array(payload), sliceAfter]);
            continue;
        } else if (type === 'replaceBefore') {
            patchIndex = index - payload.length;
            if (patchIndex < 0) throw new Error('replaceBefore would underflow the buffer');
            const sliceBefore = result.slice(0, patchIndex);
            const sliceAfter = result.slice(index);
            result = concatUint8Arrays([sliceBefore, new Uint8Array(payload), sliceAfter]);
            continue;
        }

        // Default insert
        const sliceBefore = result.slice(0, patchIndex);
        const sliceAfter = result.slice(patchIndex);
        result = concatUint8Arrays([sliceBefore, new Uint8Array(payload), sliceAfter]);
    }

    return result;
}

function findPattern(buffer: Uint8Array, pattern: number[]): number {
    for (let i = 0; i <= buffer.length - pattern.length; i++) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
            if (buffer[i + j] !== pattern[j]) {
                match = false;
                break;
            }
        }
        if (match) return i;
    }
    return -1;
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}
