import { Constructor, MethodTarget } from '@dandi/common'
import { getMemberMetadata } from '@dandi/model'

import { getResourceMetadata } from './resource.metadata'

export const SELF_RELATION = 'self'
export const ITEMS_RELATION = '_items'

export function relationDecorator(
  resource: Constructor<any>,
  rel: string,
  list: boolean,
  target: MethodTarget<any>,
  propertyKey: string,
): void {
  const meta = getResourceMetadata(target.constructor)
  let relMeta = meta.relations[rel || propertyKey]
  if (!relMeta) {
    relMeta = { resource, list }
    meta.relations[rel || propertyKey] = relMeta
  } else {
    relMeta.list = list
    if (!resource) {
      return
    }
    if (relMeta.resource) {
      if (relMeta.resource !== resource) {
        throw new Error('resource mismatch')
      }
    } else {
      relMeta.resource = resource
    }
  }

  const memberMeta = getMemberMetadata(target, propertyKey)
  memberMeta.sourceAccessor = `_embedded.${rel || propertyKey}`
}

export function Relation(resource?: Constructor<any>, rel?: string): PropertyDecorator {
  return relationDecorator.bind(null, resource, rel, false)
}

export function ListRelation(resource?: Constructor<any>, rel?: string): PropertyDecorator {
  return relationDecorator.bind(null, resource, rel, true)
}
