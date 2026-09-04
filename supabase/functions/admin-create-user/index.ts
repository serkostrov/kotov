import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Body = {
  email: string
  full_name: string
  phone?: string
  position?: string
  password?: string
  roles?: string[]
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
    if (!body.email || !body.full_name) return json({ error: 'Укажите email и ФИО' }, 400)

    const generated = `${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}Aa1`
    const password = body.password && body.password.length >= 8 ? body.password : generated

    const { data: created, error } = await admin.auth.admin.createUser({
      email: body.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name, phone: body.phone ?? '' },
    })
    if (error || !created.user) throw error ?? new Error('Не удалось создать пользователя')

    const { error: profileError } = await admin
      .from('profiles')
      .update({
        full_name: body.full_name,
        phone: body.phone ?? null,
        position: body.position ?? null,
      })
      .eq('id', created.user.id)
    if (profileError) throw profileError

    for (const role of body.roles ?? []) {
      const { error: roleError } = await admin.from('user_roles').insert({
        user_id: created.user.id,
        role,
      })
      if (roleError) throw roleError
    }

    return json({
      id: created.user.id,
      password: body.password ? undefined : password,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка создания пользователя'
    return json({ error: message }, 400)
  }
})
