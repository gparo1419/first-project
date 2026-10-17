// Vercel serverless function: receives lead form submissions at POST /api/lead.
// For now it validates the lead and writes it to the Vercel function logs.
// Next step: forward it to a CRM, email inbox, or database.
module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  // Honeypot filled in means it's almost certainly a bot; pretend it worked
  if (body.company) return res.status(200).json({ ok: true });

  const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);
  const lead = {
    firstName: clean(body.firstName),
    lastName: clean(body.lastName),
    phone: clean(body.phone, 40),
    email: clean(body.email),
    when: clean(body.when),
    details: clean(body.details, 1000),
    consent: body.consent === true,
    tracking: typeof body.tracking === 'object' && body.tracking ? body.tracking : {},
    page: clean(body.page),
    receivedAt: new Date().toISOString(),
  };

  const errors = [];
  if (!lead.firstName || !lead.lastName) errors.push('name');
  if (lead.phone.replace(/\D/g, '').length < 10) errors.push('phone');
  if (!/^\S+@\S+\.\S+$/.test(lead.email)) errors.push('email');
  if (!lead.consent) errors.push('consent');
  if (errors.length) return res.status(400).json({ error: 'Invalid fields', fields: errors });

  console.log('NEW LEAD', JSON.stringify(lead));
  return res.status(200).json({ ok: true });
};
