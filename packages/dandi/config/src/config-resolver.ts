import { isPrimitiveType } from '@dandi/common'
import { Inject, Injectable } from '@dandi/core'
import { ModelBuilder } from '@dandi/model-builder'
import { camelCase } from 'change-case'

import { ConfigClient, isAsyncConfigClient } from './config-client'
import { ConfigToken } from './config-token'
import { InvalidConfigClientError } from './invalid-config-client-error'

@Injectable()
export class ConfigResolver {
  constructor(@Inject(ModelBuilder) private validator: ModelBuilder) {}

  public async resolve<T>(client: ConfigClient, token: ConfigToken<T>): Promise<T> {
    if (token.encrypted && !client.allowsEncryption) {
      throw new InvalidConfigClientError(
        `The ConfigClient implementation ${client.constructor.name}` +
          ' does not support encrypted configuration values',
      )
    }

    const strValue: string = isAsyncConfigClient(client) ? await client.get(token) : client.get(token)
    const value = isPrimitiveType(token.type) ? strValue : JSON.parse(strValue)
    return this.validator.constructModel(token.type, value, {
      keyTransform: camelCase,
    })
  }
}
