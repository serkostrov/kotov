import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { DatePicker } from '@/components/date-picker'
import { Field } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const schema = z.object({
  name: z.string().min(2, 'Укажите название'),
  address: z.string().optional(),
  customer_name: z.string().optional(),
  customer_contact: z.string().optional(),
  date_start: z.string().optional(),
  date_plan_end: z.string().optional(),
  contract_amount: z.coerce.number().min(0),
  responsible_id: z.string().optional(),
  comment: z.string().optional(),
})

export type ObjectFormValues = z.infer<typeof schema>

export type ObjectFormPerson = { id: string; full_name: string }

export type ObjectFormDefaults = {
  name: string
  address?: string | null
  customer_name?: string | null
  customer_contact?: string | null
  date_start?: string | null
  date_plan_end?: string | null
  contract_amount?: number | null
  responsible_id?: string | null
  comment?: string | null
}

export function ObjectFormDialog({
  open,
  onOpenChange,
  mode,
  people,
  defaults,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  people: ObjectFormPerson[]
  defaults?: ObjectFormDefaults | null
  pending?: boolean
  onSubmit: (values: ObjectFormValues) => void
}) {
  const form = useForm<ObjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', contract_amount: 0 },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      name: defaults?.name ?? '',
      address: defaults?.address ?? '',
      customer_name: defaults?.customer_name ?? '',
      customer_contact: defaults?.customer_contact ?? '',
      date_start: defaults?.date_start ?? '',
      date_plan_end: defaults?.date_plan_end ?? '',
      contract_amount: Number(defaults?.contract_amount ?? 0),
      responsible_id: defaults?.responsible_id ?? '',
      comment: defaults?.comment ?? '',
    })
  }, [open, defaults, form])

  return (
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Заказчик">
              <Input {...form.register('customer_name')} />
            </Field>
            <Field label="Контакт заказчика">
              <Input {...form.register('customer_contact')} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Старт">
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
  )
}

export function toObjectPayload(values: ObjectFormValues) {
  return {
    name: values.name,
    address: values.address || null,
    customer_name: values.customer_name || null,
    customer_contact: values.customer_contact || null,
    date_start: values.date_start || null,
    date_plan_end: values.date_plan_end || null,
    contract_amount: values.contract_amount,
    responsible_id: values.responsible_id || null,
    comment: values.comment || null,
  }
}
