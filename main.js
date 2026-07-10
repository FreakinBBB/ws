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
   TITLE SCREEN — Pokémon Blue
   Press start → dive into the screen, revealing the 3D Game Boy
   ============================================================ */
function initTitleScreen() {
    const screen = document.getElementById('title-screen');
    if (!screen) return;

    let dismissed = false;

    function dismiss() {
        if (dismissed) return;
        dismissed = true;
        screen.classList.add('fade-out');
        document.body.classList.remove('title-locked');
        document.dispatchEvent(new CustomEvent('gb:start'));
        setTimeout(() => screen.classList.add('hidden'), 1250);
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
        '.section-header, .about-card, .publication-card, .project-card, .cv-item, .cv-download, .contact-message, .contact-card, .group-label, .priorities, .manifesto-line, .footer-cta'
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
    const sections = [...document.querySelectorAll('section[id]')];
    const links = [...document.querySelectorAll('.nav-links a')];
    if (!links.length) return;

    function updateActiveLink() {
        const scrollLine = window.scrollY + window.innerHeight * 0.38;
        let active = sections[0];

        sections.forEach(section => {
            if (section.offsetTop <= scrollLine) active = section;
        });

        links.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${active.id}`);
        });
    }

    updateActiveLink();
    window.addEventListener('scroll', updateActiveLink, { passive: true });
    window.addEventListener('resize', updateActiveLink, { passive: true });
}
