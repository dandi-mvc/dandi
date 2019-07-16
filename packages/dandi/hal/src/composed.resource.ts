import { Jsonable, isJsonable } from '@dandi/common'

import { SELF_RELATION } from './relation.decorator'

export interface ComposedLink {
  href: string;
  name?: string;
}

export class ComposedResource<T> implements Jsonable {
  public readonly links: { [rel: string]: ComposedLink } = {}
  public readonly embedded: { [rel: string]: ComposedResource<any> | ComposedResource<any>[] } = {}

  constructor(public readonly entity: T) {}

  public addLink(rel: string, link: ComposedLink): this {
    this.links[rel] = link
    return this
  }

  public getLink(rel: string): ComposedLink {
    return this.links[rel]
  }

  public addSelfLink(link: ComposedLink): this {
    return this.addLink(SELF_RELATION, link)
  }

  public embedResource(rel: string, resource: ComposedResource<any> | ComposedResource<any>[]): this {
    this.embedded[rel] = resource
    return this
  }

  public getEmbedded(rel: string): ComposedResource<any> | ComposedResource<any>[] {
    return this.embedded[rel]
  }

  public hasEmbedded(rel: string): boolean {
    return !!this.embedded[rel]
  }

  public toJSON(): any {
    const entity = isJsonable(this.entity) ? this.entity.toJSON() : this.entity
    return Object.assign({ _links: this.links }, entity, this.getEmbeddedJsonObject())
  }

  private getEmbeddedJsonObject(): { [key: string]: any, _embedded?: { [key: string]: any } } {
    if (!Object.keys(this.embedded).length) {
      return {}
    }

    return {
      _embedded: Object.keys(this.embedded).reduce((result, rel) => {
        const composed = this.embedded[rel]
        result[rel] = Array.isArray(composed) ? composed.map((item) => item.toJSON()) : composed.toJSON()
        return result
      }, {}),
    }
  }
}
