/**
 * Portfolio — Dr. Carugo
 * Title screen, typing effect, scroll animations, sidebar highlight
 */

document.addEventListener('DOMContentLoaded', () => {
    initTitleScreen();
    initTypingEffect();
    initScrollAnimations();
    initSmoothScroll();
    initSidebarHighlight();
});

/* ============================================================
   TITLE SCREEN
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

/* Animated star canvas for title screen */
function initTitleStars() {
    const canvas = document.getElementById('star-canvas');
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    let stars = [];
    let animId;
    let time = 0;

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        buildStars();
    }

    function buildStars() {
        stars = [];
        const count = Math.min(Math.floor((canvas.width * canvas.height) / 2800), 320);
        for (let i = 0; i < count; i++) {
            const big = Math.random() < 0.06;
            stars.push({
                x:     Math.random() * canvas.width,
                y:     Math.random() * canvas.height,
                r:     big ? Math.random() * 1.8 + 1 : Math.random() * 1.2 + 0.3,
                base:  Math.random() * 0.6 + 0.2,
                speed: Math.random() * 0.6 + 0.15,
                phase: Math.random() * Math.PI * 2,
                blue:  Math.random() < 0.25,
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        time += 0.018;
        for (const s of stars) {
            const pulse = Math.sin(time * s.speed + s.phase);
            const alpha = s.base * (0.55 + 0.45 * pulse);
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = s.blue ? `rgba(176,210,240,${alpha})` : `rgba(255,255,255,${alpha})`;
            ctx.fill();
        }
        animId = requestAnimationFrame(draw);
    }

    resize();
    draw();

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', onResize);
    };
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
   SCROLL ANIMATIONS
   ============================================================ */
function initScrollAnimations() {
    const targets = document.querySelectorAll(
        '.about-card, .publication-card, .project-card, .contact-content, .cv-content'
    );

    targets.forEach((el, i) => {
        el.classList.add(i % 2 === 0 ? 'slide-left' : 'slide-right');
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const siblings = entry.target.parentElement?.querySelectorAll('.slide-left, .slide-right');
            if (siblings) {
                siblings.forEach((s, i) => { s.style.transitionDelay = `${i * 0.09}s`; });
            }
            entry.target.classList.add('visible');
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
