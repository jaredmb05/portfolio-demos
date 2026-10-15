// Default wording for the six emails, and the editable copy saved in this browser.
import { APPLICATION_FEE, GUARANTOR_MULTIPLE, INCOME_MULTIPLE } from '../../shared/requirements.js';

const DEFAULT_PARKING_HTML = `<strong style="color:#1f5c1f;">PARKING INFO</strong><br>
<strong>Resident Pricing:</strong><br>
Unreserved Sedan — $250<br>
Unreserved SUV — $350<br>
Reserved Sedan — $450<br>
Reserved SUV — $550<br>
<br>
<em>Parking rates listed are provided as a general guide. Final pricing and vehicle classification are determined by garage management and may vary.</em><br>
Residents must visit garage in person for resident pricing<br>
Garage Contact: 332-555-0160 (managed by third party)`;

const DEFAULT_SHUTTLE_HTML = `<strong style="color:#1f4e7a;">Shuttle Bus Service</strong><br>
<em>Track shuttle real time using app</em><br>
Shuttle to and from the Harbor Street subway station, one stop from Midtown:<br>
Pick up at 2040 and 2230 Tidemark Blvd approximately every 20 minutes between 6:30-10:30 AM (additional shuttles 7:30-9 AM) and 4:30-8:30 PM Monday-Friday, and 9 AM-1 PM, and 2-6:30 PM on weekends and holidays.`;

const DEFAULT_REQUIREMENTS = `<strong><u>Application Requirements:</u></strong><br>
<ul>
  <li>Tenant Income = ${INCOME_MULTIPLE}x monthly rent</li>
  <li>Guarantor Income = ${GUARANTOR_MULTIPLE}x the monthly rent</li>
  <li>Application fee = $${APPLICATION_FEE}/person</li>
  <li>Photo ID</li>
  <li>Bank Statements (with proof of ownership)</li>
  <li>Income Verification: 3 most recent consecutive paystubs or <u>fully executed offer letter if starting a new position</u><ul><li>For self-employed applicants ONLY: 2 years of your most recent tax returns and a CPA letter. If you do not use a CPA, please upload your tax transcript for each return.</li></ul></li>
  <li>Landlord reference letter</li>
  <li>Pet photo (if applicable)</li>
</ul>
<em>*Security deposit (equivalent to one month&#39;s rent) and first month&#39;s rent are due upon lease signing.</em>`;

export const DEFAULT_UNAVAILABLE = `Thank you so much for reaching out! Unfortunately, <u>Unit #{unit} at {building}</u> is no longer available. However, I&#39;d love to share some great alternatives that may interest you — please see below:`;

// Shared Wi-Fi list bits used across welcome emails
const _WIFI_METRO = `<u><a href="https://www.example.com/metro-cable">Metro Cable</a></u> Ms. Carla Mendes <u><a href="mailto:carla.mendes@example.com">carla.mendes@example.com</a></u>, 929-555-0181`;
const _WIFI_BLUEWAVE = `<u>Bluewave Internet</u> Mr. Jonas Weber <u><a href="mailto:jonas.weber@example.com">jonas.weber@example.com</a></u>, 917-555-0182`;
const _WIFI_BRIGHTLINE_A = `<u><a href="https://www.example.com/brightline-fiber">Brightline Fiber</a></u> (1-800-555-0199) and get 2-months free with code LARK23`;
const _WIFI_BRIGHTLINE_B = `<u><a href="https://www.example.com/brightline-fiber">Brightline Fiber</a></u> (1-800-555-0199) and get 2-months free with code LARK24`;
const _CLUB_LINK = `<u><a href="https://residents.example.com">residents.example.com</a></u>: Mr. Martin Vale <u><a href="mailto:martin.vale@example.com">martin.vale@example.com</a></u>`;
const _BILLING = `<u><a href="mailto:billing@example.com">billing@example.com</a></u>`;
const _MOVES_NOTE = `Please note that due to the size of the building and the fact that we would like to accommodate all tenants as best as possible, it is common that multiple moves will take place on a given day, and that the freight elevator will be shared. As a result, please plan for longer wait times. As an alternative, you may choose to avoid weekends and Fridays as well as the first or last days of the month when scheduling your move.`;

