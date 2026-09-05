import 'dotenv/config'

import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types.ts'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

/** Tiny local stubs — no network. */
function ensureFixtures() {
  mkdirSync(fixturesDir, { recursive: true })
  const pngPath = join(fixturesDir, 'demo-photo.png')
  const pdfPath = join(fixturesDir, 'demo-doc.pdf')
  if (!existsSync(pngPath)) {
    writeFileSync(
      pngPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    )
  }
  if (!existsSync(pdfPath)) {
    writeFileSync(
      pdfPath,
      Buffer.from(
        '%PDF-1.1\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>endobj\nxref\n0 4\ntrailer<< /Root 1 0 R >>\n%%EOF\n',
      ),
    )
  }
  return {
    png: readFileSync(pngPath),
    pdf: readFileSync(pdfPath),
  }
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const password = process.env.DEMO_PASSWORD

if (!url || !service || !anonKey || !password) {
  throw new Error('Нужны SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY и DEMO_PASSWORD')
}

const admin = createClient<Database>(url, service, { auth: { persistSession: false } })
const ownerClient = createClient<Database>(url, anonKey, { auth: { persistSession: false } })

const users = [
  { email: 'owner@kotov.local', full_name: 'Сергей Дмитриевич', position: 'Руководитель', role: 'owner' as const },
  { email: 'prod@kotov.local', full_name: 'Иванов Пётр Николаевич', position: 'Бригадир производства', role: 'prod_foreman' as const },
  { email: 'install@kotov.local', full_name: 'Смирнов Алексей Викторович', position: 'Бригадир монтажа', role: 'install_foreman' as const },
  { email: 'docs@kotov.local', full_name: 'Кузнецова Мария Игоревна', position: 'Документы', role: 'accountant' as const },
]

async function upsertUser(row: (typeof users)[number]) {
  const { data, error } = await admin.auth.admin.createUser({
    email: row.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: row.full_name },
  })
  if (error && !error.message.toLowerCase().includes('already')) throw error
  const user =
    data.user ??
    (await admin.auth.admin.listUsers()).data.users.find((u) => u.email === row.email)
  if (!user) throw new Error(`Нет пользователя ${row.email}`)
  await admin.from('profiles').update({ full_name: row.full_name, position: row.position, is_active: true }).eq('id', user.id)
  await admin.from('user_roles').upsert({ user_id: user.id, role: row.role }, { onConflict: 'user_id,role' })
  return user.id
}

