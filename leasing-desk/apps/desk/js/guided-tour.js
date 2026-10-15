// Guided tour: a 7-step walkthrough of the Desk, shown on first visit.
import { prefersReducedMotion } from '../../shared/dom.js';

/* ================================================================
   GUIDED TOUR ENGINE
   ================================================================ */

const TOUR_STEPS = [
  {
    title: 'Welcome to the Leasing Desk',
    body: `<p>The front-desk console: today's showsheet (published live to the iPads), the <strong>Tour Queue</strong>, and the <strong>Email Builder</strong> for ready-to-send emails.</p><p>This takes about a minute. Skip or replay it anytime from <strong>Guided tour</strong> in the header.</p>`,
    target: 'header',
    pad: 10,
    cardPos: 'bottom-center'
  },
  {
    title: 'Showsheet and floor plans',
    body: `<p>With Dropbox sync on, every Desk and iPad stays on the current showsheet and floor plan master. Edited a file? Reload it in Dropbox so it saves, then click <strong>Sync now</strong>.</p><p>With sync off: <strong>Upload .xlsx</strong>, then <strong>Publish to iPads</strong>.</p>`,
    target: 'ssCard',
    pad: 8,
    cardPos: 'bottom-right'
  },
  {
    title: 'The Tour Queue',
    body: `<p>Who's waiting and for how long, who's on a tour, and the wait for someone new walking in. <strong>+ Plan tour</strong> adds a prospect.</p><p>Each row's filled button is the next step: <strong>Start tour</strong>, <strong>Finish</strong>, <strong>Mark sent</strong>. The tabs hold follow-ups, check-ins, future move-ins, rotation and history.</p>`,
    target: 'queuePanel',
    pad: 6,
    cardPos: 'bottom-center'
  },
  {
    title: 'Pick the email',
    body: `<p>Six templates: tour or inquiry follow-up, welcome, PFA, application confirmation and lease approval. Type the name — the preview updates as you go.</p>`,
    target: 'modeTourBtn',
    pad: 40,
    cardPos: 'bottom-right'
  },
  {
    title: 'Add units',
    body: `<p>Click a unit to add it; filter by size, priority or floor plan, or search. Each selected unit opens an editor for rent, concession, floor plan link and a note for the prospect.</p>`,
    target: 'quickFilters',
    pad: 8,
    cardPos: 'bottom-right'
  },
  {
    title: 'Copy and send',
    body: `<p><strong>Copy for Outlook/Gmail</strong>, then paste into a new email — the formatting comes along. The preview stays in view while you pick units further down.</p><p>If the email still has a blank like [Prospect], the Desk tells you after copying.</p>`,
    target: 'preview',
    pad: 10,
    cardPos: 'left-top'
  },
  {
    title: 'Templates and help',
    body: `<p><strong>Edit email templates</strong> changes any wording (saved in this browser). <strong>Help</strong> explains each tab.</p>`,
    target: null,
    pad: 0,
    cardPos: 'bottom-center',
    isLast: true
  }
];

let tourStepIdx = 0;
export let tourActive = false;
let tourResizeTimer = null;

export function startGuidedTour() {
  tourStepIdx = 0;
  tourActive = true;
  document.body.classList.add('tour-open');
  document.getElementById('tourOverlay').classList.add('active');
  renderTourStep();
  // Mark as seen
  try { localStorage.setItem('ld_tourSeen', '1'); } catch(e) {}
}

export function endTour() {
  tourActive = false;
  document.body.classList.remove('tour-open');
  document.getElementById('tourOverlay').classList.remove('active');
  document.getElementById('tourCard').classList.add('tour-hidden');
  // Clear highlight
  setTourRect(0, 0, 0, 0);
}

export function tourStep(dir) {
  const next = tourStepIdx + dir;
  if (next < 0) return;
  if (next >= TOUR_STEPS.length) { endTour(); return; }
  tourStepIdx = next;
  renderTourStep();
}

