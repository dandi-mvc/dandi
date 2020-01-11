import { InvalidAccessError } from '@dandi/common'
import {
  Inject,
  Injectable,
  Injector,
  InjectorContext,
  ResolverContext,
  RestrictScope,
} from '@dandi/core'
import {
  ComposedResource,
  ITEMS_RELATION,
  ResourceAccessorMetadata,
  ResourceMetadata,
  ResourceRelationMetadata,
  SELF_RELATION,
  getResourceMetadata,
} from '@dandi/hal'
import { HttpMethod, HttpRequest, HttpRequestScope, HttpResponse } from '@dandi/http'
import { isHttpPipelineResult, HttpRequestInfo } from '@dandi/http-pipeline'
import {
  ControllerMethodMetadata,
  RequestController,
  Route,
  RouteInitializer,
  Routes,
  getControllerMetadata,
} from '@dandi/mvc'

import { ResourceComposer } from './resource.composer'
import { CompositionContext } from './composition-context'
import { InheritedResourceType } from './accessor-resource-id-decorator'

function embedResponseAccess(): HttpResponse {
  throw new InvalidAccessError(`Response object may not be used during embedding`)
}

@Injectable(ResourceComposer, RestrictScope(HttpRequestScope))
export class DefaultResourceComposer implements ResourceComposer {
  constructor(
    @Inject(Injector) private injector: Injector,
    @Inject(RouteInitializer) private routeInitializer: RouteInitializer,
    @Inject(Routes) private routes: Route[],
    @Inject(InjectorContext) private injectorContext: ResolverContext<any>,
  ) {}

  public async compose(resource: any, context: CompositionContext): Promise<ComposedResource<any>> {
    if (!resource) {
      return null
    }

    if (Array.isArray(resource)) {
      // TODO: support pagination
      const result = new ComposedResource({ count: resource.length, total: resource.length })
      result.embedResource(
        ITEMS_RELATION,
        await Promise.all(
          resource.map((item) =>
            this.compose(
              item,
              context,
            ),
          ),
        ),
      )

      result.addSelfLink({
        href: context.path,
      })
      return result
    }

    const result = new ComposedResource(resource)
    const meta = getResourceMetadata(resource)
    context.relStack.push('self')

    Object.keys(meta.relations).forEach((rel) => {
      result.addLink(rel, { href: this.getUrl(rel, meta.relations[rel], resource) })
    })

    if (context.embeddedRels && context.embeddedRels.length) {
      const embeds = context.embeddedRels.map(async (rel) => {
        if (rel === SELF_RELATION) {
          throw new Error('Cannot embed \'self\' relation')
        }

        const dotIndex = rel.indexOf('.')
        // if the relation is nested property, we need to embed the root relation
        if (dotIndex > 0) {
          rel = rel.substring(0, dotIndex)
        }
        if (result.hasEmbedded(rel)) {
          return
        }
        const link = result.getLink(rel)
        if (!link) {
          throw new Error(`Relation '${rel}' does not exist on resource ${resource.constructor.name}`)
        }
        result.embedResource(rel, await this.executeEmbed(resource, rel, meta.relations[rel], link.href, context))
      })
      await Promise.all(embeds)
    }

    result.addSelfLink({
      href: this.getUrl(SELF_RELATION, meta, resource),
    })

    return result
  }

  private getUrl(rel, relMeta: ResourceRelationMetadata, resource: any): string {
    const relResourceMeta = getResourceMetadata(relMeta.resource)

    const accessor = relMeta.list ? relResourceMeta.listAccessor : relResourceMeta.getAccessor
    if (!accessor) {
      throw new Error(
        `Relation '${rel}' of '${relMeta.resource.name}' does not have corresponding${
          relMeta.list ? ' list' : ' resource'
        } accessor`,
      )
    }
    const controllerMeta = getControllerMetadata(accessor.controller)
    const methodMeta = controllerMeta.routeMap.get(accessor.method)
    const methodPath = this.getMethodPath(methodMeta)

    if (!methodPath) {
      return this.replacePathParams(controllerMeta.path, relResourceMeta, relMeta, accessor, resource)
    }
    const url = this.normalizePath(controllerMeta.path, methodPath)
    return this.replacePathParams(url, relResourceMeta, relMeta, accessor, resource)
  }

