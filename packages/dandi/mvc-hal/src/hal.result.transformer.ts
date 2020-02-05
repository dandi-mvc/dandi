import { Disposable } from '@dandi/common'
import { Inject, Injectable, RestrictScope } from '@dandi/core'
import { Resource, SELF_RELATION } from '@dandi/hal'
import { HttpRequest, HttpRequestQueryParamMap, HttpRequestScope, ParamMap } from '@dandi/http'
import { HttpPipelineResult, HttpPipelineResultTransformer, isHttpPipelineDataResult } from '@dandi/http-pipeline'

import { CompositionContext } from './composition-context'
import { ResourceComposer } from './resource.composer'

export const EMBED_RELS_KEY = '_embedded'

@Injectable(HttpPipelineResultTransformer, RestrictScope(HttpRequestScope))
export class HalResultTransformer implements HttpPipelineResultTransformer {
  constructor(
    @Inject(ResourceComposer) private composer: ResourceComposer,
    @Inject(HttpRequest) private request: HttpRequest,
    @Inject(HttpRequestQueryParamMap) private queryParams: ParamMap,
  ) {}

  public async transform(result: HttpPipelineResult): Promise<HttpPipelineResult> {
    if (!isHttpPipelineDataResult(result) || !Resource.isResource(result.data)) {
      return result
    }

    const embeddedRels = this.queryParams[EMBED_RELS_KEY]
    const context: CompositionContext = CompositionContext.for(
      SELF_RELATION,
      this.request.path,
      embeddedRels ? (Array.isArray(embeddedRels) ? embeddedRels : embeddedRels.split(',')) : [],
    )
    return Disposable.useAsync(context, async () => {
      const resource = await this.composer.compose(
        result.data,
        context,
      )
      return {
        data: resource,
        headers: result.headers,
      }
    })
  }
}
