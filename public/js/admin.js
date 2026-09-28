'use strict';
const $ = id => document.getElementById(id);
let csrfToken = '', currentPage = 1, selectedId = null;
let filters = new URLSearchParams({ sort: 'newest' });
let listRequest = 0;
function status(message, isError = false) { $('adminStatus').textContent = message; $('adminStatus').dataset.state = isError ? 'error' : 'success'; }
function showLogin() {
  listRequest++;
  csrfToken = ''; $('loginPanel').hidden = false; $('dashboard').hidden = true; $('logout').hidden = true;
  $('registrationList').replaceChildren(); $('detailContent').replaceChildren(); $('detailDialog').close(); selectedId = null;
}
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.method === 'DELETE' ? {'X-CSRF-Token':csrfToken} : {}), ...options.headers } });
  if (response.status === 401) showLogin();
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || 'The request could not be completed. Please try again.');
  }
  return response;
}
function textElement(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if(className) el.className = className; return el; }
async function loadRegistrations() {
  const request = ++listRequest;
  status('Loading registrations…');
  const query = new URLSearchParams(filters); query.set('page',currentPage); query.set('limit',25);
  const data = await (await api(`/api/admin/registrations?${query}`)).json();
  if(request !== listRequest) return;
  $('registrationList').replaceChildren();
  for(const record of data.registrations) {
    const card = document.createElement('article'); card.className = 'registration-card';
    card.append(textElement('p',record.registrationId,'record-id'),textElement('h3',record.name),textElement('p',`${record.mobile} · ${record.email}`),textElement('p',`${record.visitorType} · ${record.purpose}`),textElement('p',new Date(record.createdAt).toLocaleString()));
    const button = textElement('button','View details','btn secondary'); button.type = 'button'; button.setAttribute('aria-label',`View details for ${record.name}`);
    button.addEventListener('click',()=>openDetails(record.id).catch(handleError)); card.append(button); $('registrationList').append(card);
  }
  if(!data.registrations.length) $('registrationList').append(textElement('p','No registrations match these filters.'));
  $('resultCount').textContent = `${data.total} registration${data.total === 1 ? '' : 's'}`;
  $('pageInfo').textContent = `Page ${currentPage} of ${Math.max(1,Math.ceil(data.total/data.limit))}`;
  $('previousPage').disabled = currentPage === 1;
  $('nextPage').disabled = currentPage * data.limit >= data.total;
  status('Registrations loaded.');
}
function handleError(error) { status(error instanceof TypeError ? 'Unable to reach the server. Please try again.' : error.message,true); }
async function openDetails(id) {
  const data = await (await api(`/api/admin/registrations/${id}`)).json();
  if (!csrfToken) return;
  selectedId = id; $('detailContent').replaceChildren();
  for(const [field,label] of Object.entries({registrationId:'Registration ID',name:'Name',mobile:'Mobile',email:'Email',visitorType:'Visitor type',college:'College',purpose:'Purpose',reference:'Reference',message:'Message',createdAt:'Registered'})) {
    const p = document.createElement('p');
    p.append(textElement('strong',`${label}:`),textElement('span',field === 'createdAt' ? new Date(data.registration[field]).toLocaleString() : data.registration[field] || '—'));
    $('detailContent').append(p);
  }
  $('detailDialog').showModal();
}
$('loginForm').addEventListener('submit',async event=>{
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try {
    const result = await (await api('/api/admin/login',{method:'POST',body:JSON.stringify({username:$('username').value,password:$('password').value})})).json();
    csrfToken = result.csrfToken; $('password').value = '';
    $('loginPanel').hidden = true; $('dashboard').hidden = false; $('logout').hidden = false; currentPage = 1;
    await loadRegistrations();
  } catch(error) { handleError(error); } finally { button.disabled = false; }
});
$('filterForm').addEventListener('submit',event=>{ event.preventDefault(); filters = new URLSearchParams(new FormData(event.target)); currentPage = 1; loadRegistrations().catch(handleError); });
$('previousPage').addEventListener('click',()=>{if(currentPage>1){currentPage--;loadRegistrations().catch(handleError);}});
$('nextPage').addEventListener('click',()=>{currentPage++;loadRegistrations().catch(handleError);});
$('logout').addEventListener('click',async()=>{try{await api('/api/admin/session',{method:'DELETE'});showLogin();status('Signed out.');}catch(error){handleError(error);}});
$('closeDetails').addEventListener('click',()=>$('detailDialog').close());
$('deleteRegistration').addEventListener('click',async()=>{
  if(!selectedId || !confirm('Permanently delete this visitor registration? This cannot be undone.'))return;
  $('deleteRegistration').disabled = true;
  try{await api(`/api/admin/registrations/${selectedId}`,{method:'DELETE'});$('detailDialog').close();currentPage=1;await loadRegistrations();status('Registration deleted.');}catch(error){$('detailDialog').close();handleError(error);}finally{$('deleteRegistration').disabled=false;}
});
$('exportCsv').addEventListener('click',async()=>{
  $('exportCsv').disabled=true;
  try{
    const response=await api(`/api/admin/registrations/export.csv?${filters}`);
    const url=URL.createObjectURL(await response.blob()); const link=document.createElement('a');link.href=url;link.download='creative-carnival-registrations.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('CSV export downloaded. Keep visitor information private.');
  }catch(error){handleError(error);}finally{$('exportCsv').disabled=false;}
});
(async()=>{
  try{
    const response=await fetch('/api/admin/session',{credentials:'same-origin'});
    if(response.status===401)return;
    if(!response.ok)throw new Error('Administrator service is unavailable.');
    const result=await response.json();csrfToken=result.csrfToken;
    $('loginPanel').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;await loadRegistrations();
  }catch(error){handleError(error);}
})();
