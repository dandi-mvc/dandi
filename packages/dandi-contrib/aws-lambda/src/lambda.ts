import { Constructor, Disposable } from '@dandi/common'
import {
  DandiApplication,
  Inject,
  Injectable,
  InjectionResult,
  InjectionToken,
  Injector,
  Provider,
  Registerable,
} from '@dandi/core'
import {
  DefaultHttpRequestInfo,
  HttpPipeline,
  HttpRequestHandler,
  HttpRequestHandlerMethod,
} from '@dandi/http-pipeline'
import { Context } from 'aws-lambda'

import { AwsContext, AwsEvent } from './event-providers'
import { LambdaEventTransformer } from './lambda-event-transformer'
import { LambdaHandler } from './lambda-handler'
import { localOpinionatedToken } from './local.token'

const LambdaHandler: InjectionToken<LambdaHandler> = localOpinionatedToken('LambdaHandler', { multi: false })

export interface LambdaHandlerFn<TEvent = any, TResult = any> extends Disposable {
  (event: TEvent, context: Context): void | Promise<TResult>
}

@Injectable()
export class Lambda<TEvent, TEventData, THandler extends LambdaHandler> {

  public static handler<TEvent, TEventData, THandler extends LambdaHandler>(
    handlerServiceType: Constructor<THandler>,
    ...providers: Registerable[]
  ): LambdaHandlerFn<TEvent> {

    providers.push({
      provide: LambdaHandler,
      useClass: handlerServiceType,
    })

    const app = new DandiApplication({
      handlerServiceType,
      providers,
    })
    const injectorReady = app.start()

    let lambdaReady: Promise<InjectionResult<Lambda<TEvent, TEventData, THandler>>>
    let lambda: Lambda<TEvent, TEventData, THandler>

    const handlerFn = async (event: TEvent, context: Context): Promise<any> => {
      const injector = await injectorReady

      if (!lambdaReady) {
        lambdaReady = injector.inject(Lambda)
      }
      lambda = (await lambdaReady).singleValue

      return await lambda.handleEvent(event, context)
    }

    return Disposable.makeDisposable(handlerFn, (reason) => app.dispose(reason))
  }

  constructor(
    @Inject(Injector) private injector: Injector,
    @Inject(LambdaEventTransformer) private transformer: LambdaEventTransformer<any>,
    @Inject(HttpPipeline) private httpPipeline: HttpPipeline,
    @Inject(LambdaHandler) private handler: LambdaHandler,
  ) {}

  public async handleEvent(event: TEvent, context: Context): Promise<any> {
    const providers = this.createProviders(event, context)
    return await this.injector.invoke(this.httpPipeline, 'handleRequest', ...providers)
  }

  private createProviders(event: TEvent, context: Context): Provider<any>[] {
    return this.transformer.transform(event, context).concat([
      { provide: AwsEvent, useValue: event },
      { provide: AwsContext, useValue: context },
      {
        provide: HttpRequestHandler,
        useValue: this.handler,
      },
      {
        provide: HttpRequestHandlerMethod,
        useValue: 'handleEvent',
      },
      DefaultHttpRequestInfo,
    ])
  }
}
