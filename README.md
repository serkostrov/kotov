# Котов

Внутренняя система управления объектами, инструментом и расходами для ИП Котов С.Д. (изготовление и монтаж металлоконструкций, Нижний Новгород).

Этап 1 по ТЗ v1.0: роли и RLS, объекты, производство и монтаж, инструмент, файлы, расходы, заявки, дашборд, настройки.

## Стек

React 18 · TypeScript strict · Vite · shadcn/ui · Tailwind · TanStack Query · react-hook-form + zod · React Router 6 · Supabase (Postgres, Auth, Storage, RLS, Edge Functions)

## Запуск

```bash
cp .env.example .env
# заполните VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Миграции:

```bash
npx supabase db push
# или supabase migration up на локальном стеке
```

Edge Function создания пользователей:

```bash
npx supabase functions deploy admin-create-user
npx supabase functions deploy admin-set-password
```

Тестовые данные (пароль не хранится в репозитории):

```bash
# в .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY, DEMO_PASSWORD
npx tsx scripts/seed-demo.ts
```

Сборка и Docker:

```bash
npm run build
# локально как на Dokploy (нужны VITE_* в .env)
docker compose up --build
```

## Деплой на Dokploy

Фронт — статика в nginx. Supabase (Auth/DB/Storage) снаружи.

1. В Dokploy создайте **Application** → Git-репозиторий этого проекта.
2. **Build Type:** `Dockerfile` (файл `Dockerfile` в корне, context `.`).
3. **Port:** `80`.
4. **Environment** (обычные переменные окружения — этого достаточно):

```text
VITE_SUPABASE_URL=https://your-supabase-host
VITE_SUPABASE_ANON_KEY=your-anon-key
```

При старте контейнер подставляет `VITE_*` в собранный JS (без публичного `/env.js`). Build Arguments не обязательны.

5. Домен / SSL — в настройках приложения Dokploy (прокси на порт 80).
6. Healthcheck: `GET /healthz` → `ok`.

Перед продом на том же Supabase:

```bash
npx supabase db push
npx supabase functions deploy admin-create-user
npx supabase functions deploy admin-set-password
```

Не кладите `SUPABASE_SERVICE_ROLE_KEY` в Environment приложения фронта.

Локальная проверка образа:

```bash
docker compose up --build
# http://localhost:8080
```

## Роли

| Код | Кто |
|---|---|
| `owner` | Руководитель — полный доступ |
| `prod_foreman` | Бригадир производства — свои объекты |
| `install_foreman` | Бригадир монтажа — свои объекты |
| `accountant` | Документы и расходы |

Публичной регистрации нет. Пользователей создаёт руководитель.

## Правила, которые нельзя нарушать

- RLS включён на всех таблицах
- Деньги — `numeric(14,2)`, даты — `timestamptz` UTC, UI — `Europe/Moscow`
- Нет физического удаления рабочих сущностей (`deleted_at`)
- Состояние инструмента меняется только через RPC `create_tool_movement` / `create_tool_movements_bulk`
- Имена таблиц, полей и enum — как в ТЗ
- `service_role` только в Edge Functions, во фронте его нет
