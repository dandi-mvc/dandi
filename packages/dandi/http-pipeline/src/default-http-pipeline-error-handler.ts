import { AppError } from '@dandi/common'
import { Injectable } from '@dandi/core'
import { HttpStatusCode, isRequestError, RequestError } from '@dandi/http'

import { HttpPipelineErrorResult } from './http-pipeline-error-result'
import { HttpPipelineErrorResultHandler } from './http-pipeline-error-result-handler'

function getRequestError(error: Error): RequestError {
  if (isRequestError(error)) {
    return error
  }
  if (error instanceof AppError) {
    return getRequestError(error.innerError)
  }

  return undefined
}

@Injectable(HttpPipelineErrorResultHandler)
export class DefaultHttpPipelineErrorHandler implements HttpPipelineErrorResultHandler {

  public async handleError(result: HttpPipelineErrorResult): Promise<HttpPipelineErrorResult> {
    const [error] = result.errors
    const requestError = getRequestError(error)
    return {
      statusCode: requestError?.statusCode || HttpStatusCode.internalServerError,
      headers: result.headers,
      errors: result.errors,
      data: error?.stack || result.data,
    }
  }

}
