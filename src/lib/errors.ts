const MESSAGES: Array<{ match: string | RegExp; text: string }> = [
  { match: /Инструмент не найден/i, text: 'Инструмент не найден или уже удалён.' },
  { match: /Списанный инструмент/i, text: 'Списанный инструмент нельзя перемещать.' },
  { match: /Недостаточно прав для этого типа движения/i, text: 'Недостаточно прав для этого действия с инструментом.' },
  { match: /Нет доступа к объекту/i, text: 'Нет доступа к выбранному объекту.' },
  { match: /уже выдан на объект/i, text: 'Инструмент уже выдан. Сначала верните его или оформите перемещение.' },
  { match: /Выдать можно только свободный/i, text: 'Выдать можно только свободный инструмент.' },
  { match: /Укажите объект для выдачи/i, text: 'Выберите объект, на который выдаётся инструмент.' },
  { match: /Довоз допустим/i, text: 'Довоз возможен, только если инструмент уже находится на этом объекте.' },
  { match: /Нельзя вернуть свободный/i, text: 'Свободный инструмент возвращать не нужно.' },
  { match: /Вернуть можно только/i, text: 'Вернуть можно только инструмент, который сейчас на объекте.' },
  { match: /Переместить можно только/i, text: 'Переместить можно только инструмент с объекта.' },
  { match: /Укажите объект назначения/i, text: 'Выберите объект назначения.' },
  { match: /уже на этом объекте/i, text: 'Инструмент уже находится на этом объекте.' },
  { match: /Нельзя отправить в ремонт свободный/i, text: 'Свободный инструмент нельзя отправить в ремонт.' },
  { match: /В ремонт можно отправить/i, text: 'В ремонт можно отправить только инструмент с объекта.' },
  { match: /не в ремонте/i, text: 'Этот инструмент не числится в ремонте.' },
  { match: /уже отмечен как утерянный/i, text: 'Инструмент уже отмечен как утерянный или списанный.' },
  { match: /Список инструментов пуст/i, text: 'Выберите хотя бы одну позицию инструмента.' },
  { match: /Недостаточно прав для изменения карточки объекта/i, text: 'Карточку объекта может менять только руководитель.' },
  { match: /Недостаточно прав для изменения этого поля этапа/i, text: 'Можно менять только статус, процент и комментарий.' },
  { match: /Нельзя перенести расход/i, text: 'Нельзя перенести расход на другой объект.' },
  { match: /Недостаточно прав для удаления расхода/i, text: 'Удалить расход может руководитель или бухгалтерия.' },
  { match: /Нельзя менять статус учётной записи/i, text: 'Статус учётной записи меняет только руководитель.' },
  { match: /Состояние инструмента меняется только через движение/i, text: 'Статус инструмента меняется только через выдачу, возврат или ремонт.' },
  { match: /Недостаточно прав для удаления/i, text: 'Недостаточно прав для удаления.' },
  { match: /column \"status\" is of type tool_status/i, text: 'Ошибка обновления статуса инструмента. Обновите базу (миграция tool status cast) и попробуйте снова.' },
  { match: /rewrite or cast the expression/i, text: 'Ошибка типа данных на сервере. Нужно применить миграцию для выдачи инструмента.' },
  { match: /duplicate key value/i, text: 'Такая запись уже существует.' },
  { match: /violates unique constraint/i, text: 'Такая запись уже существует.' },
  { match: /update or delete on table .+ violates foreign key/i, text: 'Нельзя удалить: запись используется в других данных.' },
  { match: /violates foreign key/i, text: 'Связанная запись не найдена. Обновите страницу.' },
  { match: /row-level security/i, text: 'Недостаточно прав для этого действия.' },
  { match: /permission denied/i, text: 'Недостаточно прав для этого действия.' },
  { match: /JWT expired/i, text: 'Сессия истекла. Войдите снова.' },
  { match: /Invalid login credentials/i, text: 'Неверный email или пароль.' },
  { match: /Email not confirmed/i, text: 'Email ещё не подтверждён.' },
  { match: /User already registered/i, text: 'Пользователь с таким email уже есть.' },
  { match: /Failed to fetch|NetworkError|fetch/i, text: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз. Введённые данные сохранены.' },
]

const FALLBACK = 'Не получилось выполнить действие. Попробуйте ещё раз.'

export function humanizeError(error: unknown): string {
  const raw = extractMessage(error)
  if (!raw) return FALLBACK

  for (const item of MESSAGES) {
    if (typeof item.match === 'string') {
      if (raw.includes(item.match)) return item.text
    } else if (item.match.test(raw)) {
      return item.text
    }
  }

  if (/^[\u0400-\u04FF]/.test(raw) && raw.length < 180) return raw
  return FALLBACK
}

function extractMessage(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const record = error as { message?: unknown; error_description?: unknown; details?: unknown }
    if (typeof record.message === 'string') return record.message
    if (typeof record.error_description === 'string') return record.error_description
    if (typeof record.details === 'string') return record.details
  }
  return ''
}
