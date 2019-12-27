import { isConstructor } from '@dandi/common'
import { getInjectableParamMetadata, methodTarget } from '@dandi/core/internal/util'

export function Optional(): ParameterDecorator {
  return function optionalDecorator(target: any, propertyName: string, paramIndex: number): void {
    const paramTarget = isConstructor(target) ? methodTarget(target) : target
    const meta = getInjectableParamMetadata(paramTarget, propertyName, paramIndex)
    meta.optional = true
  }
}
