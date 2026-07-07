/**
 * 3D Game Boy — full-page scrollytelling rig (kriss.ai /home/overview style).
 * The Game Boy sits on a fixed fullscreen layer behind the page.
 * PRESS START zooms out of the title screen into the model; scrolling
 * flies the camera to the part of the Game Boy tied to each section.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const COLORS = {
    body:   0xece7e3,
    bezel:  0x1d3a6e,
    dpad:   0x1c1a18,
    ab:     0x3559a8,
    pill:   0x837b74,
    seam:   0xd9d2ce,
    led:    0xc0392b,
};

/* 16×16 turtle buddy — pixel art shown on the Game Boy screen */
const BUDDY = [
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,1,2,1,2,2,2,1,2,1,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,0,1,2,2,1,1,2,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,1,1,3,3,3,3,3,1,1,0,0,0,0],
    [0,0,1,2,1,3,1,3,1,3,1,2,1,0,0,0],
    [0,0,1,2,1,3,3,1,3,3,1,2,1,0,0,0],
    [0,0,0,1,1,3,1,3,1,3,1,1,0,0,0,0],
    [0,0,0,0,1,3,3,3,3,3,1,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,2,2,1,0,1,2,2,1,0,0,0,0],
    [0,0,0,1,2,2,1,0,1,2,2,1,0,0,0,0],
    [0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0],
];
const PIX_PAL = ['', '#1c2a54', '#3559a8', '#93a9d6'];

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
        ctx.fillText('DR. UMBERTO', W / 2, 66);

        // chunky blue logo with bevel
        ctx.font = pixelFont(46);
        ctx.fillStyle = '#1c2a54';
        ctx.fillText('CARUGO', W / 2 + 4, 128 + 4);
        ctx.fillStyle = '#93a9d6';
        ctx.fillText('CARUGO', W / 2, 128 - 3);
        ctx.fillStyle = '#3559a8';
        ctx.fillText('CARUGO', W / 2, 128);

        ctx.fillStyle = '#1c2a54';
        ctx.font = pixelFont(15);
        ctx.fillText('◆ Blue Version ◆', W / 2, 188);

        // buddy sprite
        const cell = 9;
        const ox = W / 2 - (16 * cell) / 2;
        const oy = 216;
        for (let r = 0; r < 16; r++) {
            for (let c = 0; c < 16; c++) {
                const v = BUDDY[r][c];
                if (!v) continue;
                ctx.fillStyle = PIX_PAL[v];
                ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
            }
        }

        if (blinkOn) {
            ctx.fillStyle = '#1c2a54';
            ctx.font = pixelFont(15);
            ctx.fillText('PRESS START', W / 2, 396);
        }
    }

    draw();
    const texture = new THREE.CanvasTexture(cv);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    setInterval(() => { blinkOn = !blinkOn; draw(); texture.needsUpdate = true; }, 650);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => { draw(); texture.needsUpdate = true; });
    }
    return texture;
}

/* ------------------------------------------------------------
   Game Boy model — built from primitives
   ------------------------------------------------------------ */