export const DEFAULT_WELCOME = {
  '2040': {
    subject: 'Welcome to 2040!',
    coi: '2040 COI',
    body: `<p>Welcome to Larkspur Residential and 2040 Tidemark Boulevard!</p>
<p>Below you will find an overview of the FAQs. This information can also be found in your Welcome Packet.</p>
<ul>
<li>Unit inspection: we recommend no more than a few days before the lease begins. If you come before, your unit may not be vacant yet or you may see the unit in progress, including cleaning, painting, and the servicing of major appliances. You may visit the Leasing Office anytime during our Office Hours and you will be escorted to your Unit.</li>
<li>Key Pickup: from the Front Desk of your building anytime on the date confirmed with the Leasing Agents.</li>
<li>Packages: you may have small packages delivered no more than two days prior to your Lease Start Date.</li>
<li>Moving In/Elevator Reservation: you may reserve any day between 8am-8pm via the Larkspur resident app or call the Front Desk 718-555-0140.</li>
<li>Certificate of Insurance (COI) instructions have been included as an attachment if you are using Professional Movers. This is to be sent to your Building Manager as stated on the Instructions.</li>
<li>Cable and Wi-Fi:
<ul>
<li>${_WIFI_METRO}</li>
<li>${_WIFI_BLUEWAVE}</li>
<li>${_WIFI_BRIGHTLINE_A}</li>
</ul></li>
<li>Your Building Manager is Mr. Victor Lindqvist <u><a href="mailto:victor.lindqvist@example.com">victor.lindqvist@example.com</a></u></li>
<li>Your Leasing Specialist is Ms. Renee Okafor <u><a href="mailto:renee.okafor@example.com">renee.okafor@example.com</a></u>, (212) 555-0175</li>
<li>Accounts/Billing: ${_BILLING}</li>
<li>Club Reservations or Troubleshooting ${_CLUB_LINK}</li>
<li>Renters Insurance is required, please make sure you provide a copy of your new policy with the leasing agent.</li>
</ul>
<p>${_MOVES_NOTE}</p>
<p>Please let us know if you have any further questions, have a great day!</p>`
  },
  '2050': {
    subject: 'Welcome to 2050!',
    coi: '2050 COI',
    body: `<p>Welcome to Larkspur Residential and 2050 Tidemark Boulevard!</p>
<p>Below you will find an overview of the FAQs. This information can also be found in your Welcome Packet.</p>
<ul>
<li>Unit inspection: we recommend no more than a few days before the lease begins. If you come before, your unit may not be vacant yet or you may see the unit in progress, including cleaning, painting, and the servicing of major appliances. You may visit the Leasing Office anytime during our Office Hours and you will be escorted to your Unit.</li>
<li>Key Pickup: from the Front Desk of your building anytime on the date confirmed with the Leasing Agents.</li>
<li>Packages: you may have small packages delivered no more than two days prior to your Lease Start Date.</li>
<li>Moving In/Elevator Reservation: you may reserve any day between 8am-8pm via the Larkspur resident app or call the Front Desk 718-555-0150.</li>
<li>Certificate of Insurance (COI) instructions have been included as an attachment if you are using Professional Movers. This is to be sent to your Building Manager as stated on the Instructions.</li>
<li>Cable and Wi-Fi:
<ul>
<li>${_WIFI_METRO}</li>
<li>${_WIFI_BLUEWAVE}</li>
</ul></li>
<li>Your Building Manager is Mr. Samir Haddad <u><a href="mailto:samir.haddad@example.com">samir.haddad@example.com</a></u></li>
<li>Your Leasing Specialist is Ms. Renee Okafor <u><a href="mailto:renee.okafor@example.com">renee.okafor@example.com</a></u>, (212) 555-0175</li>
<li>Accounts/Billing: ${_BILLING}</li>
<li>Club Reservations or Troubleshooting ${_CLUB_LINK}</li>
<li>Renters Insurance is required, please make sure you provide a copy of your new policy with the leasing agent</li>
</ul>
<p>${_MOVES_NOTE}</p>
<p>Please let us know if you have any further questions, have a great day!</p>`
  },
  '2110': {
    subject: 'Welcome to 2110!',
    coi: '2110 COI',
    body: `<p>Welcome to Larkspur Residential and 2110 Tidemark Blvd!</p>
<p>Below you will find an overview of the FAQs. This information can also be found in your Welcome Packet.</p>
<ul>
<li>Unit inspection: we recommend no more than a few days before the lease begins. You may visit the Leasing Office anytime during our Office Hours and you will be escorted to your Unit.</li>
<li>Key Pickup: from the Front Desk of your building anytime on the date confirmed with the Leasing Agents.</li>
<li>Packages: you may have small packages delivered no more than two days prior to your Lease Start Date.</li>
<li>Moving In/Elevator Reservation: you may reserve any day between 8am-8pm via the Larkspur resident app or call the Front Desk (718) 555-0111.</li>
<li>Certificate of Insurance (COI) instructions have been included as an attachment if you are using Professional Movers. This is to be sent to your Building Manager as stated on the Instructions.</li>
<li>Cable and Wi-Fi:
<ul>
<li>${_WIFI_METRO}</li>
<li>${_WIFI_BLUEWAVE}</li>
<li>${_WIFI_BRIGHTLINE_A}</li>
</ul></li>
<li>Your Leasing Specialist is Ms. Helena Brandt <u><a href="mailto:helena.brandt@example.com">helena.brandt@example.com</a></u></li>
<li>Your Building Manager is Mr. Rafael Ortiz <u><a href="mailto:rafael.ortiz@example.com">rafael.ortiz@example.com</a></u></li>
<li>Accounts/Billing: ${_BILLING}</li>
<li>Club Reservations or Troubleshooting ${_CLUB_LINK}</li>
<li>Renters Insurance is required, please make sure you provide a copy of your new policy with the leasing agent</li>
</ul>
<p>${_MOVES_NOTE}</p>
<p>Please let us know if you have any further questions, have a great day!</p>`
  },
  '2120': {
    subject: 'Welcome to 2120!',
    coi: '2120 COI',
    body: `<p>Welcome to Larkspur Residential and 2120 Tidemark Blvd!</p>
<p>Below you will find an overview of the FAQs. This information can also be found in your Welcome Packet.</p>
<ul>
<li>Unit inspection: we recommend no more than a few days before the lease begins. You may visit the Leasing Office anytime during our Office Hours and you will be escorted to your Unit.</li>
<li>Key Pickup: from the Front Desk of your building anytime on the date confirmed with the Leasing Agents.</li>
<li>Packages: you may have small packages delivered no more than two days prior to your Lease Start Date.</li>
<li>Moving In/Elevator Reservation: you may reserve any day between 8am-8pm via the Larkspur resident app or call the Front Desk (718) 555-0120.</li>
<li>Certificate of Insurance (COI) instructions have been included as an attachment if you are using Professional Movers. This is to be sent to your Building Manager as stated on the Instructions.</li>
<li>Cable and Wi-Fi:
<ul>
<li>${_WIFI_METRO}</li>
<li>${_WIFI_BLUEWAVE}</li>
<li>${_WIFI_BRIGHTLINE_B}</li>
</ul></li>
<li>Your Building Manager is Mr. Gregory Tan <u><a href="mailto:gregory.tan@example.com">gregory.tan@example.com</a></u></li>
<li>Your Leasing Specialist is Ms. Renee Okafor <u><a href="mailto:renee.okafor@example.com">renee.okafor@example.com</a></u>, (212) 555-0175</li>
<li>Accounts/Billing: ${_BILLING}</li>
<li>Club Reservations or Troubleshooting ${_CLUB_LINK}</li>
<li>Renters Insurance is required, please make sure you provide a copy of your new policy with the leasing agent</li>
</ul>
<p>${_MOVES_NOTE}</p>
<p>Please let us know if you have any further questions!</p>`
  },
  '2230': {
    subject: 'Welcome to 2230!',
    coi: '2230 COI',
    body: `<p>Welcome to Larkspur Residential and 2230 Tidemark Boulevard!</p>
<p>Below you will find an overview of the FAQs. This information can also be found in your Welcome Packet.</p>
<ul>
<li>Unit inspection: we recommend no more than a few days before the lease begins. If before, you may see the unit in process of being prepared, including painting, the servicing of major appliances, and cleaning. You may visit the Leasing Office anytime during our Office Hours and you will be escorted to your Unit.</li>
<li>Key Pickup: from the Front Desk of your building anytime on the date confirmed with the Leasing Agents.</li>
<li>Packages: you may have small packages delivered no more than two days prior to your Lease Start Date.</li>
<li>Moving In/Elevator Reservation: you may reserve any day between 8am-8pm via the Larkspur resident app or call the Front Desk 718-555-0123.</li>
<li>Certificate of Insurance (COI) instructions have been included as an attachment if you are using Professional Movers. This is to be sent to your Building Manager as stated on the Instructions.</li>
<li>Cable and Wi-Fi:
<ul>
<li>${_WIFI_METRO}</li>
<li>${_WIFI_BLUEWAVE}</li>
<li><u><a href="https://www.example.com/citywide-fiber">Citywide Fiber</a></u> <em>*ONLY for 2230*</em></li>
</ul></li>
<li>Your Building Manager is Mr. Pavel Novak <u><a href="mailto:pavel.novak@example.com">pavel.novak@example.com</a></u></li>
<li>Your Leasing Specialist is Ms. Helena Brandt <u><a href="mailto:helena.brandt@example.com">helena.brandt@example.com</a></u></li>
<li>Accounts/Billing: ${_BILLING}</li>
<li>Club Reservations or Troubleshooting ${_CLUB_LINK}</li>
<li>Renters Insurance is required, please make sure you provide a copy of your new policy with the leasing agent</li>
</ul>
<p><strong>Note:</strong> your Larkspur resident account will be active with your ID Number on the date your Lease Begins. ${_MOVES_NOTE}</p>
<p><em>*ONLY FOR 2230 Tidemark Boulevard: you must Register for your Electricity Service with <u><a href="https://www.coned.com/en/register/pre-register">Con Ed</a></u>*</em></p>
<p>Please let us know if you have any questions and have a great day!</p>`
  }
};

