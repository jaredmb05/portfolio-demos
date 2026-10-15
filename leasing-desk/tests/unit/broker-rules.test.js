// The broker rules from the brief, in both apps: what the Desk follow-up email says and what the iPad quotes.
// The rulings on the cases where the apps disagreed (AUDIT.md M1–M5) are in money-rulings.test.js.
import { describe, expect, it } from 'vitest';
import { opOnlyOffer, resolveConcession } from '../../apps/shared/pricing.js';
import { brokerDefaults } from '../../apps/desk/js/rules/tour-selection.js';
import { AND_UNIT, deskEmail, FREE_ONLY_UNIT, ipadQuote, NO_INCENTIVE_UNIT, OP_ONLY_UNIT, OR_UNIT } from './fixtures.js';

describe('Desk email', () => {
  it('no broker on an OR unit: prospect gets the free month and the net effective, and the OP is never mentioned', () => {
    expect(deskEmail(OR_UNIT)).toEqual({ text: '1 Month Free', netEff: 3804 });
  });
  it('no broker on an AND unit: the OP part is dropped, prospect gets the free month and the net effective', () => {
    expect(deskEmail(AND_UNIT)).toEqual({ text: '1 Month Free', netEff: 5913 });
  });
  it('broker on an OR unit: the email quotes the OP only, with no net effective', () => {
    expect(deskEmail(OR_UNIT, { broker: true })).toEqual({ text: '1 Mo. OP', netEff: null });
  });
  it('broker on an OR unit who waives the OP ("OP only" unchecked, net effective shown): prospect gets the free month and the net effective', () => {
    expect(deskEmail(OR_UNIT, { broker: true, edit: { opOnly: false, showNetEff: true } })).toEqual({ text: '1 Month Free', netEff: 3804 });
  });
  it('no broker, free month only: the free month and the net effective', () => {
    expect(deskEmail(FREE_ONLY_UNIT)).toEqual({ text: '1 Month Free', netEff: 3804 });
  });
  it('no broker on an OP-only unit: no concession line and no net effective (there is nothing for the prospect)', () => {
    expect(deskEmail(OP_ONLY_UNIT)).toEqual({ text: '', netEff: null });
  });
  it('broker on an OP-only unit: the OP', () => {
    expect(deskEmail(OP_ONLY_UNIT, { broker: true })).toEqual({ text: '1 Mo. OP', netEff: null });
  });
  it('an offer is OP-only when every part of it is an OP', () => {
    expect(opOnlyOffer('1 Mo. OP')).toBe(true);
    expect(opOnlyOffer('1/2 Mo. OP or $3,000 OP')).toBe(true);
    for (const t of ['1 Month Free OR 1 Mo. OP', '1 Month Free and 1/2 Mo. OP', 'No Incentive', '', undefined]) expect(opOnlyOffer(t)).toBe(false);
  });
  it('"No Incentive": no concession line and no net effective', () => {
    expect(deskEmail(NO_INCENTIVE_UNIT)).toEqual({ text: '', netEff: null });
    expect(deskEmail(NO_INCENTIVE_UNIT, { broker: true })).toEqual({ text: '', netEff: null });
  });
});

describe('iPad quote', () => {
  it('no broker on an OR unit: the free month and the net effective, never the OP', () => {
    expect(ipadQuote(OR_UNIT)).toEqual({ line1: '$4,150 · 1 Month Free', line2: 'Net effective $3,804' });
  });
  it('no broker on an AND unit: the free month and the net effective, never the OP', () => {
    expect(ipadQuote(AND_UNIT)).toEqual({ line1: '$6,450 · 1 Month Free', line2: 'Net effective $5,913' });
  });
  it('broker on an OR unit: the OP goes to the broker; the prospect gets the free month only if the broker waives', () => {
    expect(ipadQuote(OR_UNIT, { broker: true })).toEqual({ line1: '$4,150 · 1 Mo. OP to the broker', line2: 'If the broker waives the OP: 1 Month Free → net $3,804' });
  });
  it('broker on an AND unit: the broker gets the OP and the prospect gets the net effective', () => {
    expect(ipadQuote(AND_UNIT, { broker: true })).toEqual({ line1: '$6,450 · 1 Month Free AND 1/2 Mo. OP', line2: 'Net effective $5,913 · broker also gets the OP' });
  });
  it('broker on an OP-only unit: the OP to the broker, nothing for the prospect to waive into', () => {
    expect(ipadQuote(OP_ONLY_UNIT, { broker: true })).toEqual({ line1: '$4,150 · 1 Mo. OP to the broker', line2: '' });
  });
  it('no broker on an OP-only unit: no concession to quote', () => {
    expect(ipadQuote(OP_ONLY_UNIT)).toEqual({ line1: '$4,150 · no concession', line2: '' });
  });
  it('"No Incentive": rent only, with or without a broker', () => {
    expect(ipadQuote(NO_INCENTIVE_UNIT)).toEqual({ line1: '$3,600 · no concession', line2: '' });
    expect(ipadQuote(NO_INCENTIVE_UNIT, { broker: true })).toEqual({ line1: '$3,600 · no concession', line2: '' });
  });
});

describe('Desk "Sending to a broker" switch', () => {
  const email = (unit, on) => resolveConcession({ ...unit, ...brokerDefaults(unit, on) });

  it('off (written to the prospect): OR → the free month and net; AND → the free month and net, OP hidden', () => {
    expect(email(OR_UNIT, false)).toEqual({ text: '1 Month Free', netEff: 3804 });
    expect(email(AND_UNIT, false)).toEqual({ text: '1 Month Free', netEff: 5913 });
  });
  it('on (broker terms): OR → the OP, no net; AND → the free month and the OP, with the net', () => {
    expect(email(OR_UNIT, true)).toEqual({ text: '1 Mo. OP', netEff: null });
    expect(email(AND_UNIT, true)).toEqual({ text: '1 Month Free and 1/2 Mo. OP', netEff: 5913 });
  });
  it('sets the same unit checkboxes a tour with or without a broker would', () => {
    expect(brokerDefaults(OR_UNIT, true)).toEqual({ noBroker: false, opOnly: true, showNetEff: false });
    expect(brokerDefaults(OR_UNIT, false)).toEqual({ noBroker: true, opOnly: false, showNetEff: true });
    expect(brokerDefaults(NO_INCENTIVE_UNIT, false).showNetEff).toBe(false);
  });
});
