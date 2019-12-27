import {
  AmbientInjectableScanner,
  AsyncFactoryProvider,
  Inject,
  Injectable,
  InjectionScope,
  Injector,
  RootInjectionScope,
  Singleton,
  SymbolToken,
} from '@dandi/core'
import { testHarnessSingle, testHarness, TestHarness } from '@dandi/core/testing'

import { expect } from 'chai'
import { stub } from 'sinon'

describe('DI Integration', function() {

  TestHarness.scopeGlobalRepository()

  const harness = testHarness()

  @Injectable()
  class TestInjectable {}

  @Injectable()
  class TestWithDependency {
    constructor(@Inject(TestInjectable) public dep: TestInjectable) {}
  }

  beforeEach(function() {
    harness.register(TestInjectable)
    harness.register(TestWithDependency)
  })

  it('injects a class injectable', async function() {

    const result = await harness.inject(TestInjectable)

    expect(result).to.exist
    expect(result).to.be.instanceof(TestInjectable)

  })

  it('injects injectable class params', async function() {

    const result = await harness.inject(TestWithDependency)

    expect(result).to.exist
    expect(result).to.be.instanceof(TestWithDependency)
    expect(result.dep).to.exist
    expect(result.dep).to.be.instanceof(TestInjectable)

  })

  it('injects a token backed by a factory provider', async function() {

    const token = SymbolToken.for('test')
    const provider = {
      provide: token,
      useFactory: stub().returns(new TestInjectable()),
    }
    harness.register(provider)

    const result = await harness.inject(token)

    expect(result).to.exist
    expect(result).to.be.instanceof(TestInjectable)
    expect(provider.useFactory).to.have.been
      .calledOnce
      .calledWithExactly()

  })

  it('injects a token backed by an async factory provider', async function() {

    const token = SymbolToken.for('test')
    async function useFactory(): Promise<TestInjectable> {
      return new TestInjectable()
    }
    const provider: AsyncFactoryProvider<TestInjectable> = {
      provide: token,
      useFactory: stub().callsFake(useFactory),
      async: true,
    }
    harness.register(provider)

    const result = await harness.inject(token)

    expect(result).to.exist
    expect(result).to.be.instanceof(TestInjectable)
    expect(provider.useFactory).to.have.been
      .calledOnce
      .calledWithExactly()

  })

  it('injects a token backed by a value provider', async function() {

    const token = SymbolToken.for('test')
    const provider = {
      provide: token,
      useValue: new TestInjectable(),
    }
    harness.register(provider)

    const result = await harness.inject(token)

    expect(result).to.exist
    expect(result).to.equal(provider.useValue)

  })

  it('provides the injection scope of the requesting entity when injecting', async function() {
    @Injectable()
    class ContextTester {
      constructor(@Inject(InjectionScope) public scope: InjectionScope) {
      }
    }

    @Injectable()
    class ContextHost {
      constructor(@Inject(ContextTester) public tester: ContextTester, @Inject(InjectionScope) public scope: InjectionScope) {
      }
    }

    harness.register(ContextHost, ContextTester)

    const result = await harness.inject(ContextHost)

    expect(result.scope).to.equal(RootInjectionScope.target)
    expect(result.tester.scope).to.equal(ContextHost)
  })

  it('provides the injection scope of the requesting entity when invoking', async function() {

    interface TestResult {
      tester: any
      context: any
    }

    @Injectable()
    class ContextTester {
      constructor(@Inject(InjectionScope) public context: InjectionScope) {
      }
    }

    class ContextHost {
      public test(@Inject(ContextTester) tester: any, @Inject(InjectionScope) context: InjectionScope): TestResult {
        return {
          tester,
          context,
        }
      }
    }

    harness.register(ContextTester)
    const instance = new ContextHost()

    const result: TestResult = await harness.invoke(instance, 'test')

    expect(result.context).to.equal(RootInjectionScope.target)
    expect(result.tester.context).to.deep.equal({
      target: instance,
      methodName: 'test',
      paramName: 'tester',
      value: 'param tester for ContextHost.test',
    })
  })

  it('does not create multiple instances of singletons', async function() {
    let id = 0
    const token = new SymbolToken('test')
    const provider = {
      provide: token,
      useFactory: stub().callsFake(() => {
        id++
        return id
      }),
      singleton: true,
    }
    harness.register(provider)

    const result1 = await harness.inject(token)
    const result2 = await harness.inject(token)

    expect(provider.useFactory).to.have.been.calledOnce
    expect(result1).to.equal(1)
    expect(result2).to.equal(1)
  })

  it('does not create multiple instances of singletons when required by different dependents', async function() {
    @Injectable(Singleton)
    class Singlejon {
    }

    @Injectable()
    class TestA {
      constructor(@Inject(Singlejon) public jon: Singlejon) {
      }
    }

    @Injectable()
    class TestB {
      constructor(@Inject(Singlejon) public jon: Singlejon) {
      }
    }
    harness.register(Singlejon, TestA, TestB)

    const result1 = await harness.inject(TestA)
    const result2 = await harness.inject(TestB)

    expect(result1.jon).to.equal(result2.jon)

  })

  it('does not create multiple instances of singletons when explicitly resolving', async function() {
    @Injectable(Singleton)
    class Singlejon {
    }

    @Injectable()
    class Test {
      constructor(@Inject(Singlejon) public jon: Singlejon) {
      }
    }

    @Injectable()
    class TestFactory {
      constructor(@Inject(Singlejon) public jon: Singlejon, @Inject(Injector) private injector: Injector) {
      }

      public async createTest(): Promise<Test> {
        return (await this.injector.inject(Test)).singleValue
      }
    }
    harness.register(Singlejon, Test, TestFactory)

    const factory = await harness.inject(TestFactory)
    const test = await factory.createTest()
    expect(factory.jon).to.equal(test.jon)

  })

  it('does not create multiple instances of singletons when invoking', async function() {
    @Injectable(Singleton)
    class Singlejon {
    }

    @Injectable()
    class Test {
      constructor(@Inject(Singlejon) public jon: Singlejon) {
      }
    }

    @Injectable()
    class TestFactory {
      constructor(@Inject(Singlejon) public jon: Singlejon) {
      }

      public async getJon(@Inject(Singlejon) jon: Singlejon): Promise<Singlejon> {
        return jon
      }
    }
    harness.register(Singlejon, Test, TestFactory)

    const factory = await harness.inject(TestFactory)
    const jon = await harness.invoke(factory, 'getJon')
    expect(jon).to.equal(factory.jon)

  })

  it('does not leak token providers outside of resolving the token', async function() {
    const token = new SymbolToken('test')
    const dep = new SymbolToken('test-dep')
    const depProvider = {
      provide: dep,
      useFactory: stub().returns(1),
    }
    const provider = {
      provide: token,
      useFactory: stub(),
      deps: [dep],
      providers: [depProvider],
    }
    harness.register(provider)

    await harness.inject(provider.provide)
    const result = await harness.inject(depProvider.provide, true)
    expect(result).not.to.exist
  })

  it('can resolve singletons from class providers', async function() {
    class TestToken {
    }

    class TestClass {
    }

    const provider = {
      provide: TestToken,
      useClass: TestClass,
      singleton: true,
    }
    harness.register(provider)

    const result = await harness.inject(TestToken)
    expect(result).to.exist
    expect(result).to.be.instanceOf(TestClass)

    const secondResult = await harness.inject(TestToken)
    expect(secondResult).to.equal(result)
  })

  it('can resolve singletons discovered on the global/ambient repository', async function() {
    @Injectable(Singleton)
    class TestClass {
    }

    const harness = await testHarnessSingle(AmbientInjectableScanner)

    const result1 = await harness.inject(TestClass)
    const result2 = await harness.inject(TestClass)

    expect(result1).to.be.instanceof(TestClass)
    expect(result1).to.equal(result2)
  })

  it('can execute nested invocations using providers from the same injector scope', async () => {
    const Token = SymbolToken.for('test')
    const provider = {
      provide: Token,
      useValue: 'foo',
    }
    @Injectable()
    class TestClassA {
      public test(@Inject(Token) token: string): string {
        return token
      }
    }
    @Injectable()
    class TestClassB {
      public async test(@Inject(TestClassA) testA: TestClassA, @Inject(Injector) injector: Injector): Promise<string> {
        return await injector.invoke(testA, 'test')
      }
    }
    class Tester {
      public async test(@Inject(TestClassB) testB: TestClassB, @Inject(Injector) injector: Injector): Promise<string> {
        return await injector.invoke(testB, 'test')
      }
    }
    const tester = new Tester()

    harness.register(TestClassA, TestClassB, provider)

    const result = await harness.invoke(tester, 'test')
    expect(result).to.equal('foo')

  })

  it('can execute nested invocations using providers from the nested injector contexts', async () => {
    const Token = SymbolToken.for('test')
    const provider = {
      provide: Token,
      useValue: 'foo',
    }
    @Injectable()
    class TestClassA {
      public test(@Inject(Token) token: string): string {
        return token
      }
    }
    @Injectable()
    class TestClassB {
      public async test(@Inject(TestClassA) testA: TestClassA, @Inject(Injector) injector: Injector): Promise<string> {
        return await injector.invoke(testA, 'test', provider)
      }
    }
    class Tester {
      public async test(@Inject(TestClassB) testB: TestClassB, @Inject(Injector) injector: Injector): Promise<string> {
        return await injector.invoke(testB, 'test', TestClassA)
      }
    }
    const tester = new Tester()

    harness.register(TestClassB)

    const result = await harness.invoke(tester, 'test')
    expect(result).to.equal('foo')

  })
})
