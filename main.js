/**
 * Portfolio — Dr. Carugo
 * Space-themed interactivity: stars, shooting stars, comet cursor,
 * hero constellation canvas, magnetic hover, glitch reveals.
 */

document.addEventListener('DOMContentLoaded', () => {
    initTitleScreen();
    initTypingEffect();
    initHeroCanvas();
    initCometCursor();
    initScrollAnimations();
    initSmoothScroll();
    initSidebarHighlight();
    initMagneticCards();
    initGlitchSectionNums();
    initGBTrainer();
    initBattleFlash();
});

/* ============================================================
   TITLE SCREEN  — dark space with stars + shooting stars
   ============================================================ */
function initTitleScreen() {
    const screen = document.getElementById('title-screen');
    if (!screen) return;

    const stopStars = initTitleStars();

    function dismiss() {
        screen.classList.add('fade-out');
        setTimeout(() => {
            screen.classList.add('hidden');
            if (stopStars) stopStars();
        }, 1100);
    }

    screen.addEventListener('click', dismiss, { once: true });
    document.addEventListener('keydown', dismiss, { once: true });
}

function initTitleStars() {
    const canvas = document.getElementById('star-canvas');
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    let stars = [];
    let shooters = [];
    let animId;
    let time = 0;

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        buildStars();
    }

    function buildStars() {
        stars = [];
        const count = Math.min(Math.floor((canvas.width * canvas.height) / 2200), 380);
        for (let i = 0; i < count; i++) {
            const big = Math.random() < 0.06;
            stars.push({
                x:     Math.random() * canvas.width,
                y:     Math.random() * canvas.height,
                r:     big ? Math.random() * 1.8 + 1 : Math.random() * 1.1 + 0.2,
                base:  Math.random() * 0.7 + 0.25,
                speed: Math.random() * 0.5 + 0.1,
                phase: Math.random() * Math.PI * 2,
                blue:  Math.random() < 0.3,
                gold:  Math.random() < 0.06,
            });
        }
    }

    function spawnShooter() {
        const angle = (Math.random() * 30 + 15) * (Math.PI / 180);
        const startX = Math.random() * canvas.width * 0.7;
        const startY = Math.random() * canvas.height * 0.4;
        shooters.push({
            x: startX, y: startY,
            vx: Math.cos(angle) * (canvas.width / 48),
            vy: Math.sin(angle) * (canvas.width / 48),
            life: 1, decay: 0.025 + Math.random() * 0.02,
            len: 80 + Math.random() * 120,
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        time += 0.018;

        /* nebula glow */
        const grad = ctx.createRadialGradient(
            canvas.width * 0.5, canvas.height * 0.45, 0,
            canvas.width * 0.5, canvas.height * 0.45, canvas.width * 0.55
        );
        grad.addColorStop(0,   'rgba(20, 30, 80, 0.45)');
        grad.addColorStop(0.5, 'rgba(10, 10, 40, 0.2)');
        grad.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        /* stars */
        for (const s of stars) {
            const pulse = Math.sin(time * s.speed + s.phase);
            const alpha = s.base * (0.5 + 0.5 * pulse);
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            if (s.gold)       ctx.fillStyle = `rgba(255,220,120,${alpha})`;
            else if (s.blue)  ctx.fillStyle = `rgba(160,200,255,${alpha})`;
            else               ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.fill();
        }

        /* shooting stars */
        for (let i = shooters.length - 1; i >= 0; i--) {
            const s = shooters[i];
            const tailX = s.x - s.vx * (s.len / (canvas.width / 48));
            const tailY = s.y - s.vy * (s.len / (canvas.width / 48));
            const grad2 = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
            grad2.addColorStop(0, `rgba(255,255,255,0)`);
            grad2.addColorStop(1, `rgba(200,220,255,${s.life * 0.85})`);
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(s.x, s.y);
            ctx.strokeStyle = grad2;
            ctx.lineWidth = 1.5 * s.life;
            ctx.stroke();
            s.x += s.vx;
            s.y += s.vy;
            s.life -= s.decay;
            if (s.life <= 0) shooters.splice(i, 1);
        }

        /* random new shooter */
        if (Math.random() < 0.008 && shooters.length < 4) spawnShooter();

        animId = requestAnimationFrame(draw);
    }

    resize();
    draw();

    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); };
}

/* ============================================================
   HERO CANVAS — floating constellation with mouse parallax
   ============================================================ */