const DEFAULT_PFA_OPENING = `Thank you for your interest in renting one of our lounges! Below you will find the rental details and the information we&#39;ll need from you to proceed.`;

const DEFAULT_PFA_BODY = `<p><strong><u>2050 Lounge</u></strong> <em>(must be already registered as a Club 2050 member)</em></p>
<ul>
<li>The lounge is available Monday through Thursday**</li>
<li>Times: 10AM &ndash; 10PM</li>
<li>Deposit: $400.00 <em>*refundable if no damages</em></li>
<li>Rent: $180.00/hr</li>
<li>Hours: 2 hours min, 4 hours max <em>(select weekends only &mdash; no holidays)</em></li>
</ul>
<p><em>**Please note the lounge will be available to rent only on the 2nd and 4th weekend of the month. On all other weekends (1st, 3rd, and 5th, when applicable), no reservations will be permitted, and the lounge must remain open and accessible to all members.</em></p>
<p><strong><u>2230 Lounge</u></strong></p>
<ul>
<li>The lounge is available Monday through Thursday**</li>
<li>Times: 10AM &ndash; 10PM</li>
<li>Deposit: $400.00 <em>*refundable if no damages</em></li>
<li>Rent: $120.00/hr</li>
<li>Hours: 2 hours min, 4 hours max <em>(select weekends only &mdash; no holidays)</em></li>
</ul>
<p><em>**Please note the lounge will be available to rent only on the 2nd and 4th weekend of the month. On all other weekends (1st, 3rd, and 5th, when applicable), no reservations will be permitted, and the lounge must remain open and accessible to all members.</em></p>
<p><strong>To proceed with the rental process, we need the following information:</strong></p>
<ul>
<li>Your name and unit number:</li>
<li>Date of the function:</li>
<li>Timeframe:</li>
<li>List of tenants:</li>
<li>Occasion of event:</li>
</ul>
<p><strong>All checks should be made out to Larkspur Residential, Inc.</strong></p>
<p>Club 2050 members may rent the lounge at <strong>2050 Tidemark Blvd</strong> for private functions through the Leasing Office on the 2nd and 4th weekends of each month. Requests for events must be submitted in advance and approved through the Leasing office, by emailing <u><a href="mailto:leasing@example.com">leasing@example.com</a></u>, calling (718) 555-0100, or visiting the Leasing office at 2050 Tidemark Boulevard.</p>
<p>You may also reserve the lounge at <strong>2230 Tidemark Boulevard</strong> for private functions through the Leasing Office on the 2nd and 4th weekends of each month. Requests for events must be submitted in advance and approved through the Leasing office by emailing <u><a href="mailto:leasing@example.com">leasing@example.com</a></u>, calling (718) 555-0100, or visiting the Leasing office at 2050 Tidemark Boulevard.</p>
<p>On all other weekends (1st, 3rd, and 5th, when applicable), no reservations will be permitted, and the lounge must remain open and accessible to all members.</p>
<p><strong>Please note the following guidelines for non-reservable weekends:</strong></p>
<ul>
<li>The space may only be used for casual gatherings by members and their guests.</li>
<li>The guest policy (maximum of two guests per member) must be followed.</li>
<li>Decorations are prohibited.</li>
<li>The lounge must remain open to all members at all times.</li>
</ul>
<p>Staff will be monitoring lounge use on these weekends to ensure compliance. Unless the lounge has been officially reserved for a private event, it is intended to remain a shared, casual space for all members and permitted guests.</p>
<p>Please let us know how you would like to proceed, and if you have any further questions.</p>`;

