import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { KeyRound, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { IconButton } from '@/components/icon-button'
import { Field, PageHeader } from '@/components/page-header'
import { TabsBar } from '@/components/tabs-bar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useExpenseCategories,
  useStageTemplates,
  useToolCategories,
  useUsersAdmin,
} from '@/hooks/use-objects'
import type { AppRole, StageType } from '@/lib/database.types'
import { ROLE_LABELS, STAGE_TYPE_LABELS } from '@/lib/dictionaries'
import { humanizeError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

const ALL_ROLES: AppRole[] = ['owner', 'prod_foreman', 'install_foreman', 'accountant']

function primaryRole(roles: AppRole[]): AppRole | null {
  return roles[0] ?? null
}

async function setUserRole(userId: string, role: AppRole | null) {
  const { error: delError } = await supabase.from('user_roles').delete().eq('user_id', userId)
  if (delError) throw delError
  if (!role) return
  const { error: insError } = await supabase.from('user_roles').insert({ user_id: userId, role })
  if (insError) throw insError
}

type CatalogTable = 'expense_categories' | 'tool_categories'
type CatalogRow = { id: string; name: string; is_active: boolean }
type SettingsTab = 'users' | 'expenses' | 'tools' | 'stages'
type AdminUser = NonNullable<ReturnType<typeof useUsersAdmin>['data']>[number]
type StageTemplate = NonNullable<ReturnType<typeof useStageTemplates>['data']>[number]

const CREATE_LABELS: Record<SettingsTab, string> = {
  users: 'Создать пользователя',
  expenses: 'Добавить категорию',
  tools: 'Добавить категорию',
  stages: 'Добавить шаблон',
}

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as SettingsTab | null) ?? 'users'
  const stageTypeParam = params.get('type') === 'installation' ? 'installation' : 'production'
  const [createOpen, setCreateOpen] = useState(false)
  const [createStageType, setCreateStageType] = useState<StageType>(stageTypeParam)

  useEffect(() => {
    setCreateStageType(stageTypeParam)
  }, [stageTypeParam])

  const setTab = (value: SettingsTab) => {
    const next = new URLSearchParams(params)
    next.set('tab', value)
    if (value !== 'stages') next.delete('type')
    setParams(next, { replace: true })
    setCreateOpen(false)
  }

  return (
    <div>
      <PageHeader title="Настройки" description="Пользователи и справочники" />
      <Tabs value={tab} onValueChange={(value) => setTab(value as SettingsTab)}>
        <TabsBar
          tabs={
            <TabsList>
              <TabsTrigger value="users">Пользователи</TabsTrigger>
              <TabsTrigger value="expenses">Категории расходов</TabsTrigger>
              <TabsTrigger value="tools">Категории инструмента</TabsTrigger>
              <TabsTrigger value="stages">Шаблоны работ</TabsTrigger>
            </TabsList>
          }
          actions={
            tab === 'stages' ? null : (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus />
                {CREATE_LABELS[tab]}
              </Button>
            )
          }
        />
        <TabsContent value="users">
          <UsersTab createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
        </TabsContent>
        <TabsContent value="expenses">
          <CatalogTab
            table="expense_categories"
            query={useExpenseCategories()}
            createOpen={createOpen}
            onCreateOpenChange={setCreateOpen}
          />
        </TabsContent>
        <TabsContent value="tools">
          <CatalogTab
            table="tool_categories"
            query={useToolCategories()}
            createOpen={createOpen}
            onCreateOpenChange={setCreateOpen}
          />
        </TabsContent>
        <TabsContent value="stages">
          <StagesTab
            createOpen={createOpen}
            onCreateOpenChange={setCreateOpen}
            createType={createStageType}
            onCreateTypeChange={setCreateStageType}
            focusType={stageTypeParam}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function UsersTab({
  createOpen,
  onCreateOpenChange,
}: {
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}) {
  const users = useUsersAdmin()
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState<AdminUser | null>(null)

  if (users.isLoading) return <Skeleton className="h-40" />
  if (users.isError) return <ErrorState message={humanizeError(users.error)} onRetry={() => void users.refetch()} />

  return (
    <div className="space-y-2">
      {(users.data ?? []).length === 0 ? (
        <EmptyState title="Пользователей нет" />
      ) : (
        <div className="grid gap-1.5">
          {(users.data ?? []).map((u) => {
            const role = primaryRole(u.roles)
            return (
              <Card
                key={u.id}
                className="cursor-pointer transition-colors hover:bg-muted/20"
                onClick={() => setEditing(u)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium leading-tight">
                      {u.full_name}
                      {!u.is_active ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">отключён</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.email ?? '—'}</p>
                    <div className="mt-1.5">
                      {role ? (
                        <Badge tone="outline">{ROLE_LABELS[role]}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">роль не назначена</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                    <IconButton icon={Pencil} label="Изменить" onClick={() => setEditing(u)} />
                    <IconButton icon={KeyRound} label="Сменить пароль" onClick={() => setPasswordUser(u)} />
                    <IconButton
                      icon={Power}
                      label={u.is_active ? 'Отключить' : 'Включить'}
                      onClick={async () => {
                        const { error } = await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id)
                        if (error) toast.error(humanizeError(error))
                        else {
                          toast.success(u.is_active ? 'Пользователь отключён' : 'Пользователь включён')
                          void users.refetch()
                        }
                      }}
                    />
                    <IconButton icon={Trash2} label="Удалить" variant="destructive" onClick={() => setDeleting(u)} />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      <CreateUserDialog open={createOpen} onOpenChange={onCreateOpenChange} onCreated={() => void users.refetch()} />
      <EditUserDialog
        user={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSaved={() => void users.refetch()}
        onChangePassword={(u) => {
          setEditing(null)
          setPasswordUser(u)
        }}
      />
      <ChangePasswordDialog
        user={passwordUser}
        open={Boolean(passwordUser)}
        onOpenChange={(open) => {
          if (!open) setPasswordUser(null)
        }}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        title="Удалить пользователя?"
        description={
          deleting
            ? `«${deleting.full_name}» будет отключён. Учётную запись из системы полностью убрать нельзя — доступ просто закроется.`
            : ''
        }
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        onConfirm={async () => {
          if (!deleting) return
          const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', deleting.id)
          if (error) toast.error(humanizeError(error))
          else {
            toast.success('Пользователь отключён')
            void users.refetch()
          }
          setDeleting(null)
        }}
      />
    </div>
  )
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AppRole | ''>('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) {
      setEmail('')
      setFullName('')
      setPhone('')
      setPassword('')
      setRole('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый пользователь</DialogTitle>
        </DialogHeader>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="ФИО">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Телефон">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Роль">
          <Select value={role || undefined} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите роль" />
            </SelectTrigger>
            <SelectContent>
              {ALL_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Временный пароль">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Если пусто — сгенерируется" />
        </Field>
        <DialogFooter>
          <Button
            disabled={pending || !email || !fullName || !role}
            onClick={async () => {
              setPending(true)
              try {
                const { data, error } = await supabase.functions.invoke('admin-create-user', {
                  body: {
                    email,
                    full_name: fullName,
                    phone,
                    password: password || undefined,
                    roles: role ? [role] : [],
                  },
                })
                if (error) throw error
                const generated = (data as { password?: string } | null)?.password
                toast.success(generated ? `Создан. Пароль: ${generated}` : 'Пользователь создан')
                onOpenChange(false)
                onCreated()
              } catch (error) {
                toast.error(humanizeError(error))
              } finally {
                setPending(false)
              }
            }}
          >
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSaved,
  onChangePassword,
}: {
  user: AdminUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  onChangePassword: (user: AdminUser) => void
}) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<AppRole | ''>('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (user) {
      setFullName(user.full_name)
      setPhone(user.phone ?? '')
      setRole(primaryRole(user.roles) ?? '')
    }
  }, [user])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать пользователя</DialogTitle>
        </DialogHeader>
        <Field label="Учётная почта">
          <Input value={user?.email ?? '—'} disabled readOnly />
        </Field>
        <Field label="ФИО">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Телефон">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Роль">
          <Select value={role || undefined} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите роль" />
            </SelectTrigger>
            <SelectContent>
              {ALL_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={!user}
            onClick={() => {
              if (user) onChangePassword(user)
            }}
          >
            Сменить пароль
          </Button>
          <Button
            disabled={pending || !fullName.trim() || !role}
            onClick={async () => {
              if (!user || !role) return
              setPending(true)
              try {
                const { error } = await supabase
                  .from('profiles')
                  .update({
                    full_name: fullName.trim(),
                    phone: phone.trim() || null,
                  })
                  .eq('id', user.id)
                if (error) throw error
                await setUserRole(user.id, role)
                toast.success('Сохранено')
                onOpenChange(false)
                onSaved()
              } catch (error) {
                toast.error(humanizeError(error))
              } finally {
                setPending(false)
              }
            }}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChangePasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) {
      setPassword('')
      setConfirm('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Сменить пароль</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Новый пароль для входа{user?.full_name ? ` — ${user.full_name}` : ''}
          {user?.email ? ` (${user.email})` : ''}.
        </p>
        <Field label="Новый пароль">
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Не короче 8 символов"
          />
        </Field>
        <Field label="Повтор пароля">
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button
            disabled={pending || password.length < 8 || password !== confirm}
            onClick={async () => {
              if (!user) return
              setPending(true)
              try {
                const { data, error } = await supabase.functions.invoke('admin-set-password', {
                  body: { user_id: user.id, password },
                })
                if (error) throw error
                const payload = data as { error?: string; ok?: boolean } | null
                if (payload?.error) throw new Error(payload.error)
                toast.success('Пароль обновлён')
                onOpenChange(false)
              } catch (error) {
                toast.error(humanizeError(error))
              } finally {
                setPending(false)
              }
            }}
          >
            Сохранить пароль
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CatalogTab({
  table,
  query,
  createOpen,
  onCreateOpenChange,
}: {
  table: CatalogTable
  query: {
    data?: CatalogRow[] | undefined
    isLoading: boolean
    isError?: boolean
    error?: unknown
    refetch: () => unknown
  }
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<CatalogRow | null>(null)
  const [editName, setEditName] = useState('')
  const [deleting, setDeleting] = useState<CatalogRow | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!createOpen) setName('')
  }, [createOpen])

  if (query.isLoading) return <Skeleton className="h-32" />
  if (query.isError) return <ErrorState message={humanizeError(query.error)} onRetry={() => void query.refetch()} />

  return (
    <div className="space-y-2">
      {(query.data ?? []).length === 0 ? (
        <EmptyState title="Пока пусто" description="Добавьте первую запись." />
      ) : (
        <div className="grid gap-1.5">
          {(query.data ?? []).map((row) => (
            <div
              key={row.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 transition-colors hover:bg-muted/20"
              onClick={() => {
                setEditing(row)
                setEditName(row.name)
              }}
            >
              <div className="min-w-0">
                <p className={`truncate text-[13px] ${!row.is_active ? 'text-muted-foreground' : 'font-medium'}`}>{row.name}</p>
                {!row.is_active ? <p className="text-xs text-muted-foreground">Отключено</p> : null}
              </div>
              <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                <IconButton
                  icon={Pencil}
                  label="Изменить"
                  onClick={() => {
                    setEditing(row)
                    setEditName(row.name)
                  }}
                />
                <IconButton
                  icon={Power}
                  label={row.is_active ? 'Отключить' : 'Включить'}
                  onClick={async () => {
                    const { error } = await supabase.from(table).update({ is_active: !row.is_active }).eq('id', row.id)
                    if (error) toast.error(humanizeError(error))
                    else {
                      toast.success(row.is_active ? 'Отключено' : 'Включено')
                      void query.refetch()
                    }
                  }}
                />
                <IconButton icon={Trash2} label="Удалить" variant="destructive" onClick={() => setDeleting(row)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая категория</DialogTitle>
          </DialogHeader>
          <Field label="Название">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <DialogFooter>
            <Button
              disabled={pending || !name.trim()}
              onClick={async () => {
                setPending(true)
                const { error } = await supabase.from(table).insert({ name: name.trim() })
                setPending(false)
                if (error) toast.error(humanizeError(error))
                else {
                  toast.success('Добавлено')
                  onCreateOpenChange(false)
                  void query.refetch()
                }
              }}
            >
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать</DialogTitle>
          </DialogHeader>
          <Field label="Название">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button
              disabled={pending || !editName.trim()}
              onClick={async () => {
                if (!editing) return
                setPending(true)
                const { error } = await supabase.from(table).update({ name: editName.trim() }).eq('id', editing.id)
                setPending(false)
                if (error) toast.error(humanizeError(error))
                else {
                  toast.success('Сохранено')
                  setEditing(null)
                  void query.refetch()
                }
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        title="Удалить запись?"
        description={deleting ? `«${deleting.name}» будет удалена из справочника.` : ''}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        onConfirm={async () => {
          if (!deleting) return
          const { error } = await supabase.from(table).delete().eq('id', deleting.id)
          if (error) {
            const msg = humanizeError(error)
            if (/используется/i.test(msg) || /foreign key/i.test(String((error as { message?: string }).message ?? ''))) {
              const { error: softError } = await supabase.from(table).update({ is_active: false }).eq('id', deleting.id)
              if (softError) toast.error(humanizeError(softError))
              else {
                toast.success('Запись используется — отключена вместо удаления')
                void query.refetch()
              }
            } else {
              toast.error(msg)
            }
          } else {
            toast.success('Удалено')
            void query.refetch()
          }
          setDeleting(null)
        }}
      />
    </div>
  )
}

function StagesTab({
  createOpen,
  onCreateOpenChange,
  createType,
  onCreateTypeChange,
  focusType,
}: {
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
  createType: StageType
  onCreateTypeChange: (type: StageType) => void
  focusType: StageType
}) {
  const templates = useStageTemplates()
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [editing, setEditing] = useState<StageTemplate | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<StageType>('production')
  const [editUnit, setEditUnit] = useState('')
  const [deleting, setDeleting] = useState<StageTemplate | null>(null)
  const [pending, setPending] = useState(false)

  const production = useMemo(
    () => (templates.data ?? []).filter((t) => t.stage_type === 'production'),
    [templates.data],
  )
  const installation = useMemo(
    () => (templates.data ?? []).filter((t) => t.stage_type === 'installation'),
    [templates.data],
  )

  useEffect(() => {
    if (!createOpen) {
      setName('')
      setUnit('')
    }
  }, [createOpen])

  const openCreate = (type: StageType) => {
    onCreateTypeChange(type)
    onCreateOpenChange(true)
  }

  if (templates.isLoading) return <Skeleton className="h-32" />
  if (templates.isError) {
    return <ErrorState message={humanizeError(templates.error)} onRetry={() => void templates.refetch()} />
  }

  return (
    <div className="flex h-[calc(100dvh-14.5rem)] flex-col lg:h-[calc(100dvh-10.5rem)]">
      <div className="grid min-h-0 flex-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
        <TemplateSection
          title="Производство"
          description="Типовые работы для вкладки «Производство» на объекте"
          rows={production}
          highlighted={focusType === 'production'}
          onAdd={() => openCreate('production')}
          onEdit={(row) => {
            setEditing(row)
            setEditName(row.name)
            setEditType(row.stage_type)
            setEditUnit(row.unit ?? '')
          }}
          onToggle={async (row) => {
            const { error } = await supabase.from('stage_templates').update({ is_active: !row.is_active }).eq('id', row.id)
            if (error) toast.error(humanizeError(error))
            else {
              toast.success(row.is_active ? 'Отключено' : 'Включено')
              void templates.refetch()
            }
          }}
          onDelete={setDeleting}
        />

        <TemplateSection
          title="Монтаж"
          description="Типовые монтажные работы — добавляются на объект из шаблона"
          rows={installation}
          highlighted={focusType === 'installation'}
          onAdd={() => openCreate('installation')}
          onEdit={(row) => {
            setEditing(row)
            setEditName(row.name)
            setEditType(row.stage_type)
            setEditUnit(row.unit ?? '')
          }}
          onToggle={async (row) => {
            const { error } = await supabase.from('stage_templates').update({ is_active: !row.is_active }).eq('id', row.id)
            if (error) toast.error(humanizeError(error))
            else {
              toast.success(row.is_active ? 'Отключено' : 'Включено')
              void templates.refetch()
            }
          }}
          onDelete={setDeleting}
        />
      </div>

      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый шаблон · {STAGE_TYPE_LABELS[createType].toLowerCase()}</DialogTitle>
          </DialogHeader>
          <Field label="Тип">
            <Select value={createType} onValueChange={(v) => onCreateTypeChange(v as StageType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Производство</SelectItem>
                <SelectItem value="installation">Монтаж</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Название">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Ед. изм.">
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="шт, м2…" />
          </Field>
          <DialogFooter>
            <Button
              disabled={pending || !name.trim()}
              onClick={async () => {
                setPending(true)
                const { error } = await supabase.from('stage_templates').insert({
                  name: name.trim(),
                  stage_type: createType,
                  unit: unit.trim() || null,
                })
                setPending(false)
                if (error) toast.error(humanizeError(error))
                else {
                  toast.success('Добавлено')
                  onCreateOpenChange(false)
                  void templates.refetch()
                }
              }}
            >
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать шаблон</DialogTitle>
          </DialogHeader>
          <Field label="Тип">
            <Select value={editType} onValueChange={(v) => setEditType(v as StageType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Производство</SelectItem>
                <SelectItem value="installation">Монтаж</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Название">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </Field>
          <Field label="Ед. изм.">
            <Input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button
              disabled={pending || !editName.trim()}
              onClick={async () => {
                if (!editing) return
                setPending(true)
                const { error } = await supabase
                  .from('stage_templates')
                  .update({
                    name: editName.trim(),
                    stage_type: editType,
                    unit: editUnit.trim() || null,
                  })
                  .eq('id', editing.id)
                setPending(false)
                if (error) toast.error(humanizeError(error))
                else {
                  toast.success('Сохранено')
                  setEditing(null)
                  void templates.refetch()
                }
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        title="Удалить шаблон работы?"
        description={deleting ? `«${deleting.name}» будет удалён из справочника.` : ''}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        onConfirm={async () => {
          if (!deleting) return
          const { error } = await supabase.from('stage_templates').delete().eq('id', deleting.id)
          if (error) {
            const msg = humanizeError(error)
            if (/используется/i.test(msg) || /foreign key/i.test(String((error as { message?: string }).message ?? ''))) {
              const { error: softError } = await supabase
                .from('stage_templates')
                .update({ is_active: false })
                .eq('id', deleting.id)
              if (softError) toast.error(humanizeError(softError))
              else {
                toast.success('Этап используется — отключён вместо удаления')
                void templates.refetch()
              }
            } else {
              toast.error(msg)
            }
          } else {
            toast.success('Удалено')
            void templates.refetch()
          }
          setDeleting(null)
        }}
      />
    </div>
  )
}

function TemplateSection({
  title,
  description,
  rows,
  highlighted,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: {
  title: string
  description: string
  rows: StageTemplate[]
  highlighted?: boolean
  onAdd: () => void
  onEdit: (row: StageTemplate) => void
  onToggle: (row: StageTemplate) => void | Promise<void>
  onDelete: (row: StageTemplate) => void
}) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card ${highlighted ? 'ring-1 ring-primary/25' : 'border-border/80'}`}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-3.5 py-2.5">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" className="h-8 shrink-0" onClick={onAdd}>
          <Plus />
          Добавить
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-3.5 py-6 text-center text-[13px] text-muted-foreground">
          Шаблонов пока нет — добавьте типовые работы.
        </p>
      ) : (
        <div className="min-h-0 flex-1 divide-y divide-border/70 overflow-y-auto overscroll-contain">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2 transition-colors hover:bg-muted/20"
              onClick={() => onEdit(row)}
            >
              <div className="min-w-0">
                <p className={`truncate text-[13px] font-medium ${!row.is_active ? 'text-muted-foreground' : ''}`}>
                  {row.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.unit ? row.unit : 'без ед. изм.'}
                  {!row.is_active ? ' · отключён' : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                <IconButton icon={Pencil} label="Изменить" onClick={() => onEdit(row)} />
                <IconButton
                  icon={Power}
                  label={row.is_active ? 'Отключить' : 'Включить'}
                  onClick={() => void onToggle(row)}
                />
                <IconButton icon={Trash2} label="Удалить" variant="destructive" onClick={() => onDelete(row)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ConfirmDeleteDialog({
  open,
  title,
  description,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}) {
  const [pending, setPending] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault()
              void (async () => {
                setPending(true)
                try {
                  await onConfirm()
                } finally {
                  setPending(false)
                }
              })()
            }}
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
