import { useEffect, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { FilterBar } from '@/components/filter-bar'
import { IconButton } from '@/components/icon-button'
import { Field, PageHeader } from '@/components/page-header'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useContactMutations, useContacts } from '@/hooks/use-objects'
import { humanizeError } from '@/lib/errors'

type ContactRow = NonNullable<ReturnType<typeof useContacts>['data']>[number]

export function ContactsPage() {
  const contacts = useContacts()
  const mut = useContactMutations()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ContactRow | null>(null)
  const [deleting, setDeleting] = useState<ContactRow | null>(null)

  const rows = (contacts.data ?? []).filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      c.full_name.toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q) ||
      c.objects.some((o) => o.name.toLowerCase().includes(q))
    )
  })

  const objectsLabel = (contact: ContactRow) =>
    contact.objects.length > 0 ? contact.objects.map((o) => o.name).join(', ') : '—'

  if (contacts.isError) {
    return <ErrorState message={humanizeError(contacts.error)} onRetry={() => void contacts.refetch()} />
  }

  return (
    <div>
      <PageHeader
        title="Контакты"
        description="Люди для поля «контакт заказчика» на объектах"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Добавить
          </Button>
        }
      />

      <FilterBar>
        <div className="relative min-w-0 sm:col-span-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Поиск по ФИО или телефону"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </FilterBar>

      {contacts.isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <EmptyState title="Контактов нет" description="Добавьте человека с ФИО и телефоном." />
      ) : (
        <>
          <div className="grid gap-2 md:hidden">
            {rows.map((contact) => (
              <Card key={contact.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{contact.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{contact.phone ?? '—'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      объект: {objectsLabel(contact)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton icon={Pencil} label="Изменить" onClick={() => setEditing(contact)} />
                    <IconButton
                      icon={Trash2}
                      label="Удалить"
                      variant="destructive"
                      onClick={() => setDeleting(contact)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border/80 bg-card/90 md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">ФИО</th>
                  <th className="px-3 py-3 font-medium">Телефон</th>
                  <th className="px-3 py-3 font-medium">Объект</th>
                  <th className="w-20 px-3 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((contact) => (
                  <tr key={contact.id} className="group border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium">{contact.full_name}</td>
                    <td className="px-3 py-2.5">{contact.phone ?? '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{objectsLabel(contact)}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                        <IconButton icon={Pencil} label="Изменить" onClick={() => setEditing(contact)} />
                        <IconButton
                          icon={Trash2}
                          label="Удалить"
                          variant="destructive"
                          onClick={() => setDeleting(contact)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ContactFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        pending={mut.create.isPending}
        onSubmit={(values) =>
          mut.create.mutate(values, {
            onSuccess: () => {
              toast.success('Контакт добавлен')
              setCreateOpen(false)
            },
            onError: (e) => toast.error(humanizeError(e)),
          })
        }
      />

      <ContactFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        mode="edit"
        defaults={editing}
        pending={mut.update.isPending}
        onSubmit={(values) => {
          if (!editing) return
          mut.update.mutate(
            { id: editing.id, values },
            {
              onSuccess: () => {
                toast.success('Сохранено')
                setEditing(null)
              },
              onError: (e) => toast.error(humanizeError(e)),
            },
          )
        }}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить контакт?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `«${deleting.full_name}» будет убран из списка контактов.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mut.softDelete.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={mut.softDelete.isPending}
              onClick={() => {
                if (!deleting) return
                mut.softDelete.mutate(deleting.id, {
                  onSuccess: () => {
                    toast.success('Контакт удалён')
                    setDeleting(null)
                  },
                  onError: (e) => toast.error(humanizeError(e)),
                })
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ContactFormDialog({
  open,
  onOpenChange,
  mode,
  defaults,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  defaults?: Pick<ContactRow, 'full_name' | 'phone'> | null
  pending?: boolean
  onSubmit: (values: { full_name: string; phone: string | null }) => void
}) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!open) return
    setFullName(defaults?.full_name ?? '')
    setPhone(defaults?.phone ?? '')
  }, [open, defaults])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Новый контакт' : 'Редактировать контакт'}</DialogTitle>
        </DialogHeader>
        <Field label="ФИО">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </Field>
        <Field label="Телефон">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 …" />
        </Field>
        <DialogFooter>
          <Button
            disabled={pending || !fullName.trim()}
            onClick={() =>
              onSubmit({
                full_name: fullName.trim(),
                phone: phone.trim() || null,
              })
            }
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
