import { ControllerResult } from './controller.result'

const CONTENT_TYPE = 'application/json'

export class JsonControllerResult implements ControllerResult {
  public get value(): string {
    return JSON.stringify(this.resultObject)
  }

  public get contentType(): string {
    return CONTENT_TYPE
  }

  constructor(public readonly resultObject: any, public readonly headers?: { [headerName: string]: string }) {}
}