async function main() {
  const ids = {
    owner: await upsertUser(users[0]!),
    prod: await upsertUser(users[1]!),
    install: await upsertUser(users[2]!),
    accountant: await upsertUser(users[3]!),
  }

  const { error: signError } = await ownerClient.auth.signInWithPassword({
    email: 'owner@kotov.local',
    password,
  })
  if (signError) throw signError

  await admin.from('organization_profile').update({ name: 'Теплый контур' }).neq('name', '')

  const { data: expenseCats } = await admin.from('expense_categories').select('id, name')
  const { data: toolCats } = await admin.from('tool_categories').select('id, name')
  const { data: templates } = await admin.from('stage_templates').select('*').eq('is_active', true)
  if (!expenseCats?.length || !toolCats?.length || !templates?.length) {
    throw new Error('Сначала примените миграции со справочниками')
  }

  const cat = (name: string) => expenseCats.find((c) => c.name === name)?.id ?? expenseCats[0]!.id
  const tcat = (i: number) => toolCats[i % toolCats.length]!.id

  const nowIso = new Date().toISOString()
  await admin.from('attachments').update({ deleted_at: nowIso }).is('deleted_at', null)
  await admin.from('expenses').update({ deleted_at: nowIso }).is('deleted_at', null)
  await admin.from('material_requests').update({ deleted_at: nowIso }).is('deleted_at', null)
  await admin.from('tools').update({ deleted_at: nowIso }).is('deleted_at', null)
  await admin.from('objects').update({ deleted_at: nowIso }).is('deleted_at', null)

  const objectsSeed = [
    { name: 'Цех «Сормово»', address: 'г. Нижний Новгород, ул. Коминтерна, 166', customer_name: 'ООО «Волга-Сталь»', status: 'new' as const, contract_amount: 3_200_000, date_plan_end: '2026-11-20' },
    { name: 'Складской комплекс Автозавод', address: 'г. Нижний Новгород, пр. Ленина, 93', customer_name: 'АО «ГАЗ»', status: 'in_production' as const, contract_amount: 7_450_000, date_plan_end: '2026-10-05' },
    { name: 'Ангар Дзержинск', address: 'г. Дзержинск, Восточный промрайон, 12', customer_name: 'ООО «Химмаш»', status: 'in_production' as const, contract_amount: 5_800_000, date_plan_end: '2026-09-15' },
    { name: 'Торговый павильон Щербинки', address: 'г. Нижний Новгород, ул. Родионова, 190', customer_name: 'ИП Белов', status: 'in_installation' as const, contract_amount: 4_150_000, date_plan_end: '2026-09-01' },
    { name: 'Навес на базе в Кстово', address: 'г. Кстово, ул. Магистральная, 7', customer_name: 'ООО «НН-Логистик»', status: 'completed' as const, contract_amount: 3_900_000, date_plan_end: '2026-06-30', date_fact_end: '2026-06-28' },
  ]

  const objectIds: string[] = []
  for (const row of objectsSeed) {
    const { data, error } = await admin
      .from('objects')
      .insert({
        ...row,
        customer_contact: '+7 831 000-00-00',
        date_start: '2026-06-01',
        responsible_id: ids.owner,
        created_by: ids.owner,
      })
      .select('id')
      .single()
    if (error) throw error
    objectIds.push(data.id)
    await admin.from('object_members').insert([
      { object_id: data.id, user_id: ids.prod },
      { object_id: data.id, user_id: ids.install },
    ])
  }

  const activeIds = objectIds.slice(0, 4)
  for (const objectId of activeIds) {
    const prod = templates.filter((t) => t.stage_type === 'production').slice(0, 6)
    const inst = templates.filter((t) => t.stage_type === 'installation')
    const stages = [
      ...prod.map((t, i) => ({
        object_id: objectId,
        stage_type: 'production' as const,
        template_id: t.id,
        name: t.name,
        unit: t.unit,
        sort_order: t.sort_order,
        status: i === 0 ? ('done' as const) : i === 1 ? ('in_progress' as const) : ('not_started' as const),
        progress_percent: i === 0 ? 100 : i === 1 ? 45 : 0,
        date_plan_end: i === 2 ? '2026-08-20' : '2026-10-30',
        responsible_id: ids.prod,
        created_by: ids.owner,
      })),
      ...inst.map((t, i) => ({
        object_id: objectId,
        stage_type: 'installation' as const,
        template_id: t.id,
        name: t.name,
        unit: t.unit,
        sort_order: t.sort_order,
        status: i === 0 ? ('in_progress' as const) : ('not_started' as const),
        progress_percent: i === 0 ? 20 : 0,
        date_plan_end: '2026-11-15',
        responsible_id: ids.install,
        created_by: ids.owner,
      })),
    ]
    const { error } = await admin.from('object_stages').insert(stages)
    if (error) throw error
  }

  const { data: stages } = await admin.from('object_stages').select('id, object_id, stage_type').is('deleted_at', null)

  const toolNames = [
    'Сварочный инвертор Сварог 250',
    'Болгарка Makita 230',
    'Болгарка Makita 125',
    'Перфоратор Bosch GBH 2-26',
    'Уровень лазерный Bosch GLL',
    'Рулетка 10 м',
    'Струбцины набор',
    'Газовая горелка',
    'Компрессор 50 л',
    'Лестница 3 секции',
    'Тали 2 т',
    'Ключ динамометрический',
    'Набор головок 1/2',
    'Маска Хамелеон',
    'УШМ DeWalt 125',
    'Дрель ударная',
    'Удлинитель 50 м',
    'Генератор 5 кВт',
    'Набор ключей рожковых',
    'Кабелерез',
  ]

  const toolIds: string[] = []
  for (const [i, name] of toolNames.entries()) {
    const { data, error } = await admin
      .from('tools')
      .insert({
        name,
        inventory_number: `ИН-${1000 + i}`,
        category_id: tcat(i),
        created_by: ids.owner,
      })
      .select('id')
      .single()
    if (error) throw error
    toolIds.push(data.id)
  }

  async function move(toolId: string, type: Database['public']['Enums']['tool_movement_type'], objectId?: string, holder?: string) {
    const { error } = await ownerClient.rpc('create_tool_movement', {
      _tool_id: toolId,
      _movement_type: type,
      _object_id: objectId ?? null,
      _to_holder_id: holder ?? null,
      _comment: 'Сид',
    })
    if (error) throw error
  }

  await move(toolIds[0]!, 'issue', objectIds[1], ids.prod)
  await move(toolIds[1]!, 'issue', objectIds[1], ids.install)
  await move(toolIds[2]!, 'issue', objectIds[2], ids.prod)
  await move(toolIds[2]!, 'extra_delivery', objectIds[2], ids.prod)
  await move(toolIds[3]!, 'issue', objectIds[3], ids.install)
  await move(toolIds[3]!, 'return', objectIds[3])
  await move(toolIds[4]!, 'issue', objectIds[3], ids.install)
  await move(toolIds[4]!, 'to_repair', objectIds[3])
  await move(toolIds[5]!, 'issue', objectIds[1], ids.prod)
  await move(toolIds[5]!, 'loss', objectIds[1])
  await move(toolIds[6]!, 'issue', objectIds[2], ids.prod)
  await move(toolIds[7]!, 'issue', objectIds[2], ids.install)
  await move(toolIds[8]!, 'issue', objectIds[1], ids.prod)

  const vendors = ['ООО МеталлТорг', 'ИП Сидоров', 'Леруа', 'Восток-Техно', 'Газпромнефть']
  const descriptions = ['Электроды МР-3', 'Оплата бригады за неделю', 'Аренда манипулятора', 'Саморезы и пена', 'Дизель']
  const expenseIds: string[] = []
  for (let i = 0; i < 28; i++) {
    const objectId = objectIds[i % objectIds.length]!
    const objectStages = (stages ?? []).filter((s) => s.object_id === objectId)
    const stage = i % 4 === 0 ? null : objectStages[i % Math.max(objectStages.length, 1)]
    const { data: expense, error } = await admin
      .from('expenses')
      .insert({
        object_id: objectId,
        stage_id: stage?.id ?? null,
        category_id: cat(['Расходные материалы', 'Оплата труда / бригады', 'Спецтехника', 'Материалы', 'Прочее'][i % 5]!),
        amount: 12_000 + i * 3750,
        expense_date: `2026-0${(i % 3) + 6}-${String((i % 27) + 1).padStart(2, '0')}`,
        description: descriptions[i % descriptions.length],
        vendor: vendors[i % vendors.length],
        created_by: i % 2 === 0 ? ids.prod : ids.owner,
      })
      .select('id')
      .single()
    if (error) throw error
    expenseIds.push(expense.id)
  }

  await admin.from('material_requests').insert([
    { object_id: objectIds[1]!, title: 'Проволока сварочная 1.2', details: '5 кассет 15 кг', status: 'new', created_by: ids.prod, need_by: '2026-09-10' },
    { object_id: objectIds[3]!, title: 'Саморез по сэндвичу', details: '1000 шт + шайбы', status: 'approved', created_by: ids.install, need_by: '2026-09-05' },
    { object_id: objectIds[2]!, title: 'Отрезные круги 230', details: 'коробка 25 шт', status: 'purchased', created_by: ids.prod, need_by: '2026-08-28' },
  ])

  const fixtures = ensureFixtures()
  const photoObjectId = activeIds[0]!
  const photoStages = (stages ?? []).filter((s) => s.object_id === photoObjectId)

  async function uploadAttachment(params: {
    objectId: string
    kind: 'photo' | 'document'
    fileName: string
    mime: string
    body: Buffer
    folder: string
    stageId?: string | null
    expenseId?: string | null
  }) {
    const id = randomUUID()
    const ext = params.fileName.includes('.') ? params.fileName.split('.').pop()! : params.kind === 'photo' ? 'png' : 'pdf'
    const storagePath = `objects/${params.objectId}/${params.folder}/${id}.${ext}`
    const { error: upErr } = await admin.storage.from('object-files').upload(storagePath, params.body, {
      contentType: params.mime,
      upsert: false,
    })
    if (upErr) throw upErr
    const { error: dbErr } = await admin.from('attachments').insert({
      object_id: params.objectId,
      stage_id: params.stageId ?? null,
      expense_id: params.expenseId ?? null,
      kind: params.kind,
      storage_path: storagePath,
      file_name: params.fileName,
      mime_type: params.mime,
      file_size: params.body.length,
      created_by: ids.owner,
    })
    if (dbErr) throw dbErr
  }

  for (let i = 0; i < 4; i++) {
    await uploadAttachment({
      objectId: photoObjectId,
      kind: 'photo',
      fileName: `фото-${i + 1}.png`,
      mime: 'image/png',
      body: fixtures.png,
      folder: 'photos',
      stageId: i < 2 ? photoStages[i]?.id ?? null : null,
    })
  }

  for (const objectId of objectIds) {
    await uploadAttachment({
      objectId,
      kind: 'document',
      fileName: 'договор-черновик.pdf',
      mime: 'application/pdf',
      body: fixtures.pdf,
      folder: 'docs',
    })
  }

  for (const expenseId of expenseIds.slice(0, 2)) {
    const { data: expense } = await admin.from('expenses').select('object_id').eq('id', expenseId).single()
    if (!expense) continue
    await uploadAttachment({
      objectId: expense.object_id,
      kind: 'document',
      fileName: 'чек.pdf',
      mime: 'application/pdf',
      body: fixtures.pdf,
      folder: `expenses/${expenseId}`,
      expenseId,
    })
  }

  console.info('Demo seed complete. Users: owner@kotov.local, prod@kotov.local, install@kotov.local, docs@kotov.local')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
