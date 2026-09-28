const { visitorTypes, purposes } = require('./validation');
function filters(query) {
  const clauses = [], values = [];
  const q = query.q ?? '';
  if (typeof q !== 'string' || q.length > 120) throw Object.assign(new Error('Search must be at most 120 characters.'), { status: 400 });
  if (q.trim()) {
    const term = `%${q.trim().replace(/[!%_]/g, '!$&')}%`;
    clauses.push("(full_name LIKE ? ESCAPE '!' OR mobile LIKE ? ESCAPE '!' OR registration_id LIKE ? ESCAPE '!')");
    values.push(term,term,term);
  }
  for (const [key,column,allowed] of [['visitorType','visitor_type',visitorTypes],['purpose','purpose',purposes]]) {
    if (query[key] !== undefined && query[key] !== '') {
      if (!allowed.includes(query[key])) throw Object.assign(new Error(`Invalid ${key} filter.`), { status: 400 });
      clauses.push(`${column} = ?`); values.push(query[key]); // column is a fixed allowlisted identifier.
    }
  }
  if (query.sort && !['newest','oldest'].includes(query.sort)) throw Object.assign(new Error('Invalid sort order.'), { status: 400 });
  return { where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', values, order: query.sort === 'oldest' ? 'ASC' : 'DESC' };
}
function positiveInteger(value, fallback, max) {
  const raw = value ?? String(fallback);
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || Number(raw) > max) throw Object.assign(new Error('Invalid page, limit, or record ID.'), { status: 400 });
  return Number(raw);
}
function csvCell(value) {
  let text = String(value ?? '');
  // Prevent spreadsheet formula execution, including leading whitespace tricks.
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}
module.exports = { filters, positiveInteger, csvCell };
