/**
 * 3D Game Boy — full-page scrollytelling rig (kriss.ai /home/overview style).
 * The Game Boy sits on a fixed fullscreen layer behind the page.
 * PRESS START zooms out of the title screen into the model; scrolling
 * flies the camera to the part of the Game Boy tied to each section.
 *
 * The model is a DMG-01-inspired build made from primitives: extruded
 * body with the classic rounded bottom-right corner, printed bezel,
 * recessed D-pad, angled A/B dish, SELECT/START pills and the diagonal
 * speaker grille — recolored to match the site's blue/cream palette.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const COLORS = {
    body:    0x1798a4,   // GBC teal shell
    recess:  0x0f7078,   // button dishes and grooves, one shade deeper
    bezel:   0x191b21,   // smoky black screen fascia
    dpad:    0x24262e,
    ab:      0x5a4a9e,   // violet A/B, GBC style
    pill:    0x39404e,
    led:     0xc0392b,
    slot:    0x23283b,
    ink:     0x1c2a54,
    cart:    0x6b57ab,   // atomic-purple game pak
};

/* roundRect landed in browsers only in 2022-23 — without it every screen
   draw call would throw and the display would stay blank */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        r = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2);
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

/* redraw queue for canvas-based prints once the web fonts arrive */
const fontRedraws = [];
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => fontRedraws.forEach(fn => fn()));
}

/* ------------------------------------------------------------
   Screen controller — GB-style "pages" rendered on a 2D canvas.
   Scrolling the site flips the screen to the matching section,
   with a quick palette-fade like a real cartridge scene change.
   ------------------------------------------------------------ */
