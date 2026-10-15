// This computer's saved showsheet, floor plans, templates and email mode (localStorage).
import { DEFAULT_WELCOME, templates } from './email-templates.js';
import { updateStatus } from './showsheet.js';
import { state } from './state.js';
import { toast } from './ui.js';

export function loadState() {
  try {
    // Floor plans
    const fp = localStorage.getItem('ld_floorPlans');
    if (fp) state.floorPlans = JSON.parse(fp);
    const fpm = localStorage.getItem('ld_fpMeta');
    if (fpm) state.fpMeta = JSON.parse(fpm);
    // Showsheet (parsed units + meta)
    const ss = localStorage.getItem('ld_showsheet');
    if (ss) {
      try { state.units = JSON.parse(ss); } catch(e) { state.units = []; }
    }
    const ssm = localStorage.getItem('ld_ssMeta');
    if (ssm) state.ssMeta = JSON.parse(ssm);
    // Templates
    const tpl = localStorage.getItem('ld_templates');
    if (tpl) {
      const saved = JSON.parse(tpl);
      if (saved.tour) templates.tour = {...templates.tour, ...saved.tour};
      if (saved.inquiry) templates.inquiry = {...templates.inquiry, ...saved.inquiry};
      if (typeof saved.unavailable === 'string') templates.unavailable = saved.unavailable;
      if (saved.welcome && typeof saved.welcome === 'object') {
        // Per-building merge: defaults preserved if user only edited some
        for (const b of Object.keys(templates.welcome)) {
          if (saved.welcome[b]) templates.welcome[b] = {...templates.welcome[b], ...saved.welcome[b]};
        }
      }
      if (typeof saved.welcomeSignature === 'string') templates.welcomeSignature = saved.welcomeSignature;
      if (saved.pfa && typeof saved.pfa === 'object') templates.pfa = {...templates.pfa, ...saved.pfa};
      if (saved.parking) templates.parking = saved.parking;
      if (saved.shuttle) templates.shuttle = saved.shuttle;
    }
    const mode = localStorage.getItem('ld_emailMode');
    if (mode === 'tour' || mode === 'inquiry' || mode === 'welcome' || mode === 'pfa' || mode === 'appconf' || mode === 'approval') state.emailMode = mode;
    const wb = localStorage.getItem('ld_welcomeBuilding');
    if (wb && DEFAULT_WELCOME[wb]) state.welcomeBuilding = wb;
  } catch(e) { console.warn('Load failed', e); }
  updateStatus();
}
export function saveFp() {
  if (!state.adoptingPublish) localStorage.setItem('ld_ssLocalIso', new Date().toISOString());
  localStorage.setItem('ld_floorPlans', JSON.stringify(state.floorPlans));
  if (state.fpMeta) localStorage.setItem('ld_fpMeta', JSON.stringify(state.fpMeta));
  updateStatus();
}
export function saveSs() {
  try {
    if (!state.adoptingPublish) localStorage.setItem('ld_ssLocalIso', new Date().toISOString());
    localStorage.setItem('ld_showsheet', JSON.stringify(state.units));
    if (state.ssMeta) localStorage.setItem('ld_ssMeta', JSON.stringify(state.ssMeta));
    updateStatus();
  } catch(e) {
    console.warn('Showsheet save failed (likely localStorage quota):', e);
    toast('Showsheet too large to save — will need re-upload after close', true);
  }
}
export function saveMode() { localStorage.setItem('ld_emailMode', state.emailMode); }
export function saveWelcomeBuilding() { localStorage.setItem('ld_welcomeBuilding', state.welcomeBuilding); }
