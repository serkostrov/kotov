import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/logo'
import { Field } from '@/components/page-header'
import { AuthBackdrop } from '@/components/auth-backdrop'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-provider'
import { humanizeError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

const schema = z.object({
  email: z.string().email('Укажите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const [pending, setPending] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <AuthBackdrop className="pointer-events-none absolute inset-0" />

      <Card className="relative w-full max-w-[26rem] animate-rise border-white/10 bg-card/95 shadow-[0_24px_60px_-28px_oklch(0.15_0.02_250_/_0.7)]">
        <CardHeader className="space-y-5 pb-2">
          <div className="flex items-center gap-3">
            <Logo className="h-11 w-11 text-primary" />
            <div>
              <p className="text-[11px] font-bold tracking-[0.22em] text-muted-foreground">КОТОВ</p>
              <CardTitle className="text-xl">Вход в систему</CardTitle>
            </div>
          </div>
          <CardDescription className="text-[13px] leading-relaxed">
            Объекты, производство, монтаж, инструмент и расходы — в одном месте.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit(async (values) => {
              setPending(true)
              try {
                const { error } = await supabase.auth.signInWithPassword(values)
                if (error) throw error
              } catch (error) {
                toast.error(humanizeError(error))
              } finally {
                setPending(false)
              }
            })}
          >
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" autoComplete="email" {...form.register('email')} />
            </Field>
            <Field label="Пароль" error={form.formState.errors.password?.message}>
              <Input type="password" autoComplete="current-password" {...form.register('password')} />
            </Field>
            <Button type="submit" className="mt-1 w-full" disabled={pending}>
              {pending ? 'Входим…' : 'Войти'}
            </Button>
            <Link
              to="/forgot-password"
              className="text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Забыли пароль?
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function ForgotPasswordPage() {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const form = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.string().email('Укажите корректный email') })),
    defaultValues: { email: '' },
  })

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md animate-rise">
        <CardHeader>
          <CardTitle>Восстановление пароля</CardTitle>
          <CardDescription>Отправим ссылку на email, если учётная запись существует.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-muted-foreground">Письмо отправлено. Проверьте почту.</p>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={form.handleSubmit(async ({ email }) => {
                setPending(true)
                try {
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/login`,
                  })
                  if (error) throw error
                  setSent(true)
                } catch (error) {
                  toast.error(humanizeError(error))
                } finally {
                  setPending(false)
                }
              })}
            >
              <Field label="Email" error={form.formState.errors.email?.message}>
                <Input type="email" {...form.register('email')} />
              </Field>
              <Button type="submit" disabled={pending}>
                Отправить ссылку
              </Button>
              <Link to="/login" className="text-center text-sm text-muted-foreground hover:text-foreground">
                Назад ко входу
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function NoAccessPage() {
  const { signOut, profile } = useAuth()
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-md animate-rise">
        <CardHeader>
          <CardTitle>Доступ ещё не настроен</CardTitle>
          <CardDescription>
            {profile?.full_name ? `${profile.full_name}, обратитесь` : 'Обратитесь'} к руководителю, чтобы вам назначили
            роль.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void signOut()}>
            Выйти
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
