/**
 * Portfolio — Dr. Carugo
 * Pokémon Blue title screen intro + warm minimal main site
 * with bracket micro-interactions and pixel easter eggs.
 */

document.addEventListener('DOMContentLoaded', () => {
    initTitleScreen();
    initTypingEffect();
    initScrollAnimations();
    initSmoothScroll();
    initNavHighlight();
});

/* ============================================================
   PIXEL SPRITES — GB Blue palette
   ============================================================ */
const GB_PAL = ['rgba(0,0,0,0)', '#1c2a54', '#3559a8', '#93a9d6'];

/* 16×16 trainer facing forward */
const TRAINER_SPRITE = [
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,1,1,2,2,2,2,2,2,2,1,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,3,3,1,3,3,3,1,3,3,1,0,0,0],
    [0,0,1,3,1,1,3,3,3,1,1,3,1,0,0,0],
    [0,0,0,1,3,3,3,3,3,3,3,1,0,0,0,0],
    [0,0,0,1,3,1,1,1,1,1,3,1,0,0,0,0],
    [0,0,1,1,1,2,2,2,2,2,1,1,1,0,0,0],
    [0,1,3,1,2,2,2,2,2,2,2,1,3,1,0,0],
    [0,1,3,1,2,2,2,2,2,2,2,1,3,1,0,0],
    [0,0,1,1,2,2,2,2,2,2,2,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,3,3,1,0,1,3,3,1,0,0,0,0],
    [0,0,1,1,1,1,1,0,1,1,1,1,1,0,0,0],
];

/* 16×16 turtle buddy (Blue Version mascot vibes) */
const BUDDY_SPRITE = [
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

function drawSprite(canvasId, sprite) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const cell = canvas.width / 16;
    for (let r = 0; r < 16; r++) {
        for (let c = 0; c < 16; c++) {
            if (!sprite[r][c]) continue;
            ctx.fillStyle = GB_PAL[sprite[r][c]];
            ctx.fillRect(c * cell, r * cell, cell, cell);
        }
    }
}

/* ============================================================
   TITLE SCREEN — Pokémon Blue
   ============================================================ */
function initTitleScreen() {
    const screen = document.getElementById('title-screen');
    if (!screen) return;

    drawSprite('title-sprite', TRAINER_SPRITE);
    drawSprite('title-sprite-buddy', BUDDY_SPRITE);

    function dismiss() {
        screen.classList.add('fade-out');
        document.body.classList.remove('title-locked');
        setTimeout(() => screen.classList.add('hidden'), 950);
    }

    screen.addEventListener('click', dismiss, { once: true });
    document.addEventListener('keydown', dismiss, { once: true });
}

/* ============================================================
   TYPING EFFECT
   ============================================================ */
function initTypingEffect() {
    const el = document.getElementById('heroTyping');
    if (!el) return;

    const phrases = [
        'loading modules: [Child_Neuropsychiatry, AI, VR]...',
        'whoami → Physician by day, Coder by night',
        'import Explainable_AI as xAI',
        'cat /etc/passions → {brain_plasticity, tech, gaming, chess}',
        './initialize_research.sh',
    ];

    let pi = 0, ci = 0, deleting = false, speed = 80;

    function type() {
        const phrase = phrases[pi];
        if (deleting) {
            el.textContent = phrase.substring(0, --ci);
            speed = 38;
        } else {
            el.textContent = phrase.substring(0, ++ci);
            speed = 80;
        }
        if (!deleting && ci === phrase.length) { deleting = true; speed = 2000; }
        else if (deleting && ci === 0)         { deleting = false; pi = (pi + 1) % phrases.length; speed = 500; }
        setTimeout(type, speed);
    }
    type();
}

/* ============================================================
   SCROLL REVEAL
   ============================================================ */
function initScrollAnimations() {
    const targets = document.querySelectorAll(
        '.section-header, .about-card, .publication-card, .project-card, .cv-item, .cv-download, .contact-message, .contact-card, .group-label'
    );

    targets.forEach(el => el.classList.add('reveal'));

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const siblings = [...(entry.target.parentElement?.querySelectorAll(':scope > .reveal') || [])];
            const idx = Math.max(siblings.indexOf(entry.target), 0);
            entry.target.style.transitionDelay = `${idx * 0.07}s`;
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(el => observer.observe(el));
}

/* ============================================================
   SMOOTH SCROLL
   ============================================================ */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const target = document.querySelector(a.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            window.scrollTo({
                top: target.getBoundingClientRect().top + window.pageYOffset - 90,
                behavior: 'smooth',
            });
        });
    });
}

/* ============================================================
   NAV ACTIVE HIGHLIGHT
   ============================================================ */
function initNavHighlight() {
    const sections = document.querySelectorAll('section[id]');
    const links = document.querySelectorAll('.nav-links a');
    if (!links.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            links.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
            });
        });
    }, { threshold: 0.35, rootMargin: '-5% 0px -55% 0px' });

    sections.forEach(s => observer.observe(s));
}
