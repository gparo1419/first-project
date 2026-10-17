// Vercel serverless function: receives lead form submissions at POST /api/lead.
// Validates the lead and saves it to the Supabase "leads" table.
module.exports = async (req, res) => {
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

  // Secret key bypasses row level security, so this must only ever run server-side
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error('Supabase env vars missing; lead only logged');
    return res.status(500).json({ error: 'Server not configured' });
  }

  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      first_name: lead.firstName,
      last_name: lead.lastName,
      phone: lead.phone,
      email: lead.email,
      accident_when: lead.when,
      details: lead.details,
      consent: lead.consent,
      tracking: lead.tracking,
      page: lead.page,
      created_at: lead.receivedAt,
    }),
  });

  if (!dbRes.ok) {
    console.error('Supabase insert failed', dbRes.status, await dbRes.text());
    return res.status(502).json({ error: 'Could not save lead' });
  }

  return res.status(200).json({ ok: true });
};
