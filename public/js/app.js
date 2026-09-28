'use strict';
const form = document.getElementById('visitorForm');
const submitButton = form.querySelector('button[type="submit"]');
const statusMessage = document.getElementById('registrationStatus');
const confirmation = document.getElementById('confirmation');
const fieldIds = { fullName: 'name', mobile: 'mobile', email: 'email', visitorType: 'visitorType', college: 'college', purpose: 'purpose', reference: 'reference', message: 'message' };
const defaultButtonText = submitButton.textContent.trim();
let submitting = false;
form.addEventListener('input', event => event.target.removeAttribute('aria-invalid'));
function announce(message, state) {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || !form.reportValidity()) return;
  submitting = true;
  submitButton.disabled = true;
  submitButton.textContent = 'Registering...';
  form.setAttribute('aria-busy','true');
  confirmation.hidden = true;
  for (const id of Object.values(fieldIds)) document.getElementById(id).removeAttribute('aria-invalid');
  announce('Saving your registration…','loading');
  const payload = Object.fromEntries(Object.entries(fieldIds).map(([key,id]) => [key,document.getElementById(id).value.trim()]));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('/api/registrations', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    const result = await response.json();
    if (!response.ok || result.success !== true) {
      const error = new Error(result.message || 'Unable to complete registration right now. Please try again.');
      error.fields = result.errors; throw error;
    }
    if (!/^CCMD-2026-\d{6,10}$/.test(result.registrationId) || !result.visitor || typeof result.visitor !== 'object') throw new Error('The server returned an incomplete confirmation. Please contact the event organizer before trying again.');
    document.getElementById('showRegistrationId').textContent = result.registrationId;
    for (const [key,id] of Object.entries({ name:'showName', mobile:'showMobile', email:'showEmail', visitorType:'showVisitorType', college:'showCollege', purpose:'showPurpose', reference:'showReference', message:'showMessage' })) document.getElementById(id).textContent = result.visitor[key] || '—';
    announce(`Registration saved. Your registration ID is ${result.registrationId}.`,'success');
    confirmation.hidden = false;
    confirmation.classList.add('confirmed');
    document.getElementById('confirmation-heading').focus({ preventScroll: true });
    confirmation.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  } catch (error) {
    confirmation.hidden = true;
    const message = error.name === 'AbortError' ? 'The request timed out and we could not confirm registration. Please try again; if it already exists, contact the event organizer.' : error instanceof TypeError || error instanceof SyntaxError ? 'Unable to complete registration right now. Please try again.' : error.message;
    announce(message,'error');
    const firstField = Object.keys(error.fields || {}).find(key => fieldIds[key]);
    for (const key of Object.keys(error.fields || {})) if (fieldIds[key]) document.getElementById(fieldIds[key]).setAttribute('aria-invalid','true');
    if (firstField) document.getElementById(fieldIds[firstField]).focus();
    else statusMessage.focus();
  } finally {
    clearTimeout(timeout); submitting = false;
    submitButton.disabled = false;
    submitButton.textContent = defaultButtonText;
    form.removeAttribute('aria-busy');
  }
});
document.getElementById('printRegistration').addEventListener('click', () => window.print());
