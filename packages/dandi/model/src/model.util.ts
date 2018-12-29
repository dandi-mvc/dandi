import { Constructor, Url, Uuid } from '@dandi/common'
import { DateTime } from 'luxon'

import { MemberMetadata, getAllKeys, getModelMetadata } from './member.metadata'

export const NO_RECURSION: Array<Constructor<any>> = [Array, Boolean, DateTime, Number, String, Url, Uuid]

export type PropertyNameFormatter = (property: string) => string
export type RecursionFilter<TMetadata extends MemberMetadata> = (meta: TMetadata) => boolean

const DEFAULT_FORMATTER: PropertyNameFormatter = (prop: string): string => prop

export interface PathListOptions {
  formatter?: PropertyNameFormatter;
  maxDepth?: number;
  recursionFilter?: RecursionFilter<MemberMetadata>;
}

export class ModelUtil {
  public static generatePathList<T>(model: Constructor<T>, options: PathListOptions = {}): string[] {
    if (!options.formatter) {
      options.formatter = DEFAULT_FORMATTER
    }
    return ModelUtil.walkModel(model, '', options)
  }

  private static walkModel<T>(
    model: Constructor<T>,
    parentPath: string,
    options: PathListOptions,
    depth = 1,
  ): string[] {
    const meta = getModelMetadata(model)
    const prefix = parentPath ? `${parentPath}.` : ''
    return getAllKeys(meta).reduce((result, prop) => {
      const memberMeta = meta[prop]
      const path = `${prefix}${options.formatter(prop)}`
      const canRecurse = !options.recursionFilter || options.recursionFilter(memberMeta)
      const isNonRecursive = NO_RECURSION.includes(memberMeta.type)
      if (!canRecurse || !memberMeta.type || isNonRecursive || depth === options.maxDepth) {
        result.push(path)
      } else {
        result.push(...ModelUtil.walkModel(memberMeta.type, path, options, depth + 1))
      }
      return result
    }, [])
  }
}
