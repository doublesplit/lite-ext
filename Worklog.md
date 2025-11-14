## 2025-11-14

- Added automatic ULEB128 handling in wasm patcher:
    - Implemented readULEB/writeULEB helpers.
    - New patch op: replaceUlebAfter (rewrite varuint immediately after a matched pattern).
    - New APIs: fixSectionSizeByDelta(sectionId, delta) and autoFixCodeSectionSize(original, patched).
- Updated App.ts to remove hardcoded bytes for Code section size; now auto-fixes Code (id 0x0A) after all patches.
- Benefit: avoids brittle manual updates like B4 → 87 C6 and prevents “fell off end” errors when wasm changes across versions.
- Note: Code section header is fixed automatically; if bytes are inserted inside specific function bodies, their individual body sizes (ULEB) still need adjusting or a deeper pass.

### Tutorial: Fixing ULEB128 sizes in WebAssembly after patching

Why

- Inserting/removing bytes inside the Code section changes the real byte count. The section’s declared size (ULEB varuint) must be updated, otherwise the module fails to parse with errors like “fell off end”.
- Different builds can encode the same number with different ULEB byte sequences (e.g., B4 vs 87 C6 …), so hardcoding raw bytes is brittle.

What we implemented

- ULEB utilities: readULEB/writeULEB to decode/encode varuints used in wasm.
- Section size auto-fix:
    - fixSectionSizeByDelta(sectionId, delta): finds a section by id and rewrites its size using size+delta.
    - autoFixCodeSectionSize(original, patched): computes delta between buffers and fixes Code (id 0x0A) without any pattern.
- Optional targeted op: replaceUlebAfter — recodes a ULEB immediately after a matched pattern when you need a very specific place updated.

How it works

1. Apply all insert/replace patches to a Uint8Array.
2. Compute delta = patched.length − original.length.
3. Call autoFixCodeSectionSize(original, patched) — it locates section 0x0A and rewrites its varuint size with writeULEB(size+delta). The varuint may grow/shrink in bytes; the patcher handles this safely.

What it does not do

- It fixes the Code section header size. It does not automatically fix individual function body sizes inside the Code section. If you changed bytes inside a specific function body, that body’s leading ULEB size must also be updated (use a targeted pattern or implement deeper parsing over all bodies).

Verification (Windows)

- List sections/sizes: wasm-objdump -x .\agario.core.wasm
- Validate parsing: wasm2wat .\agario.core.wasm -o .\core.wat

Glossary

- ULEB128: Variable-length unsigned integer (7 data bits per byte; 0x80 continuation bit).
- varuint: ULEB-encoded unsigned integer.
- Code section (id 0x0A): Contains function bodies; each body starts with its own ULEB size.
- Delta: Net byte-size change introduced by patches (inserted − removed).
- “fell off end”: Parser error when declared size exceeds available bytes due to incorrect length fields.
