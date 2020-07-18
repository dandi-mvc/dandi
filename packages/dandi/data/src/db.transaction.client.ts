import { Disposable } from '@dandi/common'
import { InjectionToken } from '@dandi/core'

import { DbTransactionScope } from './db-transaction-scope'
import { DbQueryable } from './db.queryable'
import { localOpinionatedToken } from './local.token'

export interface DbTransactionClient extends DbQueryable, Disposable {
  commit(): Promise<void>
  rollback(): Promise<void>
}

export const DbTransactionClient: InjectionToken<DbTransactionClient> = localOpinionatedToken<DbTransactionClient>(
  'DbTransactionClient',
  {
    multi: false,
    restrictScope: DbTransactionScope,
  },
)
