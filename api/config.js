module.exports = function config(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';
  let safe = key.startsWith('sb_publishable_');
  try { safe ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch {}
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && safe;
  res.status(200).json({ configured, url: configured ? url : '', key: configured ? key : '' });
};