  private replacePathParams(
    url: string,
    relResourceMeta: ResourceMetadata,
    relMeta: ResourceRelationMetadata,
    accessor: ResourceAccessorMetadata,
    resource: any,
  ): string {
    const paramsMatch = url.match(/:\w+/g)
    if (!paramsMatch) {
      return url
    }
    const params = Array.from(new Set(paramsMatch.map((param) => param.substring(1))))
    const values = params.map((param) => this.getParamValue(resource, relResourceMeta, relMeta, param, accessor))
    const valueMap = params.reduce((map, rel, index) => {
      map[rel] = values[index]
      return map
    }, {})
    return params.reduce((result, param) => {
      return result.replace(`:${param}`, valueMap[param])
    }, url)
  }

  private getParamValue(
    resource: any,
    meta: ResourceMetadata,
    relMeta: ResourceRelationMetadata,
    param: string,
    accessor: ResourceAccessorMetadata,
  ): any {
    const paramResource = accessor.paramMap[param]
    const isSameResource =
      (paramResource === resource.constructor && relMeta.resource === paramResource) ||
      paramResource === InheritedResourceType
    const paramMeta = isSameResource ? relMeta : getResourceMetadata(paramResource)

    if (paramMeta.idProperty) {
      return resource[paramMeta.idProperty]
    }

    // TODO: is falling through to meta.idProperty the right thing to do?
    // with a list relation that requires an ID from "self", the relation metadata does not get an idProperty
    const result = resource[meta.idProperty]
    if (!result) {
      throw new Error(`Could not determine @ResourceId property on '${resource.constructor.name}' for param '${param}'`)
    }
    return result
  }

  private getMethodPath(methodMeta: ControllerMethodMetadata): string {
    for (const [path, methods] of methodMeta.routePaths) {
      if (methods.has(HttpMethod.get)) {
        return path
      }
    }

    throw new Error('Controller method does not allow GET')
  }

  private normalizePath(a: string, b: string): string {
    let result = a
    if (!a.startsWith('/')) {
      result = `/${a}`
    }
    if (!a.endsWith('/')) {
      result += '/'
    }
    result += b.startsWith('/') ? b.substring(1) : b
    return result
  }

  private async executeEmbed(
    resource: any,
    rel: string,
    relMeta: ResourceRelationMetadata,
    path: string,
    context: CompositionContext,
  ): Promise<any> {
    const meta = getResourceMetadata(relMeta.resource)
    const accessor = relMeta.list ? meta.listAccessor : meta.getAccessor
    const route = this.routes.find(
      (rt) =>
        rt.httpMethod === HttpMethod.get &&
        rt.controllerCtr === accessor.controller &&
        rt.controllerMethod === accessor.method,
    )
    const ogRequest = (await this.injector.inject(HttpRequest)).singleValue
    const requestParams = Object.keys(accessor.paramMap).reduce((params, key) => {
      params[key] = this.getParamValue(resource, meta, relMeta, key, accessor)
      return params
    }, {})
    const req: HttpRequest = {
      body: undefined,
      params: requestParams,
      path,
      query: {},
      method: HttpMethod.get,
      get(key: string) {
        return ogRequest.get(key)
      },
    }
    const res: HttpResponse = {
      cookie: embedResponseAccess,
      contentType: embedResponseAccess,
      end: embedResponseAccess,
      header: embedResponseAccess,
      json: embedResponseAccess,
      redirect: embedResponseAccess,
      send: embedResponseAccess,
      set: embedResponseAccess,
      setHeader: embedResponseAccess,
      status: embedResponseAccess,
    }

    const requestInfo = (await this.injector.inject(HttpRequestInfo)).singleValue
    const embedProviders = await this.routeInitializer.initRouteRequest(this.injector, route, req, requestInfo, res)

    embedProviders.push({
      provide: CompositionContext,
      useValue: context.childFor(rel),
    })

    return this.injector.invoke(this as DefaultResourceComposer, 'invokeController', ...embedProviders)
  }

  public async invokeController(
    @Inject(Injector) injector: Injector,
    @Inject(RequestController) controller: any,
    @Inject(Route) route: Route,
    @Inject(CompositionContext) compositionContext: CompositionContext,
  ): Promise<ComposedResource<any> | ComposedResource<any>[]> {
    const result = await injector.invoke(controller, route.controllerMethod as string)
    const resultResource: any = isHttpPipelineResult(result) ? result.data : result
    if (Array.isArray(resultResource)) {
      return Promise.all(
        resultResource.map((resource) =>
          this.compose(
            resource,
            compositionContext,
          ),
        ),
      )
    }
    return this.compose(
      resultResource,
      compositionContext,
    )
  }
}
