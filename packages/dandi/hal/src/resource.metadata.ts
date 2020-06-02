import { Constructor, getMetadata, isConstructor } from '@dandi/common'

import { globalSymbol } from './global.symbol'

interface ResourceDescriptor {
  resourceKey: string
}

function isResourceDescriptor(obj: any): obj is ResourceDescriptor {
  return obj && typeof obj.resourceKey === 'string'
}

export function resourceMetaKey(target: Constructor): symbol {
  const name = isResourceDescriptor(target) ? target.resourceKey : target.name
  return globalSymbol(`meta:Resource:${name}`)
}

export interface ResourceAccessorMetadata {
  resource?: Constructor
  controller: Constructor
  method: string
  paramMap: { [paramIndex: number]: Constructor }
}

export interface ResourceMetadata {
  resource: Constructor
  idProperty?: string
  getAccessor?: ResourceAccessorMetadata
  listAccessor?: ResourceAccessorMetadata
  relations: { [rel: string]: ResourceRelationMetadata }
  parent?: ResourceMetadata
}

export interface ResourceRelationMetadata {
  resource: Constructor
  list?: boolean
  idProperty?: string
}

export class CompositeResourceMetadata implements ResourceMetadata {
  public resource: Constructor
  public idProperty: string
  public getAccessor: ResourceAccessorMetadata
  public listAccessor: ResourceAccessorMetadata
  public relations: { [rel: string]: ResourceRelationMetadata }

  public constructor(source: ResourceMetadata) {
    this.resource = source.resource
    this.idProperty = this.getPropertyValue(source, 'idProperty')
    this.getAccessor = this.getPropertyValue(source, 'getAccessor')
    this.listAccessor = this.getPropertyValue(source, 'listAccessor')
    this.relations = this.mergePropertyValues(source, 'relations', {})
  }

  private getPropertyValue(source: ResourceMetadata, prop: keyof ResourceMetadata): any {
    if (source[prop]) {
      return source[prop]
    }
    if (source.parent) {
      return this.getPropertyValue(source.parent, prop)
    }
    return undefined
  }

  private mergePropertyValues(source: ResourceMetadata, prop: keyof ResourceMetadata, value: any): any {
    if (source.parent) {
      this.mergePropertyValues(source.parent, prop, value)
    }
    return Object.assign(value, source[prop], value)
  }
}

export function getResourceMetadata(obj: any): ResourceMetadata {
  const target = isConstructor(obj) ? obj : (obj.constructor as Constructor)
  return getMetadata<ResourceMetadata>(
    resourceMetaKey(target),
    () => {
      const meta: ResourceMetadata = { resource: target, relations: {} }
      const targetParent = Object.getPrototypeOf(target)
      if (targetParent !== Object && targetParent.name) {
        meta.parent = getResourceMetadata(targetParent)
      }
      return new CompositeResourceMetadata(meta)
    },
    target,
  )
}
