/**
 * 3D Game Boy — interactive centerpiece (kriss.ai dollhouse style).
 * Orbits slowly on its own; drag to spin it around, scroll to zoom.
 * The screen shows the CARUGO Blue Version title screen.
 */

import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
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

/* 16×16 turtle buddy — same pixel art as the title screen */
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

    // blink + redraw once the pixel font is ready
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

    // body
    const body = new THREE.Mesh(new RoundedBoxGeometry(5.6, 9.4, 1.5, 6, 0.34), bodyMat);
    body.castShadow = true;
    gb.add(body);

    // screen bezel
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(4.7, 3.9, 0.25, 4, 0.12), bezelMat);
    bezel.position.set(0, 2.35, 0.72);
    bezel.castShadow = true;
    gb.add(bezel);

    // screen (animated canvas texture)
    const screenMat = new THREE.MeshStandardMaterial({
        map: makeScreenTexture(),
        roughness: 0.3,
        metalness: 0.0,
        emissive: 0xffffff,
        emissiveMap: null,
        emissiveIntensity: 0,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.24), screenMat);
    screen.position.set(0, 2.35, 0.86);
    gb.add(screen);

    // power LED
    const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 12),
        new THREE.MeshStandardMaterial({ color: COLORS.led, emissive: COLORS.led, emissiveIntensity: 0.9 })
    );
    led.position.set(-2.1, 3.1, 0.78);
    gb.add(led);

    // d-pad
    const dpadH = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.58, 0.32, 3, 0.08), dpadMat);
    dpadH.position.set(-1.5, -1.15, 0.8);
    const dpadV = new THREE.Mesh(new RoundedBoxGeometry(0.58, 1.7, 0.32, 3, 0.08), dpadMat);
    dpadV.position.set(-1.5, -1.15, 0.8);
    dpadH.castShadow = dpadV.castShadow = true;
    gb.add(dpadH, dpadV);

    // A / B buttons
    const btnGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 24);
    const btnA = new THREE.Mesh(btnGeo, abMat);
    btnA.rotation.x = Math.PI / 2;
    btnA.position.set(2.05, -0.85, 0.8);
    const btnB = new THREE.Mesh(btnGeo, abMat);
    btnB.rotation.x = Math.PI / 2;
    btnB.position.set(1.0, -1.35, 0.8);
    btnA.castShadow = btnB.castShadow = true;
    gb.add(btnA, btnB);

    // start / select
    const pillGeo = new THREE.CapsuleGeometry(0.13, 0.5, 4, 10);
    for (const dx of [-0.45, 0.45]) {
        const pill = new THREE.Mesh(pillGeo, pillMat);
        pill.rotation.z = Math.PI / 2 - 0.5;
        pill.position.set(dx, -3.0, 0.78);
        pill.castShadow = true;
        gb.add(pill);
    }

    // speaker grille
    const slotGeo = new THREE.CapsuleGeometry(0.055, 0.7, 4, 8);
    for (let i = 0; i < 5; i++) {
        const slot = new THREE.Mesh(slotGeo, bezelMat);
        slot.rotation.z = -0.6;
        slot.position.set(1.35 + i * 0.28, -3.75 + i * 0.1, 0.76);
        gb.add(slot);
    }

    // seam line across the body
    const seam = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.05, 1.52), new THREE.MeshStandardMaterial({ color: COLORS.seam, roughness: 0.6 }));
    seam.position.set(0, 4.1, 0);
    gb.add(seam);

    // cartridge on the back
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
   Scene
   ------------------------------------------------------------ */
function init() {
    const stage = document.getElementById('gb3d-stage');
    const canvas = document.getElementById('gb3d-canvas');
    if (!stage || !canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(10, 4.5, 16);

    // lights
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

    // model
    const gameboy = buildGameBoy();
    scene.add(gameboy);

    // soft ground shadow
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.ShadowMaterial({ opacity: 0.16 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5.6;
    ground.receiveShadow = true;
    scene.add(ground);

    // controls — slow full orbit, drag to spin, scroll to zoom
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 30;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.4;
    controls.target.set(0, 0, 0);

    // pause auto-rotation while the visitor is interacting
    let resumeTimer;
    controls.addEventListener('start', () => {
        controls.autoRotate = false;
        clearTimeout(resumeTimer);
    });
    controls.addEventListener('end', () => {
        resumeTimer = setTimeout(() => { controls.autoRotate = true; }, 2500);
    });

    function resize() {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // render only while on screen
    let running = false;
    let rafId = null;
    const clock = new THREE.Clock();

    function loop() {
        if (!running) { rafId = null; return; }
        const t = clock.getElapsedTime();
        gameboy.position.y = Math.sin(t * 1.1) * 0.18;
        gameboy.rotation.z = Math.sin(t * 0.6) * 0.02;
        controls.update();
        renderer.render(scene, camera);
        rafId = requestAnimationFrame(loop);
    }

    const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            running = entry.isIntersecting;
            if (running && rafId === null) rafId = requestAnimationFrame(loop);
        });
    }, { threshold: 0.05 });
    io.observe(stage);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
