import { useAppStore } from '../store'
import en from './locales/en'
import ru from './locales/ru'

const dictionaries: Record<string, Record<string, string>> = { en, ru }

/**
 * Returns the translation function bound to the current locale.
 * Re-renders when locale changes (Zustand selector).
 *
 * Usage:
 *   const t = useT()
 *   t('nav.dashboard')                      // "Дашборд"
 *   t('rule.afterFails', { count: 3 })      // "после 3 ошибок"
 */
export function useT() {
  const locale = useAppStore((s) => s.locale)
  const dict = dictionaries[locale] ?? dictionaries.en

  return function t(key: string, params?: Record<string, string | number>): string {
    let value = dict[key] ?? dictionaries.en[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{{${k}}}`, String(v))
      }
    }
    return value
  }
}
