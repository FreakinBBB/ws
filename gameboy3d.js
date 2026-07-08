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
    body:    0xece7e3,
    recess:  0xd6cfc9,
    bezel:   0x1d3a6e,
    dpad:    0x1c1a18,
    ab:      0x3559a8,
    pill:    0x837b74,
    seam:    0xc9c1bb,
    led:     0xc0392b,
    slot:    0x23283b,
    ink:     0x1c2a54,
};

/* redraw queue for canvas-based prints once the web fonts arrive */
const fontRedraws = [];
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => fontRedraws.forEach(fn => fn()));
}

/* ------------------------------------------------------------
   Screen texture — animated title screen on a 2D canvas
   ------------------------------------------------------------ */
function makeScreenTexture() {
    const W = 480, H = 432; // 10:9 like the GB's 160×144
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let blinkOn = true;

    function draw() {
        ctx.fillStyle = '#e6e3dc';
        ctx.fillRect(0, 0, W, H);

        const pixelFont = (size) => `${size}px "Press Start 2P", monospace`;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#1c2a54';
        ctx.font = pixelFont(14);
        ctx.fillText('DR. UMBERTO', W / 2, 108);

        // chunky blue logo with bevel
        ctx.font = pixelFont(46);
        ctx.fillStyle = '#1c2a54';
        ctx.fillText('CARUGO', W / 2 + 4, 178 + 4);
        ctx.fillStyle = '#93a9d6';
        ctx.fillText('CARUGO', W / 2, 178 - 3);
        ctx.fillStyle = '#3559a8';
        ctx.fillText('CARUGO', W / 2, 178);

        if (blinkOn) {
            ctx.fillStyle = '#1c2a54';
            ctx.font = pixelFont(15);
            ctx.fillText('PRESS START', W / 2, 312);
        }

        ctx.fillStyle = '#1c2a54';
        ctx.font = pixelFont(10);
        ctx.fillText("©'95.'26 CARUGO inc.", W / 2, 398);
    }

    draw();
    const texture = new THREE.CanvasTexture(cv);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    setInterval(() => { blinkOn = !blinkOn; draw(); texture.needsUpdate = true; }, 650);
    fontRedraws.push(() => { draw(); texture.needsUpdate = true; });
    return texture;
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
function makePrint(w, h, drawFn, pxPerUnit = 110) {
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
    texture.anisotropy = 4;
    fontRedraws.push(() => { draw(); texture.needsUpdate = true; });

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.6, metalness: 0 })
    );
    return mesh;
}

const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

/* ------------------------------------------------------------
   Game Boy model — DMG-01 silhouette from primitives
   ------------------------------------------------------------ */
