import { Uuid } from '@dandi/common'
import { Inject, SymbolToken } from '@dandi/core'
import { stubHarness, stubProvider, TestInjector, underTest } from '@dandi/core/testing'
import {
  HttpMethod,
  HttpRequest,
  HttpRequestAcceptTypesProvider,
  HttpRequestPathParamMap, HttpRequestScope,
  HttpStatusCode,
  MimeTypes,
  parseMimeTypes,
} from '@dandi/http'
import { MissingParamError, PathParam } from '@dandi/http-model'
import {
  DefaultHttpPipelineErrorHandler,
  HttpPipeline,
  HttpPipelineConfig,
  HttpPipelineErrorResultHandler,
  HttpPipelineResultTransformer,
  HttpPipelineTerminator,
  HttpRequestHandler,
  HttpRequestInfo,
  HttpRequestPreparer,
  HttpRequestPreparerResult,
  HttpPipelineRenderer,
  HttpRequestHandlerMethod,
  HttpResponsePipelineTerminator,
  NativeJsonObjectRenderer, HttpPipelineResult,
} from '@dandi/http-pipeline'
import { ModelBuilderModule } from '@dandi/model-builder'

import { expect } from 'chai'
import { stub, createStubInstance, SinonStubbedInstance } from 'sinon'