function renderTourStep() {
  const step = TOUR_STEPS[tourStepIdx];
  const total = TOUR_STEPS.length;
  const idx = tourStepIdx;

  // Header text
  document.getElementById('tourEyebrow').textContent = step.eyebrow || `Step ${idx+1} of ${total}`;
  document.getElementById('tourTitle').textContent = step.title;
  document.getElementById('tourBody').innerHTML = step.body;

  // Dots
  let dotsHtml = '';
  for (let i = 0; i < total; i++) {
    const cls = i < idx ? 'done' : (i === idx ? 'active' : '');
    dotsHtml += `<div class="tour-dot ${cls}" onclick="jumpTourTo(${i})" title="Step ${i+1}" style="cursor:pointer;"></div>`;
  }
  document.getElementById('tourDots').innerHTML = dotsHtml;

  // Nav buttons
  document.getElementById('tourPrev').style.display = idx === 0 ? 'none' : '';
  document.getElementById('tourNext').textContent = step.isLast ? 'Done' : 'Next →';

  // Position
  const card = document.getElementById('tourCard');
  card.classList.add('tour-hidden');

  const targetEl = getTargetEl(step.target);
  const pad = step.pad || 12;

  if (targetEl) {
    // Scroll target into view smoothly
    if (targetEl.scrollIntoView) targetEl.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
    // Wait for scroll + layout
    setTimeout(() => {
      const rect = targetEl.getBoundingClientRect();
      const r = {
        x: rect.left - pad, y: rect.top - pad,
        w: rect.width + pad*2, h: rect.height + pad*2
      };
      setTourRect(r.x, r.y, r.w, r.h);
      positionTourCard(card, r, step.cardPos);
      setTimeout(() => card.classList.remove('tour-hidden'), 60);
    }, 220);
  } else {
    // No target — clear spotlight, center card
    setTourRect(0, 0, 0, 0);
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = 340, ch = 260;
    card.style.left = Math.max(14, vw/2 - cw/2) + 'px';
    card.style.top  = Math.max(14, vh/2 - ch/2) + 'px';
    setTimeout(() => card.classList.remove('tour-hidden'), 60);
  }
}

export function jumpTourTo(i) {
  tourStepIdx = i;
  renderTourStep();
}

function getTargetEl(id) {
  if (!id) return null;
  // Try by ID first, then selector
  return document.getElementById(id) ||
    document.querySelector('.' + id) ||
    document.querySelector('[data-tour="' + id + '"]') ||
    (/^[a-z]+$/.test(id) ? document.querySelector(id) : null) ||   // plain tag names, e.g. 'header'
    null;
}

function setTourRect(x, y, w, h) {
  const margin = 6, none = !(w > 0 && h > 0);
  const cx = x - margin, cy = y - margin, cw = none ? 0 : w + margin*2, ch = none ? 0 : h + margin*2;
  const cutout = document.getElementById('tourCutout');
  const ring = document.getElementById('tourHighlightRect');
  cutout.setAttribute('x', cx);
  cutout.setAttribute('y', cy);
  cutout.setAttribute('width', Math.max(0, cw));
  cutout.setAttribute('height', Math.max(0, ch));
  ring.setAttribute('x', cx);
  ring.setAttribute('y', cy);
  ring.setAttribute('width', Math.max(0, cw));
  ring.setAttribute('height', Math.max(0, ch));
  ring.style.display = (w > 0 && h > 0) ? '' : 'none';   // no stray outline in the corner when a step has no target
}

function positionTourCard(card, targetRect, pos) {
  const cw = 340, ch = 240;  // approx card size
  const vw = window.innerWidth, vh = window.innerHeight;
  const PAD = 14;
  let left, top;

  switch (pos) {
    case 'bottom-right':
      left = Math.min(targetRect.x, vw - cw - PAD);
      top  = targetRect.y + targetRect.h + PAD;
      break;
    case 'bottom-left':
      left = Math.max(PAD, targetRect.x + targetRect.w - cw);
      top  = targetRect.y + targetRect.h + PAD;
      break;
    case 'bottom-center':
      left = Math.max(PAD, targetRect.x + targetRect.w/2 - cw/2);
      top  = targetRect.y + targetRect.h + PAD;
      break;
    case 'right-top':
      left = targetRect.x + targetRect.w + PAD;
      top  = targetRect.y;
      break;
    case 'left-top':
      left = targetRect.x - cw - PAD;
      top  = targetRect.y;
      break;
    default:
      left = targetRect.x;
      top  = targetRect.y + targetRect.h + PAD;
  }

  // Clamp to viewport
  left = Math.max(PAD, Math.min(left, vw - cw - PAD));
  top  = Math.max(PAD, Math.min(top,  vh - ch - PAD));

  // If would overlap the target, flip vertical
  const overlap = !(top > targetRect.y + targetRect.h + 4 ||
                    top + ch < targetRect.y - 4);
  if (overlap && pos.startsWith('bottom')) {
    top = targetRect.y - ch - PAD;
    top = Math.max(PAD, top);
  }

  card.style.left = left + 'px';
  card.style.top  = top  + 'px';
}

// Reposition on resize
window.addEventListener('resize', () => {
  if (!tourActive) return;
  clearTimeout(tourResizeTimer);
  tourResizeTimer = setTimeout(() => renderTourStep(), 120);
});

// ESC to close tour
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && tourActive) endTour();
});

// Auto-launch on first visit
(function checkFirstVisit() {
  try {
    if (!localStorage.getItem('ld_tourSeen')) {
      setTimeout(startGuidedTour, 600);
    }
  } catch(e) {}
})();
