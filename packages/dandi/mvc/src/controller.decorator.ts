import { AppError, Constructor } from '@dandi/common'
import { Repository, injectableDecorator, RepositoryRegistrationSource } from '@dandi/core'

import { getControllerMetadata } from './controller-metadata'

export const CONTROLLER_REGISTRATION_SOURCE: RepositoryRegistrationSource = {
  constructor: Controller,
}

export interface Controller<T> {
  multi?: false | null | undefined;
  singleton?: false | null | undefined;
  path?: string;
}

export function controllerDecorator<T>(options: Controller<T>, target: Constructor<T>): void {
  injectableDecorator(null, [], target)
  const meta = getControllerMetadata(target)
  meta.path = options.path
  Repository.for(Controller).register(CONTROLLER_REGISTRATION_SOURCE, target)
}

export function Controller<T>(path: string | Controller<T>): ClassDecorator {
  if (path === null || path === undefined) {
    throw new MissingControllerPathError()
  }
  const options = typeof path === 'object' ? path : { path }
  if (options.path === null || options.path === undefined) {
    throw new MissingControllerPathError()
  }
  return controllerDecorator.bind(null, options)
}

export class MissingControllerPathError extends AppError {
  constructor() {
    super('@Controller must specify a path')
  }
}
