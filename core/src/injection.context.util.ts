import { InjectionContext, MethodInjectionContext } from './injection.context'
import { getTokenString } from './injection.token'
import { Provider } from './provider'
import { isClassProvider, isFactoryProvider, isValueProvider } from './provider.util'

export function getInjectionContext<T>(provider: Provider<T>): InjectionContext {
  if (isClassProvider(provider)) {
    return provider.useClass
  }
  if (isFactoryProvider(provider)) {
    if (provider.useFactory.name) {
      return provider.useFactory
    }
    return `FactoryProvider_${getTokenString(provider.provide)}`
  }
  if (isValueProvider(provider)) {
    return `ValueProvider_${getTokenString(provider.provide)}`
  }
}

export function isMethodInjectionContext(obj: any): obj is MethodInjectionContext {
  return obj && typeof obj.method === 'function' && typeof obj.instance === 'object'
}

export function getInjectionContextName(context: InjectionContext): string {
  if (isMethodInjectionContext(context)) {
    return `${context.instance.constructor.name}.${context.method.name}`
  }
  if (typeof context === 'string') {
    return context
  }
  return context && context.name
}
