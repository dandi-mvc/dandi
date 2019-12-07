import { localOpinionatedToken } from './local.token'

export interface StageVariables {
  [name: string]: string
}

export const StageVariables = localOpinionatedToken<StageVariables>('StageVariables', {
  singleton: false,
  multi: false,
})
