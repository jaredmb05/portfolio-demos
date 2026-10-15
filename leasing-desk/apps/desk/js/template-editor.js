// Edit email templates dialog (saved in this browser).
import { renderPreview, syncOpeningLine, updateWelcomeUi } from './email-builder.js';
import { DEFAULT_PFA_SIGNED_BODY, DEFAULT_PFA_SIGNED_OPENING, DEFAULT_WELCOME, saveTpl, templates } from './email-templates.js';
import { state } from './state.js';
import { toast } from './ui.js';

export function openTemplateEditor() {
  // Tour
  document.getElementById('tplTourOpening').value = templates.tour.opening;
  document.getElementById('tplTourRequirements').value = templates.tour.requirements;
  document.getElementById('tplTourApplyText').value = templates.tour.applyText;
  document.getElementById('tplTourApplyUrl').value = templates.tour.applyUrl;
  document.getElementById('tplTourClosing').value = templates.tour.closing;
  document.getElementById('tplTourSignature').value = templates.tour.signature;
  // Inquiry
  document.getElementById('tplInquiryOpening').value = templates.inquiry.opening;
  document.getElementById('tplInquiryClosing').value = templates.inquiry.closing;
  document.getElementById('tplInquirySignature').value = templates.inquiry.signature;
  // Unavailable
  document.getElementById('tplUnavailable').value = templates.unavailable;
  // Welcome — preselect the building user is viewing in main UI
  document.getElementById('tplWelcomeBuilding').value = state.welcomeBuilding;
  loadWelcomeTplForEdit();
  document.getElementById('tplWelcomeSignature').value = templates.welcomeSignature || 'Best,';
  // PFA
  document.getElementById('tplPfaOpening').value = templates.pfa.opening;
  document.getElementById('tplPfaBody').value = templates.pfa.body;
  document.getElementById('tplPfaSignedOpening').value = templates.pfa.signedOpening || DEFAULT_PFA_SIGNED_OPENING;
  document.getElementById('tplPfaSignedBody').value = templates.pfa.signedBody || DEFAULT_PFA_SIGNED_BODY;
  document.getElementById('tplPfaSignature').value = templates.pfa.signature;
  // Parking + shuttle
  document.getElementById('tplParking').value = templates.parking;
  document.getElementById('tplShuttle').value = templates.shuttle;
  document.getElementById('templateModal').classList.add('show');
  // Default to current mode's tab when opening
  const tabForMode = {tour:'tour', inquiry:'inquiry', welcome:'welcome', pfa:'pfa'};
  switchTplTab(tabForMode[state.emailMode] || 'tour');
}

export function loadWelcomeTplForEdit() {
  // Save current building's edits in-memory before swapping (so user doesn't lose work)
  const currentEditB = document.getElementById('tplWelcomeBuilding').dataset.lastLoaded;
  if (currentEditB && templates.welcome[currentEditB]) {
    templates.welcome[currentEditB].subject = document.getElementById('tplWelcomeSubject').value;
    templates.welcome[currentEditB].body = document.getElementById('tplWelcomeBody').value;
    templates.welcome[currentEditB].coi = document.getElementById('tplWelcomeCoi').value;
  }
  const b = document.getElementById('tplWelcomeBuilding').value;
  const tpl = templates.welcome[b] || DEFAULT_WELCOME[b];
  document.getElementById('tplWelcomeSubject').value = tpl.subject || '';
  document.getElementById('tplWelcomeBody').value = tpl.body || '';
  document.getElementById('tplWelcomeCoi').value = tpl.coi || '';
  document.getElementById('tplWelcomeBuilding').dataset.lastLoaded = b;
}

export function switchTplTab(name) {
  ['tour','inquiry','unavailable','welcome','pfa','parking','shuttle'].forEach(n => {
    const tab = document.getElementById('tplTab-' + n);
    const panel = document.getElementById('tplPanel-' + n);
    if (tab) tab.classList.toggle('active', n === name);
    if (panel) panel.style.display = (n === name) ? 'block' : 'none';
  });
}

export function saveTemplate() {
  const was = { tour: templates.tour.opening, inquiry: templates.inquiry.opening };
  templates.tour.opening = document.getElementById('tplTourOpening').value;
  templates.tour.requirements = document.getElementById('tplTourRequirements').value;
  templates.tour.applyText = document.getElementById('tplTourApplyText').value;
  templates.tour.applyUrl = document.getElementById('tplTourApplyUrl').value;
  templates.tour.closing = document.getElementById('tplTourClosing').value;
  templates.tour.signature = document.getElementById('tplTourSignature').value;
  templates.inquiry.opening = document.getElementById('tplInquiryOpening').value;
  templates.inquiry.closing = document.getElementById('tplInquiryClosing').value;
  templates.inquiry.signature = document.getElementById('tplInquirySignature').value;
  templates.unavailable = document.getElementById('tplUnavailable').value;
  // Welcome — save the currently-loaded building's edits
  const b = document.getElementById('tplWelcomeBuilding').value;
  templates.welcome[b] = templates.welcome[b] || {};
  templates.welcome[b].subject = document.getElementById('tplWelcomeSubject').value;
  templates.welcome[b].body = document.getElementById('tplWelcomeBody').value;
  templates.welcome[b].coi = document.getElementById('tplWelcomeCoi').value;
  templates.welcomeSignature = document.getElementById('tplWelcomeSignature').value;
  templates.pfa.opening = document.getElementById('tplPfaOpening').value;
  templates.pfa.body = document.getElementById('tplPfaBody').value;
  templates.pfa.signedOpening = document.getElementById('tplPfaSignedOpening').value;
  templates.pfa.signedBody = document.getElementById('tplPfaSignedBody').value;
  templates.pfa.signature = document.getElementById('tplPfaSignature').value;
  templates.parking = document.getElementById('tplParking').value;
  templates.shuttle = document.getElementById('tplShuttle').value;
  saveTpl();
  updateWelcomeUi();
  syncOpeningLine(was);
  renderPreview();
  document.getElementById('templateModal').classList.remove('show');
  toast('Templates saved');
}
