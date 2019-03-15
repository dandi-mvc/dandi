import { AppError } from '@dandi/common'

/**
 * Thrown when encountering errors running an application with [[DandiApplication]].
 */
export class DandiApplicationError extends AppError {
  constructor(message: string, innerError?: Error) {
    super(message, innerError)
  }
}

/**
 * Thrown when the `token` argument is `null` or `undefined` when calling [[DandiInjector]] methods.
 */
export class MissingTokenError extends DandiApplicationError {
  constructor() {
    super('The `token` argument is required')
  }
}

/**
 * Thrown when the `token` argument is is not a valid [[InjectionToken]] when calling [[DandiInjector]] methods.
 */
export class InvalidTokenError extends DandiApplicationError {
  constructor(token: any) {
    super(`${token} is not a valid injection token`)
  }
}
