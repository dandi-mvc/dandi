import { Inject, Injectable } from '@dandi/core'
import { HttpResponse } from '@dandi/http'

import { HttpPipelineRendererResult } from './http-pipeline-renderer'
import { HttpPipelineTerminator } from './http-pipeline-terminator'

/**
 * An implementation of {@link HttpPipelineTerminator} that terminates a request using the {@link HttpResponse} object.
 *
 * This is the default {@link HttpPipelineTerminator} implementation included with {@link HttpPipelineModule}
 */
@Injectable(HttpPipelineTerminator)
export class HttpResponsePipelineTerminator implements HttpPipelineTerminator {

  constructor(
    @Inject(HttpResponse) private response: HttpResponse,
  ) {}

  public async terminateResponse(renderResult: HttpPipelineRendererResult): Promise<void> {
    if (renderResult.statusCode) {
      this.response.status(renderResult.statusCode)
    }
    if (renderResult.headers) {
      Object
        .keys(renderResult.headers)
        .forEach(headerName => this.response.setHeader(headerName, renderResult.headers[headerName]))
    }
    this.response
      .contentType(renderResult.contentType)
      .send(renderResult.renderedBody)
      .end()
  }

}