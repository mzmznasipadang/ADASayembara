// Supabase Edge Function: verify-admin
// Deploy this function to your Supabase project and set the
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the function's env.
// The function accepts POST { username, password } and returns { ok: true, id }
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'https://esm.sh/bcryptjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { global: { fetch } });

serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const body = await req.json();
    const username = (body.username || '').toString();
    const password = (body.password || '').toString();
    if (!username || !password) return new Response(JSON.stringify({ ok: false, error: 'missing' }), { status: 400 });

    const { data, error } = await supabase.from('admin_users').select('id, password_hash').eq('username', username).limit(1).maybeSingle();
    if (error) {
      console.error('db error', error);
      return new Response(JSON.stringify({ ok: false, error: 'db' }), { status: 500 });
    }

    if (!data) return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 401 });

    const matches = bcrypt.compareSync(password, data.password_hash || '');
    if (!matches) return new Response(JSON.stringify({ ok: false, error: 'invalid' }), { status: 401 });

    // success
    return new Response(JSON.stringify({ ok: true, id: data.id }), { status: 200 });
  } catch (e) {
    console.error('error', e);
    return new Response(JSON.stringify({ ok: false, error: 'exception' }), { status: 500 });
  }
});