function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let pts = [];
    let mouse = { x: 0, y: 0 };
    let animId;
    let time = 0;

    function resize() {
        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        buildPts();
    }

    function buildPts() {
        pts = [];
        const count = Math.floor((canvas.width * canvas.height) / 14000);
        for (let i = 0; i < count; i++) {
            pts.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.18,
                vy: (Math.random() - 0.5) * 0.18,
                r:  Math.random() * 1.4 + 0.4,
                phase: Math.random() * Math.PI * 2,
            });
        }
    }

    const hero = canvas.closest('.hero');
    if (hero) {
        hero.addEventListener('mousemove', e => {
            const rect = hero.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        }, { passive: true });
    }

    const LINK_DIST = 120;
    const MOUSE_DIST = 160;

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        time += 0.012;

        for (const p of pts) {
            /* gentle mouse repulsion */
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < MOUSE_DIST) {
                const f = (MOUSE_DIST - d) / MOUSE_DIST * 0.012;
                p.vx += dx / d * f;
                p.vy += dy / d * f;
            }

            p.vx *= 0.99;
            p.vy *= 0.99;
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width)  p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;

            const alpha = 0.35 + 0.25 * Math.sin(time + p.phase);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(29,58,95,${alpha})`;
            ctx.fill();
        }

        /* constellation lines */
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                const dx = pts[i].x - pts[j].x;
                const dy = pts[i].y - pts[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < LINK_DIST) {
                    const alpha = (1 - dist / LINK_DIST) * 0.15;
                    ctx.beginPath();
                    ctx.moveTo(pts[i].x, pts[i].y);
                    ctx.lineTo(pts[j].x, pts[j].y);
                    ctx.strokeStyle = `rgba(29,58,95,${alpha})`;
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                }
            }
        }

        animId = requestAnimationFrame(draw);
    }

    resize();
    draw();

    window.addEventListener('resize', () => resize(), { passive: true });
}

/* ============================================================
   COMET CURSOR TRAIL
   ============================================================ */
function initCometCursor() {
    const colors = [
        'rgba(100,160,255,0.85)',
        'rgba(160,200,255,0.7)',
        'rgba(200,220,255,0.5)',
        'rgba(255,220,120,0.6)',
        'rgba(29,58,95,0.9)',
    ];

    let lastX = 0, lastY = 0, ticking = false;

    document.addEventListener('mousemove', e => {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const speed = Math.sqrt(dx * dx + dy * dy);
        lastX = e.clientX;
        lastY = e.clientY;

        if (speed < 3) return;
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const count = Math.min(Math.floor(speed / 6) + 1, 5);
            for (let i = 0; i < count; i++) {
                const el = document.createElement('div');
                el.className = 'comet-particle';
                const size = Math.random() * 6 + 2;
                const color = colors[Math.floor(Math.random() * colors.length)];
                el.style.cssText = `
                    left:${e.clientX + (Math.random()-0.5)*12}px;
                    top:${e.clientY + (Math.random()-0.5)*12}px;
                    width:${size}px;
                    height:${size}px;
                    background:${color};
                    animation-duration:${0.4 + Math.random() * 0.4}s;
                `;
                document.body.appendChild(el);
                el.addEventListener('animationend', () => el.remove());
            }
            ticking = false;
        });
    }, { passive: true });
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
   SCROLL ANIMATIONS — nebula reveal
   ============================================================ */
function initScrollAnimations() {
    const targets = document.querySelectorAll(
        '.about-row, .publication-card, .project-card, .contact-card, .cv-item, .section-header'
    );

    targets.forEach(el => el.classList.add('nebula-reveal'));

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const siblings = [...(entry.target.parentElement?.querySelectorAll('.nebula-reveal') || [])];
            const idx = siblings.indexOf(entry.target);
            entry.target.style.animationDelay = `${idx * 0.08}s`;
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(el => observer.observe(el));
}

/* ============================================================
   MAGNETIC CARDS
   ============================================================ */
function initMagneticCards() {
    const cards = document.querySelectorAll('.project-card, .contact-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const cx = rect.left + rect.width  / 2;
            const cy = rect.top  + rect.height / 2;
            const dx = (e.clientX - cx) / rect.width  * 12;
            const dy = (e.clientY - cy) / rect.height * 8;
            card.style.transform = `translate(${dx * 0.5}px, ${dy * 0.5 - 6}px) rotateX(${-dy * 0.4}deg) rotateY(${dx * 0.4}deg)`;
        }, { passive: true });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.transition = 'transform 0.55s cubic-bezier(0.175,0.885,0.32,1.275)';
        });
        card.addEventListener('mouseenter', () => {
            card.style.transition = 'transform 0.18s ease';
        });
    });
}

/* ============================================================
   GLITCH ON SECTION NUMBERS
   ============================================================ */
function initGlitchSectionNums() {
    const nums = document.querySelectorAll('.section-num');
    nums.forEach(el => {
        el.setAttribute('data-text', el.textContent);
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) triggerGlitch(el);
            });
        }, { threshold: 0.5 });
        observer.observe(el);
    });

    function triggerGlitch(el) {
        el.classList.add('glitching');
        setTimeout(() => el.classList.remove('glitching'), 400);
    }
}

/* ============================================================
   SMOOTH SCROLL
   ============================================================ */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const target = document.querySelector(a.getAttribute('href'));
            if (target) {
                window.scrollTo({
                    top: target.getBoundingClientRect().top + window.pageYOffset - 70,
                    behavior: 'smooth',
                });
            }
        });
    });
}

/* ============================================================
   SIDEBAR HIGHLIGHT
   ============================================================ */
function initSidebarHighlight() {
    const sections  = document.querySelectorAll('section[id]');
    const sideLinks = document.querySelectorAll('.sidebar-nav a');
    if (!sideLinks.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            sideLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${entry.target.id}`) {
                    link.classList.add('active');
                }
            });
        });
    }, { threshold: 0.35, rootMargin: '-5% 0px -55% 0px' });

    sections.forEach(s => observer.observe(s));
}

