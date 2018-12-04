import { Inject, Injectable, Optional } from '@dandi/core';

import { APIGatewayProxyResult } from 'aws-lambda';

import { HttpEventOptions } from './http.event.options';
import { HttpResponseInterceptor } from './http.response.interceptor';
import { LambdaResponder } from './lambda.responder';

@Injectable(LambdaResponder)
export class HttpResponder implements LambdaResponder<APIGatewayProxyResult> {
  constructor(
    @Inject(HttpResponseInterceptor)
    @Optional()
    private responseInterceptors: HttpResponseInterceptor[],
    @Inject(HttpEventOptions)
    @Optional()
    private options: HttpEventOptions,
  ) {}

  public handleError(error: Error): Promise<APIGatewayProxyResult> {
    const result = {
      statusCode: (error as any).statusCode || (this.options && this.options.errorStatusCode) || 500,
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
      }),
    };

    return this.postProcess(result);
  }

  public handleResponse(response: any): Promise<APIGatewayProxyResult> {
    const result: APIGatewayProxyResult = {
      statusCode: (this.options && this.options.successStatusCode) || 200,
      body: response === undefined || response === null ? undefined : JSON.stringify(response),
    };

    return this.postProcess(result);
  }

  private postProcess(result: APIGatewayProxyResult): Promise<APIGatewayProxyResult> {
    if (this.responseInterceptors) {
      this.responseInterceptors.forEach((int) => int.exec(result));
    }

    return Promise.resolve(result);
  }
}
