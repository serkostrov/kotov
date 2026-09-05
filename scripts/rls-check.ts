import 'dotenv/config'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types.ts'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const password = process.env.DEMO_PASSWORD

if (!url || !anon || !password) {
  throw new Error('Нужны SUPABASE_URL, VITE_SUPABASE_ANON_KEY и DEMO_PASSWORD')
}

function client() {
  return createClient<Database>(url, anon, { auth: { persistSession: false } })
}

async function asUser(email: string) {
  const c = client()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message)
}

async function main() {
  const anonClient = client()
  const { data: anonObjects, error: anonError } = await anonClient.from('objects').select('id')
  assert(!anonError && (anonObjects?.length ?? 0) === 0, 'anon не должен видеть строки objects')

  const { data: anonTools } = await anonClient.from('tools').select('id')
  assert((anonTools?.length ?? 0) === 0, 'anon не должен видеть tools')

  const prod = await asUser('prod@kotov.local')
  const owner = await asUser('owner@kotov.local')
  const accountant = await asUser('docs@kotov.local')

  const { data: ownerObjects } = await owner.from('objects').select('id').is('deleted_at', null)
  const foreign = (ownerObjects ?? []).map((o) => o.id)

  const { data: prodObjects } = await prod.from('objects').select('id, contract_amount').is('deleted_at', null)
  const prodIds = new Set((prodObjects ?? []).map((o) => o.id))
  const unseen = foreign.filter((id) => !prodIds.has(id))
  if (unseen.length) {
    const { data: leaked } = await prod.from('objects').select('id').eq('id', unseen[0]!)
    assert((leaked?.length ?? 0) === 0, 'бригадир видит чужой объект')
  }

  const { data: eco } = await prod.from('v_object_economics').select('*')
  assert((eco?.length ?? 0) === 0, 'бригадир не должен читать v_object_economics')

  const own = prodObjects?.[0]
  if (own) {
    const before = Number(own.contract_amount)
    const { error } = await prod.from('objects').update({ contract_amount: before + 1 }).eq('id', own.id)
    const { data: after } = await prod.from('objects').select('contract_amount').eq('id', own.id).maybeSingle()
    // PostgREST often returns no error on RLS-denied UPDATE (0 rows); verify value unchanged.
    assert(error || Number(after?.contract_amount) === before, 'бригадир не должен менять сумму договора')
  }

  const { data: aTool } = await prod.from('tools').select('id').limit(1).maybeSingle()
  if (aTool) {
    const { error } = await prod.from('tool_movements').insert({
      tool_id: aTool.id,
      movement_type: 'issue',
    })
    assert(error, 'бригадир не должен вставлять tool_movements напрямую')
  }

  const { data: stage } = await accountant.from('object_stages').select('id').limit(1)
  const { error: stageInsert } = await accountant.from('object_stages').insert({
    object_id: foreign[0] ?? '00000000-0000-0000-0000-000000000000',
    stage_type: 'production',
    name: 'нельзя',
  })
  assert(stageInsert, 'бухгалтер не должен создавать этап')
  if (stage?.[0]) {
    const { error: stageUpdate } = await accountant
      .from('object_stages')
      .update({ progress_percent: 1 })
      .eq('id', stage[0].id)
    assert(stageUpdate, 'бухгалтер не должен менять этап')
  }

  console.info('RLS checks passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