function makeScreenController() {
    // Layout is authored in a logical 480×432 space; the backing canvas is
    // supersampled SS× so the type stays sharp when the camera moves close.
    const W = 480, H = 432; // 10:9 like the GB's 160×144
    const SS = 3;
    const cv = document.createElement('canvas');
    cv.width = W * SS; cv.height = H * SS;
    const ctx = cv.getContext('2d');

    /* GBC-era palette — Pokémon Gold/Crystal + Zelda DX flavored */
    const CREAM = '#f8f4e8', WHITE = '#fbfbf8', INK = '#20242c', NAVY = '#1c2a54',
          RED = '#c03028', GOLD = '#e0a020', GOLD_L = '#f8e080',
          BLUE = '#3868c8', TEAL = '#1898a0', GREEN = '#48a058',
          PURPLE = '#7858b0', MUTED = '#6e7891';
    const P = (size) => `${size}px "Press Start 2P", monospace`;

    let page = 'title';
    let fade = 0;   // white-out overlay right after a page flip
    let tick = 0;
    let hover = null;                        // hotspot under the pointer
    const blink = () => (tick >> 2) & 1;
    const TOUCH = window.matchMedia('(hover: none)').matches;

    /* clickable areas per page, in canvas px (match the draw code below) */
    const HOTSPOTS = {
        title: [
            { x: 130, y: 300, w: 220, h: 52, action: { type: 'scroll', sel: '#about' } },
        ],
        projects: [0, 1, 2, 3, 4].map(i => (
            { x: 26, y: 77 + i * 38, w: 396, h: 38, menu: i, action: { type: 'select', index: i } }
        )),
        cv: [
            { x: 122, y: 366, w: 236, h: 52, action: { type: 'link', href: 'mailto:carugoumberto@gmail.com?subject=CV%20request' } },
        ],
        contact: [
            { x: 18, y: 60,  w: 444, h: 96, action: { type: 'link', href: 'mailto:carugoumberto@gmail.com' } },
            { x: 18, y: 168, w: 444, h: 56, menu: 0, action: { type: 'link', href: 'mailto:carugoumberto@gmail.com' } },
            { x: 18, y: 232, w: 444, h: 56, menu: 1, action: { type: 'link', href: 'https://www.linkedin.com/in/umbertocarugo/' } },
            { x: 18, y: 296, w: 444, h: 56, menu: 2, action: { type: 'link', href: 'https://github.com/FreakinBBB' } },
        ],
        footer: [
            { x: 160, y: 306, w: 160, h: 64, action: { type: 'link', href: 'mailto:carugoumberto@gmail.com' } },
        ],
    };

    /* Menu rows are intentionally passive: they light up only under the pointer. */
    function menuSel() {
        return hover && hover.menu != null ? hover.menu : -1;
    }

    /* Colored page-title band with a shaded lower lip, GBC style. */
    function band(title, accent = NAVY) {
        ctx.fillStyle = accent;
        ctx.fillRect(0, 0, W, 56);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.fillRect(0, 50, W, 6);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = CREAM;
        ctx.font = P(15);
        ctx.fillText(title, W / 2, 28);
        if (blink()) {
            ctx.fillStyle = GOLD;
            ctx.fillRect(20, 22, 10, 10);
            ctx.fillRect(W - 30, 22, 10, 10);
        }
    }

    /* Faint Pokémon-Center floor tiles: diamond lattice with small
       hollow squares, tinted per page. */
    function tiles(color) {
        const t = 48;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        for (let y = 0; y < H; y += t) {
            for (let x = 0; x < W; x += t) {
                ctx.beginPath();
                ctx.moveTo(x + t / 2, y);
                ctx.lineTo(x + t, y + t / 2);
                ctx.lineTo(x + t / 2, y + t);
                ctx.lineTo(x, y + t / 2);
                ctx.closePath();
                ctx.stroke();
                ctx.strokeRect(x + t / 2 - 5, y + t / 2 - 5, 10, 10);
            }
        }
    }

    /* GBC-era dialog window: white panel, dark outline, colored trim. */
    function gbcWindow(x, y, w, h, accent, fill = WHITE) {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 10);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 8);
        ctx.stroke();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x + 7, y + 7, w - 14, h - 14, 5);
        ctx.stroke();
    }

    /* Four-point twinkle, like the shine on Gold/Crystal intros. */
    function sparkle(x, y, s, on, color = GOLD_L) {
        if (!on) return;
        ctx.fillStyle = color;
        ctx.fillRect(x - s, y - s / 3, s * 2, (s * 2) / 3);
        ctx.fillRect(x - s / 3, y - s, (s * 2) / 3, s * 2);
    }

    /* Zelda-style heart, full or empty. */
    function heart(x, y, full) {
        ctx.fillStyle = full ? RED : 'rgba(143, 160, 208, 0.4)';
        ctx.beginPath();
        ctx.arc(x - 5, y - 4, 6, 0, Math.PI * 2);
        ctx.arc(x + 5, y - 4, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - 10.5, y - 1);
        ctx.lineTo(x, y + 12);
        ctx.lineTo(x + 10.5, y - 1);
        ctx.closePath();
        ctx.fill();
    }

    /* Chunky pixel icons for the project menu, one color each. */
    const ICONS = {
        vr(x, y) { // VR headset
            ctx.fillStyle = '#c04888';
            ctx.fillRect(x, y + 6, 24, 13);
            ctx.fillRect(x + 9, y + 19, 6, 3);
            ctx.fillStyle = WHITE;
            ctx.fillRect(x + 4, y + 10, 6, 5);
            ctx.fillRect(x + 14, y + 10, 6, 5);
        },
        tab(x, y) { // tablet + stylus
            ctx.fillStyle = TEAL;
            ctx.fillRect(x + 2, y, 15, 24);
            ctx.fillStyle = WHITE;
            ctx.fillRect(x + 5, y + 3, 9, 15);
            ctx.fillStyle = GOLD;
            ctx.fillRect(x + 20, y + 4, 3, 15);
        },
        bot(x, y) { // NAO robot head
            ctx.fillStyle = '#e07830';
            ctx.fillRect(x + 2, y + 8, 20, 13);
            ctx.fillRect(x + 10, y + 3, 4, 5);
            ctx.fillStyle = RED;
            ctx.fillRect(x + 8, y, 8, 3);
            ctx.fillStyle = INK;
            ctx.fillRect(x + 6, y + 12, 4, 4);
            ctx.fillRect(x + 14, y + 12, 4, 4);
        },
        pill(x, y) { // trial capsule
            ctx.fillStyle = RED;
            ctx.beginPath(); ctx.roundRect(x, y + 7, 24, 10, 5); ctx.fill();
            ctx.fillStyle = WHITE;
            ctx.beginPath(); ctx.roundRect(x + 12, y + 7, 12, 10, 5); ctx.fill();
        },
        pin(x, y) { // map pin
            ctx.fillStyle = GREEN;
            ctx.beginPath(); ctx.arc(x + 12, y + 9, 8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x + 5, y + 12); ctx.lineTo(x + 19, y + 12); ctx.lineTo(x + 12, y + 24);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = WHITE;
            ctx.beginPath(); ctx.arc(x + 12, y + 9, 3.5, 0, Math.PI * 2); ctx.fill();
        },
    };

    /* Mini render of the real cartridge: atomic-purple pak, gold label. */
    function cartSprite(x, y, w, h) {
        ctx.fillStyle = '#6b57ab';
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
        ctx.fillStyle = '#4a3a80';
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 8, y + 6 + i * 6, w - 16, 3);
        const g = ctx.createLinearGradient(0, y + 26, 0, y + h - 10);
        g.addColorStop(0, GOLD_L);
        g.addColorStop(1, GOLD);
        ctx.fillStyle = g;
        ctx.fillRect(x + 10, y + 26, w - 20, h - 36);
        ctx.fillStyle = RED;
        ctx.font = P(9);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAPERS', x + w / 2, y + 26 + (h - 36) / 2 + 1);
    }

    /* Gen-2 style NPC sprite: the doctor, white coat over a blue shirt.
       k=ink, f=face, w=coat, b=blue, .=transparent */
    const DOC_SPRITE = [
        '.....kkkkkk.....',
        '...kkkkkkkkkk...',
        '..kkkkkkkkkkkk..',
        '..kkkkkkkkkkkk..',
        '..kkffffffffkk..',
        '..kffkffffkffk..',
        '..kffffffffffk..',
        '...kffffffffk...',
        '..kkwwwwwwwwkk..',
        '.kwwwwbbbbwwwwk.',
        '.kwwwwbbbbwwwwk.',
        '.kwwwwbbbbwwwwk.',
        '..kwwwwwwwwwwk..',
        '..kkbbkkkkbbkk..',
        '...kbbk..kbbk...',
        '...kkkk..kkkk...',
    ];
    function sprite(x, y, s) {
        const pal = { k: '#20242c', f: '#f0c096', w: '#fbfbf8', b: '#2b62b8' };
        DOC_SPRITE.forEach((row, ry) => {
            [...row].forEach((c, rx) => {
                if (c === '.') return;
                ctx.fillStyle = pal[c];
                ctx.fillRect(x + rx * s, y + ry * s, s, s);
            });
        });
    }

    /* Blinking ▼ "more text" marker, like the dialogue continue arrow. */
    function marker(x, y) {
        if (!blink()) return;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x + 8, y);
        ctx.lineTo(x, y + 9);
        ctx.closePath();
        ctx.fill();
    }

    function wrap(text, size, maxW) {
        ctx.font = P(size);
        const lines = [];
        let line = '';
        for (const word of text.split(' ')) {
            const probe = line ? `${line} ${word}` : word;
            if (ctx.measureText(probe).width > maxW && line) {
                lines.push(line);
                line = word;
            } else {
                line = probe;
            }
        }
        if (line) lines.push(line);
        return lines;
    }

    const PROJECTS = [
        ['VR NEUROREHAB',   'VR REHAB OF EXECUTIVE FUNCTIONS IN KIDS WITH DCD', 'vr'],
        ['DIGITAL REY-O',   'TABLET VS PAPER REY FIGURE VALIDATION STUDY',      'tab'],
        ['IOGIOCO',         'NAO ROBOT TEACHING GESTURES TO ASD CHILDREN',      'bot'],
        ['PHASE III TRIAL', 'SUB-INVESTIGATOR IN A PHASE III DRUG TRIAL',       'pill'],
        ['WHO-NPIA',        'WEB MAP OF MILAN CHILD NPI UNITS',                 'pin'],
    ];

    const pages = {
        /* Pokémon Gold/Crystal-style title: night sky, gold beveled
           wordmark, red version ribbon, blinking PRESS START. */
        title() {
            const sky = ctx.createLinearGradient(0, 0, 0, H);
            sky.addColorStop(0, '#0e1638');
            sky.addColorStop(0.65, '#23336e');
            sky.addColorStop(1, '#3a2a58');
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, W, H);
            [[40, 48], [122, 26], [210, 60], [300, 30], [382, 52], [440, 90],
             [70, 120], [420, 150], [30, 210], [452, 250]].forEach(([x, y], i) => {
                sparkle(x, y, 5, ((tick + i) % 5) < 3, i % 2 ? '#cfd8f8' : GOLD_L);
            });

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#cfd8f8';
            ctx.font = P(14);
            ctx.fillText('DR. UMBERTO', W / 2, 96);

            // gold beveled logo
            ctx.font = P(46);
            ctx.fillStyle = '#0a1028';
            ctx.fillText('CARUGO', W / 2 + 5, 168 + 5);
            const gold = ctx.createLinearGradient(0, 138, 0, 196);
            gold.addColorStop(0, GOLD_L);
            gold.addColorStop(0.55, GOLD);
            gold.addColorStop(1, '#b06a10');
            ctx.strokeStyle = '#5a3808';
            ctx.lineWidth = 6;
            ctx.lineJoin = 'round';
            ctx.strokeText('CARUGO', W / 2, 168);
            ctx.fillStyle = gold;
            ctx.fillText('CARUGO', W / 2, 168);
            sparkle(W / 2 - 128, 146, 7, blink());
            sparkle(W / 2 + 120, 186, 6, !blink());

            // red version ribbon
            const rw = 330, rh = 38, rx = (W - rw) / 2, ry = 208;
            ctx.fillStyle = RED;
            ctx.beginPath();
            ctx.roundRect(rx, ry, rw, rh, 19);
            ctx.fill();
            ctx.strokeStyle = '#701814';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(rx + 2, ry + 2, rw - 4, rh - 4, 17);
            ctx.stroke();
            ctx.fillStyle = WHITE;
            ctx.font = P(11);
            ctx.fillText('SPECIAL MEDIC VERSION', W / 2, ry + rh / 2 + 1);

            // the doctor NPC, gently bobbing under the ribbon
            sprite(W / 2 - 24, 252 + (blink() ? 0 : 2), 3);

            if (blink()) {
                ctx.fillStyle = GOLD_L;
                ctx.font = P(15);
                ctx.fillText('PRESS START', W / 2, 328);
            }

            ctx.fillStyle = '#8fa0d0';
            ctx.font = P(10);
            ctx.fillText("©'96.'26 CARUGO inc.", W / 2, 400);
        },

        /* TRAINER CARD: photo + identity block with level chip and two
           playful stat bars, then three clear skill rows. No badges. */
        about() {
            const bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#f8eecb');
            bgG.addColorStop(1, '#e8c878');
            ctx.fillStyle = bgG;
            ctx.fillRect(0, 0, W, H);

            // faded medical-cross watermark, tucked bottom-right
            ctx.strokeStyle = 'rgba(192, 48, 40, 0.08)';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.arc(W - 84, H - 92, 42, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(192, 48, 40, 0.08)';
            ctx.fillRect(W - 84 - 8, H - 92 - 24, 16, 48);
            ctx.fillRect(W - 84 - 24, H - 92 - 8, 48, 16);

            // card frame
            ctx.strokeStyle = '#8a5a10';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.roundRect(10, 10, W - 20, H - 20, 14);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(138, 90, 16, 0.45)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(20, 20, W - 40, H - 40, 10);
            ctx.stroke();

            // header
            ctx.fillStyle = RED;
            ctx.beginPath();
            ctx.roundRect(26, 26, W - 52, 46, 8);
            ctx.fill();
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = WHITE;
            ctx.font = P(14);
            ctx.fillText('TRAINER CARD', 44, 51);
            ctx.textAlign = 'right';
            ctx.font = P(9);
            ctx.fillText('ID No.29396', W - 44, 51);
            sparkle(W - 150, 40, 5, blink(), GOLD_L);

            // trainer photo, gold corner tabs
            ctx.fillStyle = WHITE;
            ctx.fillRect(40, 96, 144, 160);
            sprite(48, 112, 8);
            ctx.strokeStyle = NAVY;
            ctx.lineWidth = 4;
            ctx.strokeRect(42, 98, 140, 156);
            [[40, 96, 1, 1], [184, 96, -1, 1], [40, 256, 1, -1], [184, 256, -1, -1]].forEach(([x, y, sx, sy]) => {
                ctx.fillStyle = GOLD;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + 16 * sx, y);
                ctx.lineTo(x, y + 16 * sy);
                ctx.closePath();
                ctx.fill();
            });
            ctx.textAlign = 'center';
            ctx.fillStyle = '#6e5834';
            ctx.font = P(8);
            ctx.fillText('MILAN, ITALY', 112, 276);

            // identity block
            ctx.textAlign = 'left';
            ctx.fillStyle = '#8a5a10';
            ctx.font = P(9);
            ctx.fillText('DR. UMBERTO', 208, 106);
            ctx.fillStyle = INK;
            ctx.font = P(18);
            ctx.fillText('CARUGO', 208, 136);
            ctx.font = P(9);
            const lvw = ctx.measureText('MEDIC LV.29').width + 26;
            ctx.fillStyle = RED;
            ctx.beginPath();
            ctx.roundRect(208, 154, lvw, 28, 14);
            ctx.fill();
            ctx.fillStyle = WHITE;
            ctx.fillText('MEDIC LV.29', 221, 169);

            // stat bars, Pokémon status-screen style
            [['CURIOSITY', 1.0, GOLD, 202], ['SLEEP', 0.3, RED, 238]].forEach(([label, frac, c, y]) => {
                ctx.fillStyle = '#8a5a10';
                ctx.font = P(8);
                ctx.fillText(label, 208, y);
                ctx.fillStyle = 'rgba(90, 56, 8, 0.18)';
                ctx.beginPath();
                ctx.roundRect(208, y + 8, 224, 12, 6);
                ctx.fill();
                ctx.fillStyle = c;
                ctx.beginPath();
                ctx.roundRect(208, y + 8, 224 * frac, 12, 6);
                ctx.fill();
            });

            // divider + skill rows, full width
            ctx.fillStyle = GOLD;
            ctx.fillRect(44, 296, W - 88, 4);
            const rows = [
                [RED,   'MEDICINE', 'CHILD NPI RESIDENT · MILAN'],
                [BLUE,  'AI',       'XAIM MASTER · PAVIA'],
                [GREEN, 'RESEARCH', 'VR · GENETICS · DATA'],
            ];
            rows.forEach(([c, head, sub], i) => {
                const y = 322 + i * 32;
                ctx.fillStyle = c;
                ctx.fillRect(44, y - 6, 12, 12);
                ctx.textAlign = 'left';
                ctx.fillStyle = INK;
                ctx.font = P(11);
                ctx.fillText(head, 68, y);
                ctx.textAlign = 'right';
                ctx.fillStyle = '#6e5834';
                ctx.font = P(9);
                ctx.fillText(sub, W - 48, y);
            });
        },

        /* Item-get scene: the Gold/Crystal paper pak, sparkling. */
        papers() {
            ctx.fillStyle = CREAM;
            ctx.fillRect(0, 0, W, H);
            tiles('rgba(56, 104, 200, 0.10)');
            band('PAPERS', NAVY);

            gbcWindow(18, 72, W - 36, 200, GOLD);
            cartSprite(46, 100, 120, 144);
            sparkle(52, 104, 7, blink());
            sparkle(162, 232, 6, !blink());
            sparkle(160, 106, 5, (tick % 3) < 2);

            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = MUTED;
            ctx.font = P(10);
            ctx.fillText('CART INSERTED:', 196, 122);
            ctx.font = P(16);
            ctx.strokeStyle = '#5a3808';
            ctx.lineWidth = 5;
            ctx.lineJoin = 'round';
            ctx.strokeText('CARUGO', 196, 158);
            ctx.strokeText('PAPERS', 196, 190);
            ctx.fillStyle = GOLD;
            ctx.fillText('CARUGO', 196, 158);
            ctx.fillText('PAPERS', 196, 190);
            ctx.fillStyle = RED;
            ctx.font = P(9);
            ctx.fillText('GOLD & CRYSTAL EDITION', 196, 222);
            ctx.fillStyle = MUTED;
            ctx.fillText('4 ENTRIES · VER.2026', 196, 246);

            gbcWindow(18, 292, W - 36, 122, RED);
            [['A', 'ARTICLES'], ['B', 'POSTERS']].forEach(([l, txt], i) => {
                const y = 326 + i * 42;
                ctx.fillStyle = '#5a4a9e'; // the console's violet buttons
                ctx.beginPath();
                ctx.arc(58, y, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = INK;
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.fillStyle = WHITE;
                ctx.font = P(11);
                ctx.textAlign = 'center';
                ctx.fillText(l, 58, y + 1);
                ctx.textAlign = 'left';
                ctx.fillStyle = INK;
                ctx.fillText(`SIDE ${l}: ${txt}`, 86, y);
            });
            marker(W - 52, 390);
        },

        /* Pokédex-style menu with pixel icons + description window. */
        projects() {
            ctx.fillStyle = '#eef3fa';
            ctx.fillRect(0, 0, W, H);
            band('PROJECTS', BLUE);
            gbcWindow(18, 66, W - 36, 210, BLUE);

            const sel = menuSel();
            const icons = [ICONS.vr, ICONS.tab, ICONS.bot, ICONS.pill, ICONS.pin];
            PROJECTS.forEach(([name], i) => {
                const cy = 96 + i * 38;
                if (i === sel) {
                    ctx.fillStyle = '#cfe0f8';
                    ctx.fillRect(28, cy - 17, W - 56, 34);
                    ctx.fillStyle = RED;
                    ctx.beginPath();
                    ctx.moveTo(34, cy - 8); ctx.lineTo(34, cy + 8); ctx.lineTo(46, cy);
                    ctx.closePath();
                    ctx.fill();
                }
                icons[i](56, cy - 12);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = i === sel ? NAVY : INK;
                ctx.font = P(13);
                ctx.fillText(name, 94, cy);
            });

            gbcWindow(18, 292, W - 36, 122, GOLD);
            ctx.textAlign = 'left';
            ctx.fillStyle = INK;
            const hint = TOUCH ? 'TAP A PROJECT TO INSPECT' : 'HOVER A PROJECT TO INSPECT';
            const detail = sel >= 0 ? PROJECTS[sel][1] : hint;
            wrap(detail, 12, W - 104).slice(0, 3).forEach((line, i) => {
                ctx.fillText(line, 46, 324 + i * 27);
            });
            if (sel >= 0) marker(W - 52, 392);
        },

        /* Zelda DX file-select: dark screen, gold year chips, hearts. */
        cv() {
            ctx.fillStyle = '#14204a';
            ctx.fillRect(0, 0, W, H);
            tiles('rgba(143, 160, 208, 0.08)');
            band('CURRICULUM VITAE', RED);

            const rows = [
                ['2025', 'XAIM MASTER, PAVIA'],
                ['2024', 'CCAIM, CAMBRIDGE'],
                ['2022', 'NPI RESIDENCY, MILAN'],
                ['2021', 'ERASMUS MC ROTTERDAM'],
                ['2015', 'MD @ PAVIA'],
            ];
            ctx.textBaseline = 'middle';
            rows.forEach(([year, text], i) => {
                const y = 96 + i * 46;
                ctx.fillStyle = GOLD;
                ctx.beginPath();
                ctx.roundRect(40, y - 14, 74, 28, 6);
                ctx.fill();
                ctx.strokeStyle = '#8a5a10';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(41, y - 13, 72, 26, 5);
                ctx.stroke();
                ctx.fillStyle = '#20242c';
                ctx.font = P(11);
                ctx.textAlign = 'center';
                ctx.fillText(year, 77, y + 1);
                ctx.textAlign = 'left';
                ctx.fillStyle = WHITE;
                ctx.font = P(12);
                ctx.fillText(text, 132, y);
                ctx.fillStyle = 'rgba(143, 160, 208, 0.35)';
                ctx.fillRect(40, y + 21, W - 80, 2);
            });

            for (let i = 0; i < 5; i++) heart(52 + i * 30, 336, i < 4);
            ctx.fillStyle = '#8fa0d0';
            ctx.font = P(9);
            ctx.textAlign = 'left';
            ctx.fillText('EXP: 11 YRS', 210, 338);

            ctx.fillStyle = '#1a2a5e';
            ctx.beginPath();
            ctx.roundRect(122, 366, 236, 52, 10);
            ctx.fill();
            ctx.strokeStyle = GOLD;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(125, 369, 230, 46, 8);
            ctx.stroke();
            if (blink()) {
                ctx.fillStyle = GOLD_L;
                ctx.font = P(11);
                ctx.textAlign = 'center';
                ctx.fillText('FULL CV: JUST ASK', W / 2, 393);
            }
        },

        /* CarugoGear phone: status bar, contact card, one big button
           per channel with its real address, tap hint. */
        contact() {
            const sea = ctx.createLinearGradient(0, 0, 0, H);
            sea.addColorStop(0, '#1898a0');
            sea.addColorStop(1, '#0c5e68');
            ctx.fillStyle = sea;
            ctx.fillRect(0, 0, W, H);

            // status bar
            ctx.fillStyle = '#142038';
            ctx.fillRect(0, 0, W, 44);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = CREAM;
            ctx.font = P(10);
            ctx.fillText('CARUGOGEAR', 20, 24);
            for (let i = 0; i < 4; i++) {
                ctx.fillStyle = i < 3 ? '#48d0a8' : 'rgba(248, 244, 232, 0.3)';
                ctx.fillRect(W - 124 + i * 11, 32 - (8 + i * 5), 7, 8 + i * 5);
            }
            ctx.fillStyle = CREAM;
            ctx.textAlign = 'right';
            ctx.fillText(blink() ? '10:29' : '10 29', W - 20, 24);

            // contact card: avatar, name, status
            gbcWindow(18, 60, W - 36, 96, TEAL);
            ctx.fillStyle = WHITE;
            ctx.fillRect(36, 74, 68, 68);
            sprite(38, 76, 4);
            ctx.strokeStyle = NAVY;
            ctx.lineWidth = 3;
            ctx.strokeRect(38, 76, 64, 64);
            ctx.textAlign = 'left';
            ctx.fillStyle = INK;
            ctx.font = P(13);
            ctx.fillText('DR. CARUGO', 122, 96);
            ctx.fillStyle = '#217a48';
            ctx.beginPath();
            ctx.arc(128, 128, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = P(9);
            ctx.fillText('ONLINE · MILAN', 142, 128);

            // one button per channel
            const rowsC = [
                ['EMAIL',    'CARUGOUMBERTO@GMAIL.COM', RED],
                ['LINKEDIN', '/UMBERTOCARUGO',          '#2867b2'],
                ['GITHUB',   '/FREAKINBBB',             '#24292f'],
            ];
            const sel = menuSel();
            rowsC.forEach(([name, sub, c], i) => {
                const y0 = 168 + i * 64, cy = y0 + 28;
                ctx.fillStyle = i === sel ? '#cdeef0' : WHITE;
                ctx.beginPath();
                ctx.roundRect(18, y0, W - 36, 56, 12);
                ctx.fill();
                ctx.strokeStyle = INK;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.roundRect(20, y0 + 2, W - 40, 52, 10);
                ctx.stroke();
                if (i === sel) {
                    ctx.strokeStyle = TEAL;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.roundRect(25, y0 + 7, W - 50, 42, 6);
                    ctx.stroke();
                }
                if (i === 0) {          // envelope
                    ctx.fillStyle = RED;
                    ctx.beginPath();
                    ctx.roundRect(40, cy - 11, 30, 22, 4);
                    ctx.fill();
                    ctx.strokeStyle = WHITE;
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(43, cy - 8);
                    ctx.lineTo(55, cy + 2);
                    ctx.lineTo(67, cy - 8);
                    ctx.stroke();
                } else if (i === 1) {   // "in" tile
                    ctx.fillStyle = c;
                    ctx.beginPath();
                    ctx.roundRect(42, cy - 13, 26, 26, 6);
                    ctx.fill();
                    ctx.fillStyle = WHITE;
                    ctx.font = `700 16px 'Instrument Sans', sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.fillText('in', 55, cy + 2);
                } else {                // octocat tile
                    ctx.fillStyle = c;
                    ctx.beginPath();
                    ctx.roundRect(42, cy - 13, 26, 26, 6);
                    ctx.fill();
                    ctx.fillStyle = WHITE;
                    ctx.beginPath();
                    ctx.arc(55, cy + 2, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(48, cy - 3); ctx.lineTo(48, cy - 10); ctx.lineTo(53, cy - 5);
                    ctx.moveTo(62, cy - 3); ctx.lineTo(62, cy - 10); ctx.lineTo(57, cy - 5);
                    ctx.fill();
                    ctx.fillStyle = c;
                    ctx.beginPath();
                    ctx.arc(52, cy + 1, 1.6, 0, Math.PI * 2);
                    ctx.arc(58, cy + 1, 1.6, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.textAlign = 'left';
                ctx.fillStyle = INK;
                ctx.font = P(13);
                ctx.fillText(name, 92, cy - 9);
                ctx.fillStyle = MUTED;
                ctx.font = P(8);
                ctx.fillText(sub, 92, cy + 15);
                ctx.textAlign = 'right';
                ctx.fillStyle = c;
                ctx.font = P(14);
                ctx.fillText('>', W - 40, cy);
            });

            if (blink()) {
                ctx.textAlign = 'center';
                ctx.fillStyle = CREAM;
                ctx.font = P(10);
                ctx.fillText(TOUCH ? 'TAP TO CONNECT' : 'CLICK TO CONNECT', W / 2, 404);
            }
        },

        /* Hall of Fame: night sky, falling confetti, gold sign-off. */
        footer() {
            ctx.fillStyle = '#0e1638';
            ctx.fillRect(0, 0, W, H);
            [[36, 60, RED], [120, 40, GOLD], [210, 74, '#48d0a8'], [300, 38, BLUE],
             [398, 64, PURPLE], [60, 150, GOLD], [420, 140, RED], [90, 330, '#48d0a8'],
             [380, 350, GOLD], [240, 116, '#cfd8f8'], [150, 390, BLUE], [330, 396, RED]].forEach(([x, y, c], i) => {
                if (((tick + i) % 4) === 3) return;
                ctx.fillStyle = c;
                ctx.fillRect(x, y + ((tick + i) % 4) * 2, 8, 8);
            });

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = P(20);
            const gold = ctx.createLinearGradient(0, 120, 0, 204);
            gold.addColorStop(0, GOLD_L);
            gold.addColorStop(1, GOLD);
            ctx.strokeStyle = '#5a3808';
            ctx.lineWidth = 6;
            ctx.lineJoin = 'round';
            ctx.strokeText('THANKS FOR', W / 2, 148);
            ctx.strokeText('PLAYING!', W / 2, 192);
            ctx.fillStyle = gold;
            ctx.fillText('THANKS FOR', W / 2, 148);
            ctx.fillText('PLAYING!', W / 2, 192);

            ctx.fillStyle = '#8fa0d0';
            ctx.font = P(10);
            ctx.fillText("©'96.'26 CARUGO inc.", W / 2, 254);

            ctx.fillStyle = '#1a2a5e';
            ctx.beginPath();
            ctx.roundRect(160, 306, 160, 64, 12);
            ctx.fill();
            ctx.strokeStyle = GOLD;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(164, 310, 152, 56, 9);
            ctx.stroke();
            if (blink()) {
                ctx.fillStyle = GOLD_L;
                ctx.font = P(13);
                ctx.fillText('SAY HI!', W / 2, 340);
            }
        },
    };

    function draw() {
        ctx.setTransform(SS, 0, 0, SS, 0, 0);
        ctx.fillStyle = CREAM;
        ctx.fillRect(0, 0, W, H);
        (pages[page] || pages.title)();
        // underline the hovered link so it reads as clickable
        // (menu rows already get a highlight bar, no underline needed)
        if (hover && hover.action.type === 'link' && hover.menu == null) {
            ctx.fillStyle = RED;
            ctx.fillRect(hover.x + 6, hover.y + hover.h - 6, hover.w - 12, 4);
        }
        if (fade > 0) {
            // GBC-style white flash on scene change
            ctx.fillStyle = `rgba(248, 248, 248, ${fade.toFixed(2)})`;
            ctx.fillRect(0, 0, W, H);
            fade = Math.max(0, fade - 0.34);
        }
    }

    draw();
    const texture = new THREE.CanvasTexture(cv);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const redraw = () => { draw(); texture.needsUpdate = true; };
    setInterval(() => {
        if (document.hidden) return; // don't repaint/upload in background tabs
        tick++;
        redraw();
    }, 160);
    fontRedraws.push(redraw);

    return {
        texture,
        setPage(next) {
            if (next === page || !pages[next]) return;
            page = next;
            fade = 1;
            hover = null;
        },
        /* uv → hotspot on the current page (u,v as returned by the raycaster) */
        hitTest(u, v) {
            const x = u * W, y = (1 - v) * H;
            return (HOTSPOTS[page] || []).find(r =>
                x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
            ) || null;
        },
        setHover(next) {
            if (next === hover) return;
            hover = next;
            redraw();
        },
    };
}

/* ------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------ */

/* Weld duplicated vertices and recompute normals so extruded
   bevels shade smoothly instead of showing faceted strips. */
function weldedSmooth(geometry) {
    const pos = geometry.attributes.position;
    const prec = 1e4;
    const map = new Map();
    const verts = [];
    const indices = [];
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const key = `${Math.round(x * prec)}|${Math.round(y * prec)}|${Math.round(z * prec)}`;
        let idx = map.get(key);
        if (idx === undefined) {
            idx = verts.length / 3;
            verts.push(x, y, z);
            map.set(key, idx);
        }
        indices.push(idx);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
}

/* Transparent canvas print (labels, logos) as a plane mesh. */
function makePrint(w, h, drawFn, pxPerUnit = 240) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * pxPerUnit);
    cv.height = Math.round(h * pxPerUnit);
    const ctx = cv.getContext('2d');

    const draw = () => {
        ctx.clearRect(0, 0, cv.width, cv.height);
        drawFn(ctx, cv.width, cv.height);
    };
    draw();

    const texture = new THREE.CanvasTexture(cv);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    fontRedraws.push(() => { draw(); texture.needsUpdate = true; });

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.6, metalness: 0 })
    );
    mesh.userData.redraw = () => { draw(); texture.needsUpdate = true; };
    return mesh;
}

/* Cartridge label with clickable publication rows. Deliberately clean
   and flat for readability: slim Game Boy Color banner, calm gold or
   crystal field, one big outlined wordmark with the side line under
   it, entries on dark plates. `style` picks the colorway ('gold' or
   'crystal'). Rows with an href get a ">" affordance, a hover
   highlight and a raycast hotspot. */
function makeCartLabel(side, entries, style) {
    let hoverIdx = -1;
    const rowTop = (i) => 0.53 + i * 0.215; // row baseline, as fraction of label height
    const gold = style === 'gold';

    const mesh = makePrint(2.6, 2.1, (ctx, w, h) => {
        const P = (s) => `${s}px "Press Start 2P", monospace`;

        // sticker base
        ctx.fillStyle = '#ddd6ce';
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, w * 0.02);
        ctx.fill();

        // flat, calm art field
        const fx = w * 0.045, fy = h * 0.045, fw = w * 0.91, fh = h * 0.875;
        const field = ctx.createLinearGradient(0, fy, 0, fy + fh);
        if (gold) {
            field.addColorStop(0, '#f0cd5e');
            field.addColorStop(1, '#d99b28');
        } else {
            field.addColorStop(0, '#7fc4e0');
            field.addColorStop(1, '#2a6ba8');
        }
        ctx.fillStyle = field;
        ctx.fillRect(fx, fy, fw, fh);

        // top banner, like the Game Boy Color strip on real labels
        const bh = fh * 0.085;
        ctx.fillStyle = '#101018';
        ctx.fillRect(fx, fy, fw, bh);
        ctx.textBaseline = 'middle';
        ctx.font = `italic 700 ${bh * 0.52}px 'Instrument Sans', sans-serif`;
        const segs = [['Carugo GAME BOY ', '#d8d2cb'],
            ['C', '#b06ac0'], ['O', '#4098e0'], ['L', '#58b858'], ['O', '#e8c030'], ['R', '#e05048']];
        let bx = fx + fw / 2 - segs.reduce((a, [t]) => a + ctx.measureText(t).width, 0) / 2;
        ctx.textAlign = 'left';
        segs.forEach(([t, c]) => {
            ctx.fillStyle = c;
            ctx.fillText(t, bx, fy + bh * 0.56);
            bx += ctx.measureText(t).width;
        });

        // clean title block: eyebrow, flat outlined wordmark, side line
        const vpx = fx + fw / 2;
        ctx.textAlign = 'center';
        ctx.fillStyle = gold ? '#5a3808' : '#eaf6fc';
        ctx.font = P(h * 0.034);
        ctx.fillText('CARUGO', vpx, fy + fh * 0.165);
        const ly = fy + fh * 0.275;
        ctx.font = P(h * 0.105);
        ctx.lineJoin = 'round';
        ctx.lineWidth = h * 0.022;
        ctx.strokeStyle = gold ? '#f8ecc0' : '#0e2448';
        ctx.strokeText('PAPERS', vpx, ly);
        ctx.fillStyle = gold ? '#1c2a54' : '#fbfbf8';
        ctx.fillText('PAPERS', vpx, ly);
        ctx.font = P(h * 0.030);
        ctx.fillStyle = gold ? '#8a1c14' : '#ffd24a';
        ctx.fillText(side, vpx, fy + fh * 0.385);

        // entry rows on dark plates — plain year, big title, venue
        entries.forEach((e, i) => {
            const y = h * rowTop(i);
            const px = fx + fw * 0.03, pw = fw * 0.94;
            ctx.fillStyle = i === hoverIdx && e.href
                ? (gold ? 'rgba(66, 38, 8, 0.92)' : 'rgba(10, 32, 66, 0.92)')
                : (gold ? 'rgba(44, 26, 6, 0.78)' : 'rgba(8, 22, 46, 0.75)');
            ctx.beginPath();
            ctx.roundRect(px, y - h * 0.070, pw, h * 0.178, 14);
            ctx.fill();
            if (i === hoverIdx && e.href) {
                ctx.strokeStyle = gold ? '#f8e080' : '#7fd8f0';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            ctx.textAlign = 'left';
            ctx.fillStyle = gold ? '#f0c030' : '#9fe2f5';
            ctx.font = P(h * 0.038);
            ctx.fillText(e.year, px + fw * 0.035, y);
            // auto-shrink the title into its centred column
            let titleSize = h * 0.048;
            ctx.font = P(titleSize);
            while (ctx.measureText(e.title).width > fw * 0.52 && titleSize > h * 0.026) {
                titleSize -= 1;
                ctx.font = P(titleSize);
            }
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fdf6e0';
            ctx.fillText(e.title, fx + fw * 0.56, y - h * 0.010);
            let venueSize = h * 0.030;
            ctx.font = P(venueSize);
            while (ctx.measureText(e.venue).width > fw * 0.70 && venueSize > h * 0.018) {
                venueSize -= 1;
                ctx.font = P(venueSize);
            }
            ctx.fillStyle = gold ? '#d8c48a' : '#a8cfe4';
            ctx.fillText(e.venue, fx + fw * 0.56, y + h * 0.058);
            if (e.href) {
                ctx.textAlign = 'right';
                ctx.fillStyle = gold ? '#f8e080' : '#7fd8f0';
                ctx.font = P(h * 0.052);
                ctx.fillText('>', px + pw - fw * 0.03, y);
            }
        });

        // quiet base-margin footer
        ctx.textAlign = 'center';
        ctx.fillStyle = '#8a8078';
        ctx.font = P(h * 0.022);
        ctx.fillText('MADE IN ITALY', w / 2, h * 0.965);
    }, 300);

    return {
        mesh,
        hitTest(uv) {
            const cy = 1 - uv.y; // canvas-space y, 0 at the top of the label
            for (let i = 0; i < entries.length; i++) {
                if (!entries[i].href) continue;
                const top = rowTop(i);
                if (cy >= top - 0.08 && cy <= top + 0.115) {
                    return { index: i, action: { type: 'link', href: entries[i].href } };
                }
            }
            return null;
        },
        setHover(i) {
            if (i === hoverIdx) return;
            hoverIdx = i;
            mesh.userData.redraw();
        },
    };
}

/* ------------------------------------------------------------
   Game Boy model — DMG-01 silhouette from primitives
   ------------------------------------------------------------ */
function buildGameBoy(screenTexture) {
    const gb = new THREE.Group();
    // physical controls → navigation actions (consumed by the raycaster)
    const buttons = new Map();

    const bodyMat   = new THREE.MeshStandardMaterial({ color: COLORS.body, roughness: 0.38, metalness: 0.05 });
    const recessMat = new THREE.MeshStandardMaterial({ color: COLORS.recess, roughness: 0.5, metalness: 0.02 });
    const bezelMat  = new THREE.MeshStandardMaterial({ color: COLORS.bezel, roughness: 0.32, metalness: 0.1 });
    const dpadMat   = new THREE.MeshStandardMaterial({ color: COLORS.dpad, roughness: 0.45 });
    const abMat     = new THREE.MeshStandardMaterial({ color: COLORS.ab, roughness: 0.35 });
    const pillMat   = new THREE.MeshStandardMaterial({ color: COLORS.pill, roughness: 0.5 });
    const slotMat   = new THREE.MeshStandardMaterial({ color: COLORS.slot, roughness: 0.6 });

    /* --- body: extruded plate, symmetric wide-rounded bottom (GBC) --- */
    const W2 = 2.8, H2 = 4.7;       // half extents → 5.6 × 9.4 like before
    const rT = 0.5, rBL = 1.25, rBR = 1.25;
    const shape = new THREE.Shape();
    shape.moveTo(-W2, -H2 + rBL);
    shape.lineTo(-W2, H2 - rT);
    shape.absarc(-W2 + rT, H2 - rT, rT, Math.PI, Math.PI / 2, true);
    shape.lineTo(W2 - rT, H2);
    shape.absarc(W2 - rT, H2 - rT, rT, Math.PI / 2, 0, true);
    shape.lineTo(W2, -H2 + rBR);
    shape.absarc(W2 - rBR, -H2 + rBR, rBR, 0, -Math.PI / 2, true);
    shape.lineTo(-W2 + rBL, -H2);
    shape.absarc(-W2 + rBL, -H2 + rBL, rBL, -Math.PI / 2, -Math.PI, true);
    shape.closePath();

    const bodyGeo = weldedSmooth(new THREE.ExtrudeGeometry(shape, {
        depth: 1.3,
        curveSegments: 24,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.09,
        bevelSegments: 5,
    }));
    bodyGeo.translate(0, 0, -0.65); // center depth → faces at z ≈ ±0.75
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    gb.add(body);

    /* --- GBC screen fascia: big rounded smoky-black panel --- */
    const bezShape = new THREE.Shape();
    {
        const bw = 2.475, bh = 2.075, br = 0.62;
        bezShape.moveTo(-bw, -bh + br);
        bezShape.lineTo(-bw, bh - br);
        bezShape.absarc(-bw + br, bh - br, br, Math.PI, Math.PI / 2, true);
        bezShape.lineTo(bw - br, bh);
        bezShape.absarc(bw - br, bh - br, br, Math.PI / 2, 0, true);
        bezShape.lineTo(bw, -bh + br);
        bezShape.absarc(bw - br, -bh + br, br, 0, -Math.PI / 2, true);
        bezShape.lineTo(-bw + br, -bh);
        bezShape.absarc(-bw + br, -bh + br, br, -Math.PI / 2, -Math.PI, true);
        bezShape.closePath();
    }
    const bezelGeo = weldedSmooth(new THREE.ExtrudeGeometry(bezShape, {
        depth: 0.12,
        curveSegments: 20,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 3,
    }));
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    bezel.position.set(0, 2.35, 0.66);
    bezel.castShadow = true;
    gb.add(bezel);

    /* fascia print: POWER legend + GAME BOY COLOR-style rainbow wordmark */
    const bezelPrint = makePrint(4.95, 4.15, (ctx, w, h) => {
        ctx.textBaseline = 'middle';
        // POWER, under the LED on the left margin
        ctx.textAlign = 'center';
        ctx.font = `600 ${h * 0.022}px 'Instrument Sans', sans-serif`;
        ctx.fillStyle = '#9aa0ab';
        ctx.fillText('POWER', w * 0.068, h * 0.27);
        // wordmark under the glass: silver CARUGO + rainbow COLOR
        const size = h * 0.05;
        ctx.font = `italic 700 ${size}px 'Instrument Sans', sans-serif`;
        const wordA = 'CARUGO';
        const letters = [...'COLOR'];
        const colors = ['#b06ac0', '#4098e0', '#58b858', '#e8c030', '#e05048'];
        const gap = w * 0.014;
        const wA = ctx.measureText(wordA).width;
        const wL = letters.map(l => ctx.measureText(l).width);
        const total = wA + gap * 1.8 + wL.reduce((a, b) => a + b, 0) + gap * 0.4 * (letters.length - 1);
        let x = (w - total) / 2;
        const cy = h * 0.925;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#c8cdd6';
        ctx.fillText(wordA, x, cy);
        x += wA + gap * 1.8;
        letters.forEach((l, i) => {
            ctx.fillStyle = colors[i];
            ctx.fillText(l, x, cy);
            x += wL[i] + gap * 0.4;
        });
    }, 320);
    bezelPrint.position.set(0, 2.35, 0.845);
    gb.add(bezelPrint);

    const screenMat = new THREE.MeshStandardMaterial({
        map: screenTexture,
        roughness: 0.25,
        metalness: 0.0,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.24), screenMat);
    screen.position.set(0, 2.55, 0.86);
    gb.add(screen);

    const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 12),
        new THREE.MeshStandardMaterial({ color: COLORS.led, emissive: COLORS.led, emissiveIntensity: 0.9 })
    );
    led.position.set(-2.14, 3.45, 0.865);
    gb.add(led);

    /* --- D-pad in a circular recess --- */
    const dpadDish = new THREE.Mesh(new THREE.CircleGeometry(1.16, 40), recessMat);
    dpadDish.position.set(-1.5, -1.15, 0.752);
    gb.add(dpadDish);

    const dpadH = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.6, 0.34, 3, 0.11), dpadMat);
    dpadH.position.set(-1.5, -1.15, 0.82);
    const dpadV = new THREE.Mesh(new RoundedBoxGeometry(0.6, 1.7, 0.34, 3, 0.11), dpadMat);
    dpadV.position.set(-1.5, -1.15, 0.82);
    const dpadDome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 12), dpadMat);
    dpadDome.scale.set(1, 1, 0.5);
    dpadDome.position.set(-1.5, -1.15, 0.97);
    dpadH.castShadow = dpadV.castShadow = true;
    gb.add(dpadH, dpadV, dpadDome);
    // d-pad steps between sections; the direction is read from the hit point
    const dpadAction = { type: 'dpad', cx: -1.5, cy: -1.15 };
    buttons.set(dpadH, dpadAction);
    buttons.set(dpadV, dpadAction);
    buttons.set(dpadDome, dpadAction);

    /* --- A/B buttons on an angled recessed dish --- */
    const AB_TILT = -0.46;
    const dishShape = new THREE.Shape();
    {
        const dw = 1.18, dh = 0.62, dr = 0.6; // stadium-ish rounded rect
        dishShape.moveTo(-dw, -dh + dr);
        dishShape.lineTo(-dw, dh - dr);
        dishShape.absarc(-dw + dr, dh - dr, dr, Math.PI, Math.PI / 2, true);
        dishShape.lineTo(dw - dr, dh);
        dishShape.absarc(dw - dr, dh - dr, dr, Math.PI / 2, 0, true);
        dishShape.lineTo(dw, -dh + dr);
        dishShape.absarc(dw - dr, -dh + dr, dr, 0, -Math.PI / 2, true);
        dishShape.lineTo(-dw + dr, -dh);
        dishShape.absarc(-dw + dr, -dh + dr, dr, -Math.PI / 2, -Math.PI, true);
        dishShape.closePath();
    }
    const abDish = new THREE.Mesh(
        new THREE.ExtrudeGeometry(dishShape, { depth: 0.045, curveSegments: 20, bevelEnabled: false }),
        recessMat
    );
    abDish.rotation.z = AB_TILT;
    abDish.position.set(1.52, -1.1, 0.72);
    gb.add(abDish);

    const btnBase = new THREE.CylinderGeometry(0.42, 0.45, 0.2, 28);
    const btnCap = new THREE.SphereGeometry(0.42, 28, 14);
    // A opens side A of the cart (articles), B opens side B (posters)
    const abActions = {
        A: { type: 'focus', sel: '#publications .pub-anchor-back' },
        B: { type: 'focus', sel: '#publications .pub-anchor-front' },
    };
    const abLabels = { A: 'ARTICLES', B: 'POSTERS' };
    for (const [x, y, letter] of [[2.05, -0.85, 'A'], [1.0, -1.35, 'B']]) {
        const base = new THREE.Mesh(btnBase, abMat);
        base.rotation.x = Math.PI / 2;
        base.position.set(x, y, 0.84);
        const cap = new THREE.Mesh(btnCap, abMat);
        cap.scale.set(1, 1, 0.28);
        cap.position.set(x, y, 0.94);
        base.castShadow = true;
        gb.add(base, cap);
        buttons.set(base, abActions[letter]);
        buttons.set(cap, abActions[letter]);

        const tag = makePrint(1.1, 0.24, (ctx, w, h) => {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#dff6f8';
            ctx.font = `600 ${h * 0.58}px 'Instrument Sans', sans-serif`;
            ctx.fillText(abLabels[letter], w / 2, h * 0.55);
        });
        tag.rotation.z = AB_TILT;
        tag.position.set(x - 0.1, y - 0.62, 0.79);
        gb.add(tag);
    }

    /* --- SELECT / START pills in grooves, with printed labels --- */
    const pillGeo = new THREE.CapsuleGeometry(0.13, 0.5, 4, 12);
    const grooveGeo = new THREE.CapsuleGeometry(0.2, 0.52, 4, 12);
    const names = ['PROJECTS', 'ABOUT'];
    const pillActions = [{ type: 'focus', sel: '#projects' }, { type: 'focus', sel: '#about' }];
    [-0.45, 0.45].forEach((dx, i) => {
        const groove = new THREE.Mesh(grooveGeo, recessMat);
        groove.rotation.z = Math.PI / 2 - 0.5;
        groove.scale.set(1, 1, 0.22);
        groove.position.set(dx, -3.0, 0.752);
        gb.add(groove);

        const pill = new THREE.Mesh(pillGeo, pillMat);
        pill.rotation.z = Math.PI / 2 - 0.5;
        pill.position.set(dx, -3.0, 0.78);
        pill.castShadow = true;
        gb.add(pill);
        buttons.set(groove, pillActions[i]);
        buttons.set(pill, pillActions[i]);

        const tag = makePrint(0.95, 0.24, (ctx, w, h) => {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#dff6f8';
            ctx.font = `600 ${h * 0.62}px 'Instrument Sans', sans-serif`;
            ctx.fillText(names[i], w / 2, h * 0.55);
        });
        tag.rotation.z = -0.47;
        tag.position.set(dx, -3.42, 0.752);
        gb.add(tag);
    });

    /* --- speaker: diagonal lattice of round holes (GBC style) --- */
    const holeGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.06, 12);
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x0b525c, roughness: 0.7 });
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if ((r === 0 && c === 3) || (r === 3 && c === 0)) continue;
            const hole = new THREE.Mesh(holeGeo, holeMat);
            hole.rotation.x = Math.PI / 2;
            hole.position.set(1.30 + c * 0.30 - r * 0.16, -3.28 - c * 0.17 - r * 0.27, 0.752);
            gb.add(hole);
        }
    }

    /* --- side & top hardware details --- */
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 24), dpadMat);
    wheel.rotation.z = Math.PI / 2;         // volume, right side
    wheel.position.set(2.85, 2.5, 0);
    gb.add(wheel);

    const power = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.6, 0.26, 2, 0.07), dpadMat);
    power.position.set(-2.86, 3.2, 0.08);   // ON/OFF slider, left edge
    gb.add(power);
    buttons.set(power, { type: 'focus', sel: '#cv' });

    const ir = new THREE.Mesh(
        new RoundedBoxGeometry(0.6, 0.14, 0.26, 2, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x3a1420, roughness: 0.3 })
    );
    ir.position.set(0, 4.73, 0.15);         // infrared window, top center
    gb.add(ir);

    const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 20), dpadMat);
    jack.position.set(-0.7, -4.74, 0);
    gb.add(jack);

    /* --- cartridge in the back slot — the papers ARE the cart --- */
    // dark slot well, revealed when the cart slides out
    const cartWell = new THREE.Mesh(new RoundedBoxGeometry(3.3, 3.5, 0.1, 2, 0.04), slotMat);
    cartWell.position.set(0, 2.0, -0.76);
    gb.add(cartWell);

    const cartridge = new THREE.Group();

    // atomic-purple shell like the iconic GBC game paks
    const cartMat = new THREE.MeshStandardMaterial({ color: COLORS.cart, roughness: 0.35, metalness: 0.05 });
    const cart = new THREE.Mesh(new RoundedBoxGeometry(3.4, 3.6, 0.5, 3, 0.1), cartMat);
    cart.position.set(0, 2.0, -0.85);
    cart.castShadow = true;
    cartridge.add(cart);

    // grip ridges along the top, wrapping both faces
    const ridgeGeo = new RoundedBoxGeometry(3.06, 0.07, 0.56, 1, 0.03);
    for (let i = 0; i < 4; i++) {
        const ridge = new THREE.Mesh(ridgeGeo, cartMat);
        ridge.position.set(0, 3.66 - i * 0.12, -0.85);
        cartridge.add(ridge);
    }

    // embossed brand band under the ridges, printed on both faces
    const bandPlate = new THREE.Mesh(new RoundedBoxGeometry(2.9, 0.34, 0.54, 2, 0.05), cartMat);
    bandPlate.position.set(0, 3.02, -0.85);
    cartridge.add(bandPlate);
    for (const [z, flip] of [[-0.575, false], [-1.125, true]]) {
        const brand = makePrint(2.7, 0.3, (ctx, w, h) => {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#4a3a80';
            ctx.font = `italic 700 ${h * 0.5}px 'Instrument Sans', sans-serif`;
            ctx.fillText('Carugo GAME BOY COLOR™', w / 2, h * 0.55);
        });
        brand.position.set(0, 3.02, z);
        if (flip) brand.rotation.y = Math.PI;
        cartridge.add(brand);
    }

    // side A (faces away from the console): the journal articles, gold foil
    const backLabel = makeCartLabel('SIDE A - ARTICLES', [
        { year: '2026', title: 'AICARDI DELPHI',  venue: 'EUR J PAED NEUROL',
          href: 'https://doi.org/10.1016/j.ejpn.2025.11.004' },
        { year: '2025', title: 'COL4A1 / A2', venue: 'CLINICAL GUIDE · IN REVIEW',
          href: null },
    ], 'gold');
    backLabel.mesh.rotation.y = Math.PI;
    backLabel.mesh.position.set(0, 1.7, -1.105);
    cartridge.add(backLabel.mesh);

    // side B (faces the console, revealed when the cart ejects): the
    // posters, crystal foil
    const frontLabel = makeCartLabel('SIDE B - POSTERS', [
        { year: '2024', title: 'VR REHAB IN DCD', venue: 'FIT4MEDROB ROME',
          href: 'Poster Carelab ENG final.pdf' },
        { year: '2024', title: 'IOGIOCO NAO+ASD', venue: 'FIT4MEDROB ROME',
          href: 'Poster NAO ENG.pdf' },
    ], 'crystal');
    frontLabel.mesh.position.set(0, 1.7, -0.595);
    cartridge.add(frontLabel.mesh);

    gb.add(cartridge);
    gb.userData.cartridge = cartridge;
    gb.userData.screen = screen;
    gb.userData.labels = [backLabel, frontLabel];
    gb.userData.buttons = buttons;

    return gb;
}

/* ------------------------------------------------------------
   Camera shots — one per section. Content sections park the
   camera on the screen (which plays that section's page).
   Papers has two phases: the cart fully ejects from the slot
   (`rise`) and the camera reads side A (articles) from the back,
   then swings around to side B (posters) on the front.
   ------------------------------------------------------------ */
/* fitW: world-units that must fit across the viewport at the target —
   on narrow (portrait) screens the camera is pushed back until it does */
const SHOTS = [
    { sel: '.hero',                          pos: [8, 3.5, 15],      tgt: [-2.6, 0.2, 0],  orbit: 0.14, page: 'title', fitW: 7, lift: 1.2 },  // full view, GB on the right
    { sel: '#about',                         pos: [1.7, 3.0, 7.6],   tgt: [0, 2.35, 0.5],  page: 'about', fitW: 3.9 },                        // screen: trainer card
    { sel: '#publications .pub-anchor-back', pos: [-1.6, 7.0, -8.4], tgt: [0, 6.6, -0.9],  page: 'papers', rise: 4.7, fitW: 3.4, lift: 1.0 }, // ejected cart, articles side
    { sel: '#publications .pub-anchor-front',pos: [1.6, 7.2, 6.6],   tgt: [0, 6.6, -0.85], page: 'papers', rise: 4.7, fitW: 3.4, lift: 1.0 }, // ejected cart, posters side
    { sel: '#projects',                      pos: [-1.7, 1.8, 7.4],  tgt: [0, 2.3, 0.5],   page: 'projects', fitW: 3.9 },                     // screen: project menu
    { sel: '#cv',                            pos: [1.3, 2.0, 7.8],   tgt: [0, 2.35, 0.5],  page: 'cv', fitW: 3.9 },                           // screen: quest log
    { sel: '#contact',                       pos: [-1.0, 2.8, 7.2],  tgt: [0, 2.35, 0.5],  page: 'contact', fitW: 3.9 },                      // screen: say hi
    { sel: '.footer',                        pos: [0.6, 2.7, 4.8],   tgt: [0, 2.3, 0.4],   orbit: 0.06, page: 'footer', fitW: 3.9 },          // zoom in tight on the Game Boy
];

const INTRO_POS = new THREE.Vector3(0, 2.35, 2.4); // right in front of the screen
const INTRO_TGT = new THREE.Vector3(0, 2.35, 0.86);
const INTRO_MS = 2000;

const smoothstep = (t) => t * t * (3 - 2 * t);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/* ------------------------------------------------------------
   Scene
   ------------------------------------------------------------ */
function init() {
    const stage = document.getElementById('gb3d-stage');
    const canvas = document.getElementById('gb3d-canvas');
    if (!stage || !canvas) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    // soft shadows are the most expensive part of the frame — skip them on
    // phones, and cap the pixel ratio a bit lower there too
    const smallScreen = () => Math.min(window.innerWidth, window.innerHeight) < 600;
    renderer.shadowMap.enabled = !smallScreen();
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xfff6ec, 0xb0a89f, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 10, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -9;
    sun.shadow.camera.right = sun.shadow.camera.top = 9;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x93a9d6, 0.5);
    fill.position.set(-7, 2, -6);
    scene.add(fill);
    const back = new THREE.DirectionalLight(0xfff6ec, 0.7);
    back.position.set(2, 4, -8);
    scene.add(back);

    const screenCtl = makeScreenController();
    const gameboy = buildGameBoy(screenCtl.texture);
    scene.add(gameboy);
    const cartridge = gameboy.userData.cartridge;
    let cartRise = 0; // 0 = seated in the slot, 1 = popped out (papers section)

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.ShadowMaterial({ opacity: 0.14 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5.6;
    ground.receiveShadow = true;
    scene.add(ground);

    // resolve shot elements + parsed vectors
    const shots = SHOTS
        .map(s => ({
            el: document.querySelector(s.sel),
            pos: new THREE.Vector3(...s.pos),
            tgt: new THREE.Vector3(...s.tgt),
            orbit: s.orbit || 0,
            page: s.page,
            rise: s.rise || 0,
            fitW: s.fitW || 6,
            lift: s.lift || 0,
        }))
        .filter(s => s.el);

    function resize() {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, smallScreen() ? 1.75 : 2));
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    /* --------------------------------------------------------
       Clickable 3D surfaces — the stage stays pointer-events:
       none, so we raycast from document-level events instead.
       Solid meshes occlude, so hidden hotspots can't be hit.
       -------------------------------------------------------- */
    const screenMesh = gameboy.userData.screen;
    const labelApis = new Map(gameboy.userData.labels.map(l => [l.mesh, l]));
    const buttonMap = gameboy.userData.buttons;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    // real page UI always wins over the 3D layer behind it
    const UI_SELECTOR = 'a, button, input, textarea, .nav, #title-screen, .footer-inner';

    function pick(ev) {
        if (document.body.classList.contains('title-locked')) return null;
        if (ev.target instanceof Element && ev.target.closest(UI_SELECTOR)) return null;
        ndc.set(
            (ev.clientX / window.innerWidth) * 2 - 1,
            -(ev.clientY / window.innerHeight) * 2 + 1
        );
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObject(gameboy, true)[0];
        if (!hit) return null;
        const btn = buttonMap.get(hit.object);
        if (btn) {
            let action = btn;
            if (btn.type === 'dpad') {
                // read the pressed direction from where the d-pad was hit
                const p = gameboy.worldToLocal(hit.point.clone());
                const dx = p.x - btn.cx, dy = p.y - btn.cy;
                const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : (dy > 0 ? -1 : 1);
                action = { type: 'nav', dir };
            }
            return { hotspot: { action }, label: null, mesh: hit.object };
        }
        if (!hit.uv) return null;
        if (hit.object === screenMesh) {
            const hs = screenCtl.hitTest(hit.uv.x, hit.uv.y);
            return hs && { hotspot: hs, label: null };
        }
        const label = labelApis.get(hit.object);
        if (label) {
            const hs = label.hitTest(hit.uv);
            return hs && { hotspot: hs, label };
        }
        return null;
    }

    function runAction(action) {
        if (action.type === 'link') {
            if (action.href.startsWith('mailto:')) window.location.href = action.href;
            else window.open(encodeURI(action.href), '_blank', 'noopener');
        } else if (action.type === 'focus' || action.type === 'scroll') {
            // center the target so the camera settles exactly on its shot
            const target = document.querySelector(action.sel);
            if (target) {
                const r = target.getBoundingClientRect();
                window.scrollTo({
                    top: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2,
                    behavior: 'smooth',
                });
            }
        } else if (action.type === 'nav') {
            // d-pad / arrows: step to the previous or next camera shot
            const view = window.scrollY + window.innerHeight / 2;
            let i = 0;
            for (let k = 1; k < shots.length; k++) {
                if (Math.abs(shotAnchor(shots[k]) - view) < Math.abs(shotAnchor(shots[i]) - view)) i = k;
            }
            const next = shots[THREE.MathUtils.clamp(i + action.dir, 0, shots.length - 1)];
            window.scrollTo({ top: shotAnchor(next) - window.innerHeight / 2, behavior: 'smooth' });
        }
    }

    /* brief press-in nudge for a clicked physical control */
    function pressButton(mesh) {
        if (mesh.userData.pressed) return;
        mesh.userData.pressed = true;
        mesh.position.z -= 0.06;
        setTimeout(() => { mesh.position.z += 0.06; mesh.userData.pressed = false; }, 150);
    }

    let cursorOn = false;
    window.addEventListener('pointermove', (ev) => {
        if (ev.pointerType === 'touch') return; // no hover on touch — taps handle it
        const found = pick(ev);
        screenCtl.setHover(found && !found.label ? found.hotspot : null);
        labelApis.forEach(api => api.setHover(found && found.label === api ? found.hotspot.index : -1));
        if (!!found !== cursorOn) {
            cursorOn = !!found;
            document.body.style.cursor = cursorOn ? 'pointer' : '';
        }
    }, { passive: true });

    /* Activation comes from pointer events, not `click`: iOS Safari does
       not reliably synthesize clicks for taps on non-interactive elements
       (the 3D layer is behind plain sections), which left the hotspots
       dead on phones. A tap/click = press and release nearby, quickly. */
    let press = null;
    window.addEventListener('pointerdown', (ev) => {
        press = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, t: performance.now() };
    }, { passive: true });
    window.addEventListener('pointerup', (ev) => {
        if (!press || press.id !== ev.pointerId) return;
        const moved = Math.hypot(ev.clientX - press.x, ev.clientY - press.y);
        const held = performance.now() - press.t;
        press = null;
        if (moved > 14 || held > 700) return; // a scroll or drag, not a tap
        const found = pick(ev);
        if (!found) return;
        if (found.mesh) pressButton(found.mesh);
        // taps never hover: mirror the pointermove highlight so menu
        // rows (action type 'select') light up on touch as well
        screenCtl.setHover(found.label ? null : found.hotspot);
        labelApis.forEach(api => api.setHover(found.label === api ? found.hotspot.index : -1));
        runAction(found.hotspot.action);
    });

    // emulator-style keys: arrows step sections, Enter=START, X=A, Z=B
    window.addEventListener('keydown', (ev) => {
        if (document.body.classList.contains('title-locked')) return;
        if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
        const nav = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[ev.key];
        if (nav) {
            ev.preventDefault();
            runAction({ type: 'nav', dir: nav });
            return;
        }
        const focus = {
            Enter: '#about',
            x: '#publications .pub-anchor-back',  X: '#publications .pub-anchor-back',
            z: '#publications .pub-anchor-front', Z: '#publications .pub-anchor-front',
        }[ev.key];
        if (focus) {
            ev.preventDefault();
            runAction({ type: 'focus', sel: focus });
        }
    });

    // narrow screens: squeeze lateral offsets so the GB stays in frame and
    // the shots become near-frontal — less perspective skew, easier to read
    const xScale = () => THREE.MathUtils.clamp(window.innerWidth / 1200, 0.3, 1);

    const desiredPos = new THREE.Vector3();
    const desiredTgt = new THREE.Vector3();
    const curPos = INTRO_POS.clone();
    const curTgt = INTRO_TGT.clone();
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();

    let introStart = null; // set on PRESS START

    document.addEventListener('gb:start', () => {
        introStart = performance.now();
    });

    function shotAnchor(shot) {
        const r = shot.el.getBoundingClientRect();
        return r.top + window.scrollY + r.height / 2;
    }

    function computeScrollShot(time) {
        const view = window.scrollY + window.innerHeight / 2;
        const xs = xScale();

        let i = 0;
        while (i < shots.length - 1 && view > shotAnchor(shots[i + 1])) i++;

        const a = shots[i];
        const b = shots[Math.min(i + 1, shots.length - 1)];
        const ya = shotAnchor(a);
        const yb = shotAnchor(b);
        let t = yb > ya ? THREE.MathUtils.clamp((view - ya) / (yb - ya), 0, 1) : 0;
        t = smoothstep(t);

        A.copy(a.pos); B.copy(b.pos);
        A.x *= xs; B.x *= xs;

        // when the path crosses the body (front↔back), swing around the side
        if (Math.abs(a.pos.z - b.pos.z) > 6) {
            C.lerpVectors(A, B, 0.5);
            C.x = -10 * xs;
            C.z *= 0.4;
            const u = 1 - t;
            desiredPos.set(
                u * u * A.x + 2 * u * t * C.x + t * t * B.x,
                u * u * A.y + 2 * u * t * C.y + t * t * B.y,
                u * u * A.z + 2 * u * t * C.z + t * t * B.z
            );
        } else {
            desiredPos.lerpVectors(A, B, t);
        }

        A.copy(a.tgt); B.copy(b.tgt);
        A.x *= xs; B.x *= xs;
        desiredTgt.lerpVectors(A, B, t);

        // portrait/narrow screens: push the camera back along its axis
        // until the shot's frame width fits inside the viewport
        const fitW = THREE.MathUtils.lerp(a.fitW, b.fitW, t);
        const viewWPerUnit = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
        const dist = desiredPos.distanceTo(desiredTgt);
        const needed = fitW / viewWPerUnit;
        if (dist < needed) {
            desiredPos.sub(desiredTgt).multiplyScalar(needed / dist).add(desiredTgt);
        }

        // ...and shift the frame down so the subject sits in the upper
        // half, clear of the bottom-anchored HUD cards
        const narrowK = THREE.MathUtils.clamp((1 - camera.aspect) / 0.55, 0, 1);
        if (narrowK > 0) {
            const lift = THREE.MathUtils.lerp(a.lift, b.lift, t) * narrowK;
            desiredPos.y -= lift;
            desiredTgt.y -= lift;
        }

        // flip the GB screen to the section we're closest to,
        // and eject the papers cartridge near its section
        const nearest = t < 0.5 ? a : b;
        if (nearest.page) screenCtl.setPage(nearest.page);
        cartRise = THREE.MathUtils.lerp(a.rise, b.rise, t);

        // idle orbit on the first/last shot, fading out as you scroll away
        let orbitAmt = 0;
        if (i === 0 && a.orbit) orbitAmt = a.orbit * (1 - t);
        if (b.orbit && t > 0) orbitAmt = Math.max(orbitAmt, b.orbit * t);
        if (orbitAmt > 0 && !reducedMotion) {
            const ang = Math.sin(time * 0.35) * orbitAmt * 2.2;
            const dx = desiredPos.x - desiredTgt.x;
            const dz = desiredPos.z - desiredTgt.z;
            desiredPos.x = desiredTgt.x + dx * Math.cos(ang) - dz * Math.sin(ang);
            desiredPos.z = desiredTgt.z + dx * Math.sin(ang) + dz * Math.cos(ang);
        }
    }

    let prevNow = null;

    function loop(now) {
        // delta-time based damping so the camera glides at the same speed on
        // 30 fps phones and 120 Hz displays alike (clamped across tab switches)
        if (prevNow === null) prevNow = now;
        const dt = Math.min((now - prevNow) / 1000, 0.05);
        prevNow = now;
        const time = now / 1000;
        const camK  = 1 - Math.exp(-5.3 * dt); // ≈ 0.085/frame at 60 fps
        const cartK = 1 - Math.exp(-6.3 * dt); // ≈ 0.1/frame at 60 fps

        if (!reducedMotion) {
            gameboy.position.y = Math.sin(time * 1.1) * 0.1;
        }

        computeScrollShot(time);

        // slide the papers cart in/out of its slot
        cartridge.position.y += (cartRise - cartridge.position.y) * cartK;

        if (introStart !== null) {
            const k = THREE.MathUtils.clamp((now - introStart) / INTRO_MS, 0, 1);
            const e = easeOutCubic(k);
            curPos.lerpVectors(INTRO_POS, desiredPos, e);
            curTgt.lerpVectors(INTRO_TGT, desiredTgt, e);
            if (k >= 1) introStart = null; // hand over to scroll damping
        } else if (document.body.classList.contains('title-locked')) {
            curPos.copy(INTRO_POS);
            curTgt.copy(INTRO_TGT);
        } else {
            curPos.lerp(desiredPos, camK);
            curTgt.lerp(desiredTgt, camK);
        }

        camera.position.copy(curPos);
        camera.lookAt(curTgt);
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