function buildGameBoy() {
    const gb = new THREE.Group();

    const bodyMat  = new THREE.MeshStandardMaterial({ color: COLORS.body, roughness: 0.55, metalness: 0.05 });
    const bezelMat = new THREE.MeshStandardMaterial({ color: COLORS.bezel, roughness: 0.4, metalness: 0.1 });
    const dpadMat  = new THREE.MeshStandardMaterial({ color: COLORS.dpad, roughness: 0.45 });
    const abMat    = new THREE.MeshStandardMaterial({ color: COLORS.ab, roughness: 0.35 });
    const pillMat  = new THREE.MeshStandardMaterial({ color: COLORS.pill, roughness: 0.5 });

    const body = new THREE.Mesh(new RoundedBoxGeometry(5.6, 9.4, 1.5, 6, 0.34), bodyMat);
    body.castShadow = true;
    gb.add(body);

    const bezel = new THREE.Mesh(new RoundedBoxGeometry(4.7, 3.9, 0.25, 4, 0.12), bezelMat);
    bezel.position.set(0, 2.35, 0.72);
    bezel.castShadow = true;
    gb.add(bezel);

    const screenMat = new THREE.MeshStandardMaterial({
        map: makeScreenTexture(),
        roughness: 0.3,
        metalness: 0.0,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.24), screenMat);
    screen.position.set(0, 2.35, 0.86);
    gb.add(screen);

    const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 12),
        new THREE.MeshStandardMaterial({ color: COLORS.led, emissive: COLORS.led, emissiveIntensity: 0.9 })
    );
    led.position.set(-2.1, 3.1, 0.78);
    gb.add(led);

    const dpadH = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.58, 0.32, 3, 0.08), dpadMat);
    dpadH.position.set(-1.5, -1.15, 0.8);
    const dpadV = new THREE.Mesh(new RoundedBoxGeometry(0.58, 1.7, 0.32, 3, 0.08), dpadMat);
    dpadV.position.set(-1.5, -1.15, 0.8);
    dpadH.castShadow = dpadV.castShadow = true;
    gb.add(dpadH, dpadV);

    const btnGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 24);
    const btnA = new THREE.Mesh(btnGeo, abMat);
    btnA.rotation.x = Math.PI / 2;
    btnA.position.set(2.05, -0.85, 0.8);
    const btnB = new THREE.Mesh(btnGeo, abMat);
    btnB.rotation.x = Math.PI / 2;
    btnB.position.set(1.0, -1.35, 0.8);
    btnA.castShadow = btnB.castShadow = true;
    gb.add(btnA, btnB);

    const pillGeo = new THREE.CapsuleGeometry(0.13, 0.5, 4, 10);
    for (const dx of [-0.45, 0.45]) {
        const pill = new THREE.Mesh(pillGeo, pillMat);
        pill.rotation.z = Math.PI / 2 - 0.5;
        pill.position.set(dx, -3.0, 0.78);
        pill.castShadow = true;
        gb.add(pill);
    }

    const slotGeo = new THREE.CapsuleGeometry(0.055, 0.7, 4, 8);
    for (let i = 0; i < 5; i++) {
        const slot = new THREE.Mesh(slotGeo, bezelMat);
        slot.rotation.z = -0.6;
        slot.position.set(1.35 + i * 0.28, -3.75 + i * 0.1, 0.76);
        gb.add(slot);
    }

    const seam = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.05, 1.52), new THREE.MeshStandardMaterial({ color: COLORS.seam, roughness: 0.6 }));
    seam.position.set(0, 4.1, 0);
    gb.add(seam);

    const cart = new THREE.Mesh(new RoundedBoxGeometry(3.4, 3.6, 0.5, 3, 0.1), abMat);
    cart.position.set(0, 2.0, -0.85);
    cart.castShadow = true;
    gb.add(cart);
    const cartLabel = new THREE.Mesh(
        new RoundedBoxGeometry(2.6, 2.4, 0.1, 2, 0.05),
        new THREE.MeshStandardMaterial({ color: COLORS.body, roughness: 0.6 })
    );
    cartLabel.position.set(0, 1.9, -1.12);
    gb.add(cartLabel);

    return gb;
}

/* ------------------------------------------------------------
   Camera shots — one per section, targeting a Game Boy part
   ------------------------------------------------------------ */
const SHOTS = [
    { sel: '.hero',          pos: [8, 3.5, 15],      tgt: [-2.6, 0.2, 0],   orbit: 0.14 }, // full view, GB on the right
    { sel: '#about',         pos: [3.2, 2.6, 7.5],   tgt: [1.6, 2.3, 0]    },              // the screen (who I am)
    { sel: '#day',           pos: [-4.6, -0.3, 7.0], tgt: [-2.5, -1.15, 0] },              // d-pad (navigating the day)
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
