import type { AppRole } from '@/lib/database.types'

export function hasRole(roles: readonly AppRole[], role: AppRole): boolean {
  return roles.includes(role)
}

export function isOwner(roles: readonly AppRole[]): boolean {
  return roles.includes('owner')
}

export function isForeman(roles: readonly AppRole[]): boolean {
  return roles.includes('prod_foreman') || roles.includes('install_foreman')
}

export function isAccountant(roles: readonly AppRole[]): boolean {
  return roles.includes('accountant')
}

export function canSeeEconomics(roles: readonly AppRole[]): boolean {
  return isOwner(roles) || isAccountant(roles)
}

export function canManageStages(roles: readonly AppRole[]): boolean {
  return isOwner(roles)
}

export function canUpdateProduction(roles: readonly AppRole[]): boolean {
  return isOwner(roles) || roles.includes('prod_foreman')
}

export function canUpdateInstallation(roles: readonly AppRole[]): boolean {
  return isOwner(roles) || roles.includes('install_foreman')
}

export function canSeeTools(roles: readonly AppRole[]): boolean {
  return isOwner(roles) || isForeman(roles)
}

export function canWriteOffTools(roles: readonly AppRole[]): boolean {
  return isOwner(roles)
}

export function canManageUsers(roles: readonly AppRole[]): boolean {
  return isOwner(roles)
}

export function homePath(roles: readonly AppRole[]): string {
  if (roles.length === 0) return '/no-access'
  if (isOwner(roles)) return '/'
  if (isForeman(roles)) return '/my'
  if (isAccountant(roles)) return '/expenses'
  return '/no-access'
}
