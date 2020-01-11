import { Constructor } from '@dandi/common'

import { HttpPipelineResultTransformer } from './http-pipeline-result-transformer'
import { HttpPipelinePreparer } from './http-pipeline-preparer'
import { localOpinionatedToken } from './local-token'

// FIXME: define conditions for inclusion
//        does that belong here or only in MVC? provide an abstraction to allow filtering?
//        use controller decorators for path-specific before/after?
export interface HttpPipelineConfig {
  before: Constructor<HttpPipelinePreparer>[]
  after: Constructor<HttpPipelineResultTransformer>[]
}

export const HttpPipelineConfig = localOpinionatedToken<HttpPipelineConfig>('HttpPipelineConfig', {
  multi: false,
})
