import { Constructor, getMetadata } from '@dandi/common'
import {
  ClassProvider,
  InjectionToken,
  Injector,
  Provider,
  Repository,
  RepositoryRegistrationSource,
} from '@dandi/core'
import { MimeTypeInfo, parseMimeTypes } from '@dandi/http'

import { HttpResponseRenderer } from './http-response-renderer'
import { localOpinionatedToken } from './local-token'
import { globalSymbol } from './global.symbol'

const META_KEY = globalSymbol('meta:renderer')

export const RENDERER_REGISTRATION_SOURCE: RepositoryRegistrationSource = {
  constructor: Renderer,
}

export interface RendererMetadata {
  acceptTypes: MimeTypeInfo[]
}

export interface RendererInfo {
  constructor: Constructor<HttpResponseRenderer>
  metadata: RendererMetadata
}
export const RendererInfo: InjectionToken<RendererInfo[]> = localOpinionatedToken('RendererInfo', {
  multi: false,
  singleton: true,
})

export const RendererInfoProvider: Provider<RendererInfo[]> = {
  provide: RendererInfo,
  useFactory(injector: Injector) {
    const rendererEntries = [...Repository.for(Renderer).entries() as IterableIterator<ClassProvider<HttpResponseRenderer>>]
      .filter(entry => injector.canResolve(entry.useClass))
    return rendererEntries.map((entry: ClassProvider<HttpResponseRenderer>) => {
      return {
        constructor: entry.useClass,
        metadata: getRendererMetadata(entry.useClass),
      }
    })
  },
  deps: [
    Injector,
  ],
}

export function getRendererMetadata(target: Constructor<HttpResponseRenderer>): RendererMetadata {
  return getMetadata(META_KEY, () => ({ acceptTypes: [] }), target)
}

export function rendererDecorator<T extends HttpResponseRenderer>(acceptTypes: string[], target: Constructor<T>): void {
  const meta = getRendererMetadata(target)
  meta.acceptTypes = parseMimeTypes(...acceptTypes)
  Repository.for(Renderer).register(RENDERER_REGISTRATION_SOURCE, target)
}

export function Renderer(...acceptTypes: string[]): ClassDecorator {
  return rendererDecorator.bind(null, acceptTypes)
}