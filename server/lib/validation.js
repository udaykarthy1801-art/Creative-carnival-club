const isEmail = require('validator/lib/isEmail');
const visitorTypes = ['Student 11th', 'Student 12th', 'College Student', 'Worker / Job', 'General Visitor'];
const purposes = ['Event Visit', 'Project Exhibition', 'Innovation', 'General Visitor'];
function validateRegistration(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: { form: 'Provide a JSON object.' } };
  const errors = {}, data = {};
  const limits = { fullName: [2,120,'Full name'], mobile: [10,10,'Mobile number'], email: [3,254,'Email'], visitorType: [1,30,'Visitor type'], college: [2,200,'College / Organization'], purpose: [1,30,'Visit purpose'], reference: [1,200,'Reference'], message: [0,2000,'Message'] };
  for (const [key,[min,max,label]] of Object.entries(limits)) {
    const raw = body[key] ?? (key === 'message' ? '' : undefined);
    if (typeof raw !== 'string') { errors[key] = `${label} must be text.`; continue; }
    const value = raw.trim(); data[key] = value;
    if (value.length < min) errors[key] = value.length ? `${label} must have at least ${min} characters.` : `${label} is required.`;
    else if (value.length > max) errors[key] = `${label} must have at most ${max} characters.`;
    else if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || (key !== 'message' && /[\r\n\t]/.test(value))) errors[key] = `${label} contains invalid control characters.`;
  }
  if (typeof data.mobile === 'string' && !/^[0-9]{10}$/.test(data.mobile)) errors.mobile = 'Enter a mobile number containing exactly 10 digits.';
  if (typeof data.email === 'string') {
    data.email = data.email.toLowerCase();
    if (!isEmail(data.email, { allow_utf8_local_part: false, require_tld: true, allow_ip_domain: false }) || /[^\x00-\x7f]/.test(data.email)) errors.email = 'Enter a valid email address.';
  }
  if (!visitorTypes.includes(data.visitorType)) errors.visitorType = 'Select a valid visitor type.';
  if (!purposes.includes(data.purpose)) errors.purpose = 'Select a valid visit purpose.';
  return { data, errors };
}
function registrationView(row) {
  return { registrationId: row.registration_id, name: row.full_name, mobile: row.mobile, email: row.email, visitorType: row.visitor_type, college: row.college_organization, purpose: row.purpose, reference: row.reference, message: row.message, createdAt: row.created_at };
}
function registrationIdValid(id) { return /^CCMD-2026-\d{6,10}$/.test(id); }
module.exports = { validateRegistration, registrationView, registrationIdValid, visitorTypes, purposes };