// Signed-agreement follow-up (Step 2). Placeholders filled at render time:
//   {lounge} → "2050 Tidemark Blvd" | "2230 Tidemark Blvd"
//   {deposit} / {rent} → dollar amounts (formatted, no $ sign)
//   {signedDate} / {dueDate} → long-form dates (due = signed + 7 days)
export const DEFAULT_PFA_SIGNED_OPENING = `Thank you for returning your signed Private Function Agreement for the <strong>{lounge}</strong> lounge! To finalize your reservation, the payments below are due <strong>within 7 days of signing the agreement</strong> &mdash; that is, <strong>by {dueDate}</strong>.`;

export const DEFAULT_PFA_SIGNED_BODY = `<p><strong><u>Payments Due</u></strong></p>
<ul>
<li>Security Deposit: <strong>\${deposit}</strong> <em>*refundable if no damages</em></li>
<li>Rental Fee: <strong>\${rent}</strong></li>
</ul>
<p>All checks should be made out to <strong>Larkspur Residential, Inc.</strong> and can be dropped off at the Leasing Office at 2050 Tidemark Boulevard (Monday through Friday). Please provide separate checks for the security deposit and the rental fee, as the deposit is returned to you after the event.</p>
<p>Please note that your reservation is not confirmed until both checks have been received. If payment is not received within the 7-day window, the date may be released and made available to other members.</p>
<p>Please let us know once the checks are ready, and feel free to reach out with any questions.</p>`;