describe('HttpPipeline', () => {

  const harness = stubHarness(HttpPipeline,
    ModelBuilderModule,
    HttpRequestAcceptTypesProvider,
    {
      provide: HttpRequest,
      useFactory: () => ({
        method: HttpMethod.get,
        path: '/',
        params: {},
        query: {},
        get: stub().callsFake((key: string) => {
          if (key === 'Accept') {
            return MimeTypes.applicationJson
          }
        }),
      }),
    },
    {
      provide: HttpRequestInfo,
      useFactory: () => ({
        requestId: new Uuid(),
        performance: {
          mark: stub(),
        },
      }),
    },
    {
      provide: HttpRequestPathParamMap,
      useFactory(req: HttpRequest) {
        return req.params
      },
      deps: [HttpRequest],
    },
    {
      provide: HttpPipelineRenderer,
      useFactory: () => renderer,
    },
    {
      provide: HttpPipelineTerminator,
      useFactory: () => terminator,
    },
    stubProvider(DefaultHttpPipelineErrorHandler, HttpPipelineErrorResultHandler),
  )

  function registerHandler<THandler>(instance: THandler, method: keyof THandler): void {
    harness.register(
      {
        provide: HttpRequestHandler,
        useValue: instance,
      },
      {
        provide: HttpRequestHandlerMethod,
        useValue: method,
      },
    )
  }

  function invokePipeline(): Promise<any> {
    return requestInjector.invoke(pipeline, 'handleRequest')
  }

  let pipeline: HttpPipeline
  let terminator: SinonStubbedInstance<HttpPipelineTerminator>
  let requestInjector: TestInjector
  let errorHandler: SinonStubbedInstance<HttpPipelineErrorResultHandler>
  let renderer: SinonStubbedInstance<HttpPipelineRenderer>

  beforeEach(async () => {
    renderer = createStubInstance(NativeJsonObjectRenderer)
    renderer.render.resolves({
      contentType: 'text/plain',
      renderedBody: '',
    })
    requestInjector = harness.createChild(HttpRequestScope)
    terminator = createStubInstance(HttpResponsePipelineTerminator)
    terminator.terminateResponse.returnsArg(0);
    [errorHandler] = await harness.injectMultiStub(HttpPipelineErrorResultHandler)
    errorHandler.handleError.returnsArg(0)
  })
  afterEach(() => {
    pipeline = undefined
    terminator = undefined
  })

  describe('handleRequest', () => {

    describe('no optional plugins', () => {
      beforeEach(async () => {
        pipeline = await harness.inject(HttpPipeline)
      })

      it('invokes the specified handler method', async () => {
        const spy = stub()

        class TestController {
          public async method(): Promise<any> {
            spy()
          }
        }

        registerHandler(new TestController(), 'method')

        await invokePipeline()

        expect(spy).to.have.been.called
      })

      it('calls renderer.render() with the result of the handler', async () => {
        const spy = stub()

        class TestController {
          public async method(): Promise<any> {
            spy()
            return { foo: 'yeah!' }
          }
        }

        registerHandler(new TestController(), 'method')

        await invokePipeline()

        expect(spy).to.have.been.called
        expect(renderer.render).to.have.been
          .calledOnce
          .calledWith(parseMimeTypes(MimeTypes.applicationJson), { data: { foo: 'yeah!' } })
      })

      it('sets the contentType using the renderer result', async () => {
        const result = { data: { foo: 'yeah!' }, headers: { 'x-fizzle-bizzle': 'okay' } }

        class TestController {
          public async method(): Promise<any> {
            return result
          }
        }

        registerHandler(new TestController(), 'method')
        renderer.render.returns({
          contentType: MimeTypes.applicationJson,
          renderedBody: undefined,
        })

        await invokePipeline()

        expect(terminator.terminateResponse).to.have.been.calledWith({
          contentType: MimeTypes.applicationJson,
          renderedBody: undefined,
        })
      })

      it('calls res.send() with the rendered output of the renderer result', async () => {

        const result = { data: { foo: 'yeah!' }, headers: { 'x-fizzle-bizzle': 'okay' } }

        class TestController {
          public async method(): Promise<any> {
            return result
          }
        }

        registerHandler(new TestController(), 'method')
        renderer.render.returns({
          contentType: MimeTypes.applicationJson,
          renderedBody: 'foo yeah!',
        })

        await invokePipeline()

        expect(terminator.terminateResponse).to.have.been.calledWith({
          renderedBody: 'foo yeah!',
          contentType: MimeTypes.applicationJson,
        })
      })

      it('returns an error result one of the path params is missing', async () => {

        class TestController {
          public method(@PathParam(String) someParam): any {
            return { message: 'OK', param: someParam }
          }
        }

        registerHandler(new TestController(), 'method')

        await invokePipeline()

        expect(errorHandler.handleError).to.have.been.called
        expect(errorHandler.handleError.firstCall.lastArg.errors[0]).to.be.instanceOf(MissingParamError)
      })

      it('returns a text/plain render result if the renderer throws an error', async () => {

        class TestController {
          public method(): any {
            return { message: 'OK' }
          }
        }

        registerHandler(new TestController(), 'method')
        renderer.render.rejects(new Error('Your llama is lloose!'))

        const result = await invokePipeline()

        expect(result).to.deep.equal({
          statusCode: HttpStatusCode.internalServerError,
          contentType: MimeTypes.textPlain,
          headers: undefined,
          renderedBody: 'Your llama is lloose!',
        })

      })

    })

    describe('preparers', () => {

      const testPreparerProvides = SymbolToken.for('http-pipeline-test-preparer')
      const dependentTestPreparerProvides = SymbolToken.for('http-pipeline-dependent-test-preparer')

      @HttpRequestPreparer()
      class TestPreparer implements HttpRequestPreparer {
        public async prepare(): Promise<HttpRequestPreparerResult> {
          return [{
            provide: testPreparerProvides,
            useValue: 'foo',
          }]
        }
      }

      @HttpRequestPreparer(TestPreparer)
      class DependentTestPreparer implements HttpRequestPreparer {
        public async prepare(): Promise<HttpRequestPreparerResult> {
          return [{
            provide: dependentTestPreparerProvides,
            useValue: 'bar',
          }]
        }

      }

      class TestController {
        public method(
          @Inject(testPreparerProvides) testPreparerValue: string,
          @Inject(dependentTestPreparerProvides) dependentTestPreparerValue: string,
        ): any {
          return { message: 'OK', testPreparerValue, dependentTestPreparerValue }
        }
      }

      beforeEach(async () => {
        harness.register(TestPreparer)
        registerHandler(new TestController(), 'method')
        const config = {
          before: [TestPreparer, DependentTestPreparer],
        }
        harness.register(
          {
            provide: HttpPipelineConfig,
            useFactory: () => config,
          },
          underTest(TestPreparer),
          underTest(DependentTestPreparer),
        )
        await harness.inject(TestPreparer)
        await harness.inject(DependentTestPreparer)

        pipeline = await harness.inject(HttpPipeline)
      })

      it('uses providers from preparers to invoke the handler function', async () => {
        await invokePipeline()

        expect(renderer.render.firstCall.lastArg).to.deep.equal({
          data: {
            message: 'OK',
            testPreparerValue: 'foo',
            dependentTestPreparerValue: 'bar',
          },
        })
      })

    })

    describe('transformers', () => {

      class TestController {
        public method(): any {
          return { message: 'OK' }
        }
      }

      let passThroughTransformer: SinonStubbedInstance<HttpPipelineResultTransformer>
      let throwingTransformer: HttpPipelineResultTransformer
      let identifyingTransformer: SinonStubbedInstance<HttpPipelineResultTransformer>
      let anotherThrowingTransformer: HttpPipelineResultTransformer

      beforeEach(async () => {
        registerHandler(new TestController(), 'method')
        passThroughTransformer = { transform: stub<[HttpPipelineResult], Promise<HttpPipelineResult>>().resolvesArg(0) }
        throwingTransformer = { transform: stub().rejects(new Error('Your llama is lloose!')) }
        identifyingTransformer = {
          transform: stub<[HttpPipelineResult], Promise<HttpPipelineResult>>().callsFake(async (result) => {
            result.data.testId = Math.random()
            return result
          }),
        }
        anotherThrowingTransformer = { transform: stub().rejects(new Error('Your other llama is allso lloose!'))}
        harness.register(
          { provide: HttpPipelineResultTransformer, useFactory: () => passThroughTransformer },
          { provide: HttpPipelineResultTransformer, useFactory: () => throwingTransformer },
          { provide: HttpPipelineResultTransformer, useFactory: () => identifyingTransformer },
          { provide: HttpPipelineResultTransformer, useFactory: () => anotherThrowingTransformer },
        )
        pipeline = await harness.inject(HttpPipeline)
      })

      it('invokes all transformers', async () => {
        await invokePipeline()

        expect(passThroughTransformer.transform).to.have.been.called
        expect(throwingTransformer.transform).to.have.been.called
        expect(identifyingTransformer.transform).to.have.been.called
        expect(anotherThrowingTransformer.transform).to.have.been.called
      })

      it('adds all errors to the `errors` array on the result', async () => {
        await invokePipeline()
        const result = renderer.render.firstCall.lastArg

        expect(result.errors).to.have.lengthOf(2)
      })

      it('passes the result of the each successful transformer on to the next', async () => {
        await invokePipeline()

        expect(throwingTransformer.transform).to.have.been
          .calledWith(await passThroughTransformer.transform.firstCall.returnValue)
        expect(anotherThrowingTransformer.transform).to.have.been
          .calledWith(await identifyingTransformer.transform.firstCall.returnValue)
      })

    })

  })
})