/* ============================================================
   GAMEBOY TRAINER SPRITE — walks across screen on scroll
   ============================================================ */
function initGBTrainer() {
    const wrap = document.createElement('div');
    wrap.id = 'gb-trainer';
    document.body.appendChild(wrap);

    const SCALE = 4;
    const W = 10, H = 16;
    const canvas = document.createElement('canvas');
    canvas.width  = W * SCALE;
    canvas.height = H * SCALE;
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    /* GB palette indices → colors */
    const PAL = ['rgba(0,0,0,0)', '#182838', '#486880', '#98b8c8', '#e8f0f0'];
    /*            0=transparent   1=darkest   2=dark     3=light    4=lightest */

    /* 10×16 sprite frames: walk A and walk B */
    const FRAME_A = [
        [0,0,1,1,1,1,0,0,0,0],
        [0,0,1,2,2,1,0,0,0,0],
        [0,0,1,2,2,1,0,0,0,0],
        [0,0,1,1,1,1,0,0,0,0],
        [0,1,2,1,1,2,1,0,0,0],
        [0,1,1,1,1,1,1,0,0,0],
        [1,1,3,3,3,3,1,1,0,0],
        [1,1,3,3,3,3,1,1,0,0],
        [0,1,3,3,3,3,1,0,0,0],
        [0,1,1,3,3,1,1,0,0,0],
        [0,0,1,3,3,1,0,0,0,0],
        [0,0,1,3,3,1,0,0,0,0],
        [0,0,1,1,0,1,1,0,0,0],
        [0,1,1,0,0,0,1,1,0,0],
        [0,1,0,0,0,0,0,1,0,0],
        [0,0,0,0,0,0,0,0,0,0],
    ];
    const FRAME_B = [
        [0,0,1,1,1,1,0,0,0,0],
        [0,0,1,2,2,1,0,0,0,0],
        [0,0,1,2,2,1,0,0,0,0],
        [0,0,1,1,1,1,0,0,0,0],
        [0,1,2,1,1,2,1,0,0,0],
        [0,1,1,1,1,1,1,0,0,0],
        [1,1,3,3,3,3,1,1,0,0],
        [1,1,3,3,3,3,1,1,0,0],
        [0,1,3,3,3,3,1,0,0,0],
        [0,1,1,3,3,1,1,0,0,0],
        [0,0,1,3,3,1,0,0,0,0],
        [0,0,1,3,3,1,0,0,0,0],
        [0,1,1,0,0,1,1,0,0,0],
        [0,1,0,0,0,0,1,1,0,0],
        [0,0,0,0,0,0,1,1,0,0],
        [0,0,0,0,0,0,0,0,0,0],
    ];

    function drawFrame(frame) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let row = 0; row < H; row++) {
            for (let col = 0; col < W; col++) {
                const v = frame[row][col];
                if (v === 0) continue;
                ctx.fillStyle = PAL[v];
                ctx.fillRect(col * SCALE, row * SCALE, SCALE, SCALE);
            }
        }
    }

    let frame = 0;
    let posX = -50;
    let lastScroll = window.scrollY;
    let animFrame = 0;
    let walking = false;
    let frameTimer = 0;

    drawFrame(FRAME_A);

    function update() {
        const scrollY = window.scrollY;
        const delta = scrollY - lastScroll;
        lastScroll = scrollY;

        if (Math.abs(delta) > 0.5) {
            walking = true;
            const dir = delta > 0 ? 1 : -1;
            posX += dir * Math.min(Math.abs(delta) * 0.4, 8);
            posX = Math.max(-20, Math.min(window.innerWidth - W * SCALE + 20, posX));

            frameTimer++;
            if (frameTimer > 6) {
                frame = frame === 0 ? 1 : 0;
                frameTimer = 0;
                drawFrame(frame === 0 ? FRAME_A : FRAME_B);
            }
        } else {
            walking = false;
            if (frame !== 0) { frame = 0; drawFrame(FRAME_A); }
        }

        wrap.style.transform = `translateX(${posX}px)`;
        animFrame = requestAnimationFrame(update);
    }
    update();
}

/* ============================================================
   BATTLE FLASH on section entry
   ============================================================ */
function initBattleFlash() {
    const sections = document.querySelectorAll('.section-panel');
    let flashed = new Set();

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !flashed.has(entry.target)) {
                flashed.add(entry.target);
                entry.target.classList.add('battle-flash');
                setTimeout(() => entry.target.classList.remove('battle-flash'), 600);
            }
        });
    }, { threshold: 0.25 });

    sections.forEach(s => observer.observe(s));
}

/* ============================================================
   NAV SCROLL EFFECT
   ============================================================ */
window.addEventListener('scroll', () => {
    const nav = document.querySelector('.nav');
    if (nav) {
        nav.style.borderBottomColor = window.scrollY > 60
            ? 'rgba(0,0,0,0.1)'
            : 'var(--text-faint)';
    }
}, { passive: true });