export let templates = {
  tour: {
    opening: 'Thank you for touring with us today, it was great meeting you!',
    requirements: DEFAULT_REQUIREMENTS,
    applyText: 'To apply: https://apply.example.com/',
    applyUrl: 'https://apply.example.com/',
    closing: 'If you have any further questions, please feel free to reach out to us!',
    signature: '',
    showRequirements: true,
    showApplyLink: true
  },
  inquiry: {
    opening: 'Thank you for your interest in Larkspur Residential, I hope you are doing well!',   // the unit sentence follows on its own
    requirements: DEFAULT_REQUIREMENTS,
    applyText: 'To apply: https://apply.example.com/',
    applyUrl: 'https://apply.example.com/',
    closing: 'To learn more about our current availability, we invite you to visit our leasing office at <u>2050 Tidemark Blvd</u>, open daily from <strong>10 AM to 6 PM</strong>. Our team would be happy to assist you in finding the perfect apartment.<br><br>To schedule an appointment, please let me know what date &amp; time works best for you and I will gladly schedule you in.<br><br>Please let us know if you have any further questions, have a great day!',
    signature: '',
    showRequirements: false,
    showApplyLink: false
  },
  unavailable: DEFAULT_UNAVAILABLE,
  welcome: JSON.parse(JSON.stringify(DEFAULT_WELCOME)),
  welcomeSignature: 'Best,',
  pfa: {
    opening: DEFAULT_PFA_OPENING,
    body: DEFAULT_PFA_BODY,
    signedOpening: DEFAULT_PFA_SIGNED_OPENING,
    signedBody: DEFAULT_PFA_SIGNED_BODY,
    signature: 'Have a great day!'
  },
  parking: DEFAULT_PARKING_HTML,
  shuttle: DEFAULT_SHUTTLE_HTML
};
export function saveTpl() { localStorage.setItem('ld_templates', JSON.stringify(templates)); }
