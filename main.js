/**
 * Portfolio — Dr. Carugo
 * Pokémon Blue title screen intro + warm minimal main site
 * with bracket micro-interactions and pixel easter eggs.
 */

document.addEventListener('DOMContentLoaded', () => {
    initTitleScreen();
    initTypingEffect();
    initSectionRail();
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
        'import nerd as bebo',
        'developmental care = confusion ++',
        'const (xAI + medicine) ',
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
   SCROLL RAIL — dash-style section indicator on the right edge
   ============================================================ */
function initSectionRail() {
    const stops = [
        ['#top',          'Start'],
        ['#about',        'About'],
        ['#publications', 'Papers'],
        ['#projects',     'Projects'],
        ['#cv',           'CV'],
        ['#contact',      'Contact'],
    ];
    const rail = document.createElement('nav');
    rail.className = 'scroll-rail';
    rail.setAttribute('aria-label', 'Sections');
    stops.forEach(([href, label]) => {
        const a = document.createElement('a');
        a.href = href;
        a.title = label;
        a.setAttribute('aria-label', label);
        rail.appendChild(a);
    });
    document.body.appendChild(rail);
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
    const links = [...document.querySelectorAll('.nav-links a, .scroll-rail a')];
    if (!links.length) return;

    function updateActiveLink() {
        const scrollLine = window.scrollY + window.innerHeight * 0.38;
        let activeId = 'top'; // hero, before the first section starts

        sections.forEach(section => {
            if (section.offsetTop <= scrollLine) activeId = section.id;
        });

        links.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${activeId}`);
        });
    }

    updateActiveLink();
    window.addEventListener('scroll', updateActiveLink, { passive: true });
    window.addEventListener('resize', updateActiveLink, { passive: true });
}
