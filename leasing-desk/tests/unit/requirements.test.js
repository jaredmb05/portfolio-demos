// Application requirements: the income multiples and the application fee are constants, used everywhere they appear.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APPLICATION_FEE, GUARANTOR_MULTIPLE, INCOME_MULTIPLE, taxYears } from '../../apps/shared/requirements.js';
import { templates } from '../../apps/desk/js/email-templates.js';

const APPS = new URL('../../apps/', import.meta.url).pathname;
const files = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.(js|html)$/.test(f) ? [p] : []; });

describe('income and fee rules', () => {
  it('tenant income is 45× the monthly rent, guarantor income 75×, and the fee $20 per applicant', () => {
    expect([INCOME_MULTIPLE, GUARANTOR_MULTIPLE, APPLICATION_FEE]).toEqual([45, 75, 20]);
  });
  it('the Desk email states them from the constants', () => {
    const text = JSON.stringify(templates);
    expect(text).toContain(`Tenant Income = ${INCOME_MULTIPLE}x monthly rent`);
    expect(text).toContain(`Guarantor Income = ${GUARANTOR_MULTIPLE}x the monthly rent`);
    expect(text).toContain(`Application fee = $${APPLICATION_FEE}/person`);
  });
  it('no other file writes the numbers out by hand (the iPad tab and quiz read the constants too)', () => {
    const literal = /\b(45|75)\s*[x×]|\$20\s*(per|\/)\s*(person|applica)/;
    // (the demo's seeded quiz answers are data, and shared/vendor is a third-party library)
    const offenders = files(APPS).filter(p => !p.endsWith('shared/requirements.js') && !/shared\/(demo|vendor)\//.test(p) && literal.test(readFileSync(p, 'utf8')));
    expect(offenders.map(p => relative(APPS, p))).toEqual([]);
  });
});

describe('tax years asked of self-employed applicants', () => {
  it('after Tax Day (April 16): the two years before this one', () => {
    expect(taxYears(new Date('2026-10-06T12:00:00'))).toEqual({ y1: 2025, y2: 2024, y3: 2023 });
    expect(taxYears(new Date('2026-04-16T09:00:00'))).toEqual({ y1: 2025, y2: 2024, y3: 2023 });
  });
  it('before Tax Day: one year further back, since most haven\'t filed last year yet', () => {
    expect(taxYears(new Date('2026-04-15T18:00:00'))).toEqual({ y1: 2024, y2: 2023, y3: 2022 });
    expect(taxYears(new Date('2026-01-02T12:00:00'))).toEqual({ y1: 2024, y2: 2023, y3: 2022 });
  });
});