function buildGameBoy() {
    const gb = new THREE.Group();

    const bodyMat   = new THREE.MeshStandardMaterial({ color: COLORS.body, roughness: 0.55, metalness: 0.04 });
    const recessMat = new THREE.MeshStandardMaterial({ color: COLORS.recess, roughness: 0.6, metalness: 0.02 });
    const bezelMat  = new THREE.MeshStandardMaterial({ color: COLORS.bezel, roughness: 0.42, metalness: 0.1 });
    const dpadMat   = new THREE.MeshStandardMaterial({ color: COLORS.dpad, roughness: 0.45 });
    const abMat     = new THREE.MeshStandardMaterial({ color: COLORS.ab, roughness: 0.35 });
    const pillMat   = new THREE.MeshStandardMaterial({ color: COLORS.pill, roughness: 0.5 });
    const slotMat   = new THREE.MeshStandardMaterial({ color: COLORS.slot, roughness: 0.6 });

    /* --- body: extruded plate, big rounded bottom-right corner (DMG) --- */
    const W2 = 2.8, H2 = 4.7;       // half extents → 5.6 × 9.4 like before
    const rT = 0.42, rBL = 0.42, rBR = 1.7;
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

    /* top seam groove (two-part shell like the real case) */
    const seam = new THREE.Mesh(
        new THREE.BoxGeometry(5.62, 0.04, 1.52),
        new THREE.MeshStandardMaterial({ color: COLORS.seam, roughness: 0.6 })
    );
    seam.position.set(0, 4.1, 0);
    gb.add(seam);

    /* --- screen bezel with printed stripes + text --- */
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(4.7, 4.2, 0.25, 4, 0.14), bezelMat);
    bezel.position.set(0, 2.35, 0.72);
    bezel.castShadow = true;
    gb.add(bezel);

    const bezelPrint = makePrint(4.7, 4.2, (ctx, w, h) => {
        const px = (u) => (u / 4.7) * w;
        // twin accent stripes across the top
        ctx.fillStyle = '#93a9d6';
        ctx.fillRect(px(0.18), h * 0.045, w - px(0.36), h * 0.008);
        ctx.fillStyle = '#c0704e';
        ctx.fillRect(px(0.18), h * 0.082, w - px(0.36), h * 0.008);
        // clear a gap and print the tagline between the stripes
        ctx.font = `italic 700 ${h * 0.032}px 'Instrument Sans', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = 'DOT MATRIX WITH STEREO SOUND';
        const tw = ctx.measureText(label).width;
        ctx.clearRect(w / 2 - tw / 2 - px(0.08), h * 0.02, tw + px(0.16), h * 0.09);
        ctx.fillStyle = '#d9d2ce';
        ctx.fillText(label, w / 2, h * 0.066);
        // battery label under the LED
        ctx.font = `600 ${h * 0.024}px 'Instrument Sans', sans-serif`;
        ctx.fillText('BATTERY', px(0.37), h * 0.512);
    });
    bezelPrint.position.set(0, 2.35, 0.851);
    gb.add(bezelPrint);

    const screenMat = new THREE.MeshStandardMaterial({
        map: makeScreenTexture(),
        roughness: 0.25,
        metalness: 0.0,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.24), screenMat);
    screen.position.set(0, 2.35, 0.86);
    gb.add(screen);

    const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 12),
        new THREE.MeshStandardMaterial({ color: COLORS.led, emissive: COLORS.led, emissiveIntensity: 0.9 })
    );
    led.position.set(-1.98, 2.6, 0.865);
    gb.add(led);

    /* --- logo print under the screen --- */
    const logo = makePrint(3.3, 0.42, (ctx, w, h) => {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = css(COLORS.ink);
        ctx.font = `italic 700 ${h * 0.72}px 'Instrument Sans', sans-serif`;
        ctx.fillText('CARUGO BOY', w / 2, h * 0.52);
        const tw = ctx.measureText('CARUGO BOY').width;
        ctx.font = `700 ${h * 0.26}px 'Instrument Sans', sans-serif`;
        ctx.fillText('™', w / 2 + tw / 2 + h * 0.22, h * 0.3);
    });
    logo.position.set(0, -0.02, 0.755);
    gb.add(logo);

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
    for (const [x, y, letter] of [[2.05, -0.85, 'A'], [1.0, -1.35, 'B']]) {
        const base = new THREE.Mesh(btnBase, abMat);
        base.rotation.x = Math.PI / 2;
        base.position.set(x, y, 0.84);
        const cap = new THREE.Mesh(btnCap, abMat);
        cap.scale.set(1, 1, 0.28);
        cap.position.set(x, y, 0.94);
        base.castShadow = true;
        gb.add(base, cap);

        const tag = makePrint(0.3, 0.3, (ctx, w, h) => {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = css(COLORS.ink);
            ctx.font = `${h * 0.72}px "Press Start 2P", monospace`;
            ctx.fillText(letter, w / 2, h * 0.56);
        });
        tag.rotation.z = AB_TILT;
        tag.position.set(x - 0.28, y - 0.52, 0.79);
        gb.add(tag);
    }

    /* --- SELECT / START pills in grooves, with printed labels --- */
    const pillGeo = new THREE.CapsuleGeometry(0.13, 0.5, 4, 12);
    const grooveGeo = new THREE.CapsuleGeometry(0.2, 0.52, 4, 12);
    const names = ['SELECT', 'START'];
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

        const tag = makePrint(0.95, 0.24, (ctx, w, h) => {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = css(COLORS.ink);
            ctx.font = `600 ${h * 0.62}px 'Instrument Sans', sans-serif`;
            ctx.fillText(names[i], w / 2, h * 0.55);
        });
        tag.rotation.z = -0.47;
        tag.position.set(dx, -3.42, 0.752);
        gb.add(tag);
    });

    /* --- diagonal speaker grille, hugging the round corner --- */
    const slotGeo = new THREE.CapsuleGeometry(0.06, 0.68, 4, 8);
    for (let i = 0; i < 6; i++) {
        const slot = new THREE.Mesh(slotGeo, slotMat);
        slot.rotation.z = -0.55;
        slot.scale.set(1, 1, 0.3);
        slot.position.set(0.95 + i * 0.3, -3.85 + i * 0.16, 0.752);
        gb.add(slot);
    }

    /* --- side & top hardware details --- */
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.12, 24);
    for (const side of [-1, 1]) {           // contrast (left) / volume (right)
        const wheel = new THREE.Mesh(wheelGeo, dpadMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 2.85, 2.5, 0);
        gb.add(wheel);
    }

    const power = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.16, 0.22, 2, 0.06), dpadMat);
    power.position.set(-1.75, 4.74, 0.12);
    gb.add(power);

    const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 20), dpadMat);
    jack.position.set(-0.7, -4.74, 0);
    gb.add(jack);

    /* --- cartridge in the back slot --- */
    const cart = new THREE.Mesh(new RoundedBoxGeometry(3.4, 3.6, 0.5, 3, 0.1), abMat);
    cart.position.set(0, 2.0, -0.85);
    cart.castShadow = true;
    gb.add(cart);

    const cartLabel = makePrint(2.6, 2.4, (ctx, w, h) => {
        // cream label with a blue header band, like a classic cart sticker
        ctx.fillStyle = css(COLORS.body);
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = css(COLORS.ink);
        ctx.fillRect(0, 0, w, h * 0.24);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e6e3dc';
        ctx.font = `${h * 0.09}px "Press Start 2P", monospace`;
        ctx.fillText('CARUGO', w / 2, h * 0.13);
        ctx.fillStyle = css(COLORS.ink);
        ctx.font = `${h * 0.085}px "Press Start 2P", monospace`;
        ctx.fillText('RESEARCH', w / 2, h * 0.52);
        ctx.fillText('QUEST', w / 2, h * 0.66);
        ctx.fillStyle = '#837b74';
        ctx.font = `${h * 0.05}px "Press Start 2P", monospace`;
        ctx.fillText('EST. 1995', w / 2, h * 0.87);
    });
    cartLabel.rotation.y = Math.PI;
    cartLabel.position.set(0, 1.9, -1.105);
    gb.add(cartLabel);

    const cartNotch = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.35, 0.12, 2, 0.05), abMat);
    cartNotch.position.set(0, 3.85, -0.98);
    gb.add(cartNotch);

    return gb;
}

/* ------------------------------------------------------------
   Camera shots — one per section, targeting a Game Boy part
   ------------------------------------------------------------ */
const SHOTS = [
    { sel: '.hero',          pos: [8, 3.5, 15],      tgt: [-2.6, 0.2, 0],   orbit: 0.14 }, // full view, GB on the right
    { sel: '#about',         pos: [3.2, 2.6, 7.5],   tgt: [1.6, 2.3, 0]    },              // the screen (who I am)
    { sel: '#publications',  pos: [-1.2, 2.5, -7.5], tgt: [-1.2, 2.0, -0.9]},              // cartridge on the back (papers)
    { sel: '#projects',      pos: [-1.2, -0.4, 6.2], tgt: [0.3, -1.0, 0]   },              // A/B buttons (action)
    { sel: '#cv',            pos: [3.0, -2.2, 6.0],  tgt: [1.8, -2.9, 0]   },              // start/select (the path)
    { sel: '#contact',       pos: [-0.8, -2.7, 5.6], tgt: [0.7, -3.4, 0]   },              // speaker (say hi)
    { sel: '.footer',        pos: [0, 1.5, 20],      tgt: [0, 0, 0],        orbit: 0.2 },  // pull all the way back
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
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

    const gameboy = buildGameBoy();
    scene.add(gameboy);

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
        }))
        .filter(s => s.el);

    function resize() {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // narrow screens: squeeze lateral offsets so the GB stays in frame
    const xScale = () => THREE.MathUtils.clamp(window.innerWidth / 1200, 0.4, 1);

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

    const clock = new THREE.Clock();

    function loop() {
        const time = clock.getElapsedTime();

        if (!reducedMotion) {
            gameboy.position.y = Math.sin(time * 1.1) * 0.1;
        }

        computeScrollShot(time);

        if (introStart !== null) {
            const k = THREE.MathUtils.clamp((performance.now() - introStart) / INTRO_MS, 0, 1);
            const e = easeOutCubic(k);
            curPos.lerpVectors(INTRO_POS, desiredPos, e);
            curTgt.lerpVectors(INTRO_TGT, desiredTgt, e);
            if (k >= 1) introStart = null; // hand over to scroll damping
        } else if (document.body.classList.contains('title-locked')) {
            curPos.copy(INTRO_POS);
            curTgt.copy(INTRO_TGT);
        } else {
            curPos.lerp(desiredPos, 0.085);
            curTgt.lerp(desiredTgt, 0.085);
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
