type PatchOperation = {
    pattern: number[];
    payload: number[];
    type:
        | 'insertAfter'
        | 'insertBefore'
        | 'replaceAfter'
        | 'replaceBefore'
        // Special op: replace a ULEB128 number right after the pattern with (old + deltaInserted)
        // where deltaInserted is the total byte-length growth caused by previous ops.
        | 'replaceUlebAfter';
};

export function applyPatch(u8: Uint8Array, operations: PatchOperation[], anyFail: () => {}): Uint8Array {
    let result = u8;
    const initialLength = u8.length;

    for (const { pattern, payload, type } of operations) {
        const index = findPattern(result, pattern);
        if (index === -1) {
            console.error(`Pattern not found: ${pattern.map((b) => b.toString(16)).join(' ')}`);
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
        } else if (type === 'replaceUlebAfter') {
            // Compute new ULEB value = old + deltaInserted
            patchIndex = index + pattern.length;
            const { value: oldVal, length: oldLen } = readULEB(result, patchIndex);
            const deltaInserted = result.length - initialLength; // growth from previous ops
            const newVal = oldVal + deltaInserted;
            const newBytes = writeULEB(newVal);
            // Replace oldLen bytes with newBytes (may grow/shrink)
            const sliceBefore = result.slice(0, patchIndex);
            const sliceAfter = result.slice(patchIndex + oldLen);
            result = concatUint8Arrays([sliceBefore, newBytes, sliceAfter]);
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

// ---- ULEB128 helpers ----
function readULEB(buffer: Uint8Array, offset: number): { value: number; length: number } {
    let result = 0 >>> 0;
    let shift = 0;
    let pos = offset;
    while (pos < buffer.length) {
        const byte = buffer[pos++];
        result |= ((byte & 0x7f) << shift) >>> 0;
        if ((byte & 0x80) === 0) break;
        shift += 7;
        if (shift > 35) throw new Error('ULEB128 value too large');
    }
    return { value: result >>> 0, length: pos - offset };
}

function writeULEB(value: number): Uint8Array {
    if (value < 0) throw new Error('ULEB128 cannot encode negative values');
    const out: number[] = [];
    let v = value >>> 0;
    do {
        let byte = v & 0x7f;
        v >>>= 7;
        if (v !== 0) byte |= 0x80;
        out.push(byte);
    } while (v !== 0);
    return new Uint8Array(out);
}

// Public helpers to auto-fix section sizes without specifying a pattern
export function fixSectionSizeByDelta(u8: Uint8Array, sectionId: number, delta: number): Uint8Array {
    if (delta === 0) return u8;
    // Validate header
    if (u8.length < 8 || u8[0] !== 0x00 || u8[1] !== 0x61 || u8[2] !== 0x73 || u8[3] !== 0x6d) {
        console.warn('[wasmPatcher] Not a wasm module (magic mismatch)');
        return u8;
    }
    let i = 8; // skip version
    while (i < u8.length) {
        const sid = u8[i++];
        const sizeInfo = readULEB(u8, i);
        const sizeStart = i;
        const sizeLen = sizeInfo.length;
        const payloadSize = sizeInfo.value >>> 0;
        const payloadStart = i + sizeLen;
        if (sid === sectionId) {
            const newSize = payloadSize + delta;
            if (newSize < 0) {
                console.error('[wasmPatcher] Negative section size after delta, skipping');
                return u8;
            }
            const newSizeBytes = writeULEB(newSize);
            const before = u8.slice(0, sizeStart);
            const after = u8.slice(sizeStart + sizeLen);
            return concatUint8Arrays([before, newSizeBytes, after]);
        }
        i = payloadStart + payloadSize; // jump to next section using declared size
    }
    console.warn(`[wasmPatcher] Section ${sectionId} not found, no size fixed`);
    return u8;
}

export function autoFixCodeSectionSize(u8Original: Uint8Array, u8Patched: Uint8Array): Uint8Array {
    const delta = u8Patched.length - u8Original.length;
    if (delta === 0) return u8Patched;
    return fixSectionSizeByDelta(u8Patched, 0x0a, delta);
}
