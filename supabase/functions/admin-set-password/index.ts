import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Body = {
  user_id: string
  password: string
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Нет сессии' }, 401)

    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await caller.auth.getUser()
    if (!user) return json({ error: 'Нет сессии' }, 401)

    const admin = createClient(url, serviceKey)
    const { data: ownerRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .maybeSingle()
    if (!ownerRow) return json({ error: 'Недостаточно прав' }, 403)

    const body = (await req.json()) as Body
    if (!body.user_id) return json({ error: 'Не указан пользователь' }, 400)
    if (!body.password || body.password.length < 8) {
      return json({ error: 'Пароль не короче 8 символов' }, 400)
    }

    const { error } = await admin.auth.admin.updateUserById(body.user_id, {
      password: body.password,
    })
    if (error) throw error

    return json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось сменить пароль'
    return json({ error: message }, 400)
  }
})
