import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { DatePicker } from '@/components/date-picker'
import { Field } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useContactMutations } from '@/hooks/use-objects'
import { humanizeError } from '@/lib/errors'

const schema = z.object({
  name: z.string().min(2, 'Укажите название'),
  address: z.string().optional(),
  customer_contact_id: z.string().optional(),
  date_start: z.string().optional(),
  date_plan_end: z.string().optional(),
  contract_amount: z.coerce.number().min(0),
  responsible_id: z.string().optional(),
  comment: z.string().optional(),
})

export type ObjectFormValues = z.infer<typeof schema>

export type ObjectFormPerson = { id: string; full_name: string }

export type ObjectFormContact = { id: string; full_name: string; phone?: string | null }

export type ObjectFormDefaults = {
  name: string
  address?: string | null
  customer_contact_id?: string | null
  date_start?: string | null
  date_plan_end?: string | null
  contract_amount?: number | null
  responsible_id?: string | null
  comment?: string | null
}

function contactLabel(c: ObjectFormContact) {
  return c.phone ? `${c.full_name} · ${c.phone}` : c.full_name
}

export function ObjectFormDialog({
  open,
  onOpenChange,
  mode,
  people,
  contacts,
  defaults,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  people: ObjectFormPerson[]
  contacts: ObjectFormContact[]
  defaults?: ObjectFormDefaults | null
  pending?: boolean
  onSubmit: (values: ObjectFormValues) => void
}) {
  const contactMut = useContactMutations()
  const [contactCreateOpen, setContactCreateOpen] = useState(false)
  const [newFullName, setNewFullName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [extraContacts, setExtraContacts] = useState<ObjectFormContact[]>([])

  const allContacts = [...extraContacts, ...contacts.filter((c) => !extraContacts.some((e) => e.id === c.id))]

  const form = useForm<ObjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', contract_amount: 0 },
  })

  useEffect(() => {
    if (!open) {
      setExtraContacts([])
      return
    }
    form.reset({
      name: defaults?.name ?? '',
      address: defaults?.address ?? '',
      customer_contact_id: defaults?.customer_contact_id ?? '',
      date_start: defaults?.date_start ?? '',
      date_plan_end: defaults?.date_plan_end ?? '',
      contract_amount: Number(defaults?.contract_amount ?? 0),
      responsible_id: defaults?.responsible_id ?? '',
      comment: defaults?.comment ?? '',
    })
  }, [open, defaults, form])

  useEffect(() => {
    if (!contactCreateOpen) {
      setNewFullName('')
      setNewPhone('')
    }
  }, [contactCreateOpen])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? 'Новый объект' : 'Редактировать объект'}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={form.handleSubmit(onSubmit)}>
            <Field label="Название" error={form.formState.errors.name?.message}>
              <Input {...form.register('name')} autoFocus />
            </Field>
            <Field label="Адрес">
              <Input {...form.register('address')} />
            </Field>
            <Field label="Контакт заказчика">
              <Controller
                control={form.control}
                name="customer_contact_id"
                render={({ field }) => (
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(v) => {
                      if (v === '__new__') {
                        setContactCreateOpen(true)
                        return
                      }
                      field.onChange(v === 'none' ? '' : v)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Не выбран" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не выбран</SelectItem>
                      <SelectItem value="__new__">+ Добавить нового</SelectItem>
                      {allContacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {contactLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Начало">
                <Controller
                  control={form.control}
                  name="date_start"
                  render={({ field }) => <DatePicker value={field.value ?? ''} onChange={field.onChange} />}
                />
              </Field>
              <Field label="План завершения">
                <Controller
                  control={form.control}
                  name="date_plan_end"
                  render={({ field }) => <DatePicker value={field.value ?? ''} onChange={field.onChange} />}
                />
              </Field>
            </div>
            <Field label="Сумма договора, ₽">
              <Input type="number" step="0.01" min="0" {...form.register('contract_amount')} />
            </Field>
            <Field label="Ответственный">
              <Controller
                control={form.control}
                name="responsible_id"
                render={({ field }) => (
                  <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Не назначен" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не назначен</SelectItem>
                      {people.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Комментарий">
              <Textarea {...form.register('comment')} />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {mode === 'create' ? 'Создать' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={contactCreateOpen} onOpenChange={setContactCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый контакт</DialogTitle>
          </DialogHeader>
          <Field label="ФИО">
            <Input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} autoFocus />
          </Field>
          <Field label="Телефон">
            <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+7 …" />
          </Field>
          <DialogFooter>
            <Button
              disabled={!newFullName.trim() || contactMut.create.isPending}
              onClick={() =>
                contactMut.create.mutate(
                  { full_name: newFullName.trim(), phone: newPhone.trim() || null },
                  {
                    onSuccess: (created) => {
                      const row: ObjectFormContact = {
                        id: created.id,
                        full_name: newFullName.trim(),
                        phone: newPhone.trim() || null,
                      }
                      setExtraContacts((prev) => [row, ...prev.filter((c) => c.id !== row.id)])
                      form.setValue('customer_contact_id', created.id)
                      setContactCreateOpen(false)
                      toast.success('Контакт добавлен')
                    },
                    onError: (e) => toast.error(humanizeError(e)),
                  },
                )
              }
            >
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function toObjectPayload(values: ObjectFormValues, contacts: ObjectFormContact[] = []) {
  const contact = values.customer_contact_id
    ? contacts.find((c) => c.id === values.customer_contact_id)
    : null
  return {
    name: values.name,
    address: values.address || null,
    customer_name: contact?.full_name ?? null,
    customer_contact_id: values.customer_contact_id || null,
    customer_contact: contact ? contactLabel(contact) : null,
    date_start: values.date_start || null,
    date_plan_end: values.date_plan_end || null,
    contract_amount: values.contract_amount,
    responsible_id: values.responsible_id || null,
    comment: values.comment || null,
  }
}
