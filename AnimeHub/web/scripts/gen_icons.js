// Genera los PNG de ic_launcher para API < 26 (mipmap-mdpi..xxxhdpi).
// Diseño: fondo #1A1A2E, triángulo de play blanco y punto #7C4DFF.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const RES_DIR = path.join(__dirname, '..', '..', 'app', 'src', 'main', 'res');
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

// CRC32
const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

function render(size) {
    const px = Buffer.alloc(size * size * 4);
    const bg = [0x1A, 0x1A, 0x2E];       // #1A1A2E
    const fg = [0xFF, 0xFF, 0xFF];       // play blanco
    const ac = [0x7C, 0x4D, 0xFF];       // #7C4DFF

    // Play triangle (viewport 108 -> escala a size)
    const s = size / 108;
    const tri = [[44, 36], [44, 72], [74, 54]].map(([x, y]) => [x * s, y * s]);
    const dot = { x: 78 * s, y: 76 * s, r: 6 * s };

    function inTri(x, y) {
        const [a, b, c] = tri;
        const d1 = (x - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (y - b[1]);
        const d2 = (x - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (y - c[1]);
        const d3 = (x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1]);
        const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
        return !(neg && pos);
    }

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            let col = bg;
            if (inTri(x + 0.5, y + 0.5)) col = fg;
            const dx = x + 0.5 - dot.x, dy = y + 0.5 - dot.y;
            if (dx * dx + dy * dy <= dot.r * dot.r) col = ac;
            px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
        }
    }

    // PNG: scanlines con filtro 0
    const raw = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y++) {
        raw[y * (size * 4 + 1)] = 0;
        px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

for (const [density, size] of Object.entries(DENSITIES)) {
    const dir = path.join(RES_DIR, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    const png = render(size);
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), png);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), png);
    console.log(`mipmap-${density}: ${size}px (${png.length} bytes)`);
}
