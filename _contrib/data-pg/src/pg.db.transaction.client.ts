import { AppError, Constructor, Disposable } from '@dandi/common';
import { Inject, Injectable, Logger, Optional } from '@dandi/core';
import { DbTransactionClient } from '@dandi/data';
import { ModelBuilder, ModelBuilderOptions } from '@dandi/model-builder';

import { PgDbPoolClient } from './pg.db.pool.client';
import { PgDbTransactionQueryError } from './pg.db.query.error';
import { PgDbQueryableBase } from './pg.db.queryable';
import { PgDbModelBuilderOptions } from './pg.db.model.builder.options';

enum TransactionState {
  begin = 'BEGIN',
  commit = 'COMMIT',
  rollback = 'ROLLBACK',
}

export class TransactionRollbackError extends AppError {
  constructor(rollbackError: Error, public readonly originalError?: Error) {
    super('Error rolling back transaction', rollbackError);
  }
}

@Injectable(DbTransactionClient)
export class PgDbTransactionClient extends PgDbQueryableBase<PgDbPoolClient> implements DbTransactionClient {
  private state: TransactionState;

  constructor(
    @Inject(PgDbPoolClient) client: PgDbPoolClient,
    @Inject(ModelBuilder) modelValidator: ModelBuilder,
    @Inject(Logger) private logger: Logger,
    @Inject(PgDbModelBuilderOptions)
    @Optional()
    modelBuilderOptions?: ModelBuilderOptions,
  ) {
    super(client, modelValidator, modelBuilderOptions);
  }

  public async query(cmd: string, ...args: any[]): Promise<any[]> {
    if (!this.state) {
      this.state = TransactionState.begin;
      await super.query(TransactionState.begin);
    }
    try {
      return await super.query(cmd, ...args);
    } catch (err) {
      await this.rollback();
      throw err;
    }
  }

  public async queryModel<T>(model: Constructor<T>, cmd: string, ...args: any[]): Promise<T[]> {
    if (!this.state) {
      this.state = TransactionState.begin;
      await super.query(TransactionState.begin);
    }
    try {
      return await super.queryModel<T>(model, cmd, ...args);
    } catch (err) {
      await this.rollback();
      throw new PgDbTransactionQueryError(err);
    }
  }

  public async rollback(err?: Error): Promise<void> {
    this.state = TransactionState.rollback;
    try {
      await super.query(TransactionState.rollback);
    } catch (rollbackError) {
      this.logger.error('error rolling back transaction', rollbackError);
      throw new TransactionRollbackError(rollbackError, err);
    }
    if (err) {
      throw err;
    }
  }

  public async commit(): Promise<void> {
    this.state = TransactionState.commit;
    try {
      await super.query(TransactionState.commit);
    } catch (err) {
      this.logger.warn('error committing transaction', err);
      await this.rollback(err);
    }
  }

  public async dispose(reason: string): Promise<void> {
    try {
      if (this.state === TransactionState.begin) {
        await this.commit();
      }
    } catch (err) {
      throw err;
    } finally {
      this.client.dispose(reason);
      Disposable.remapDisposed(this, reason);
    }
  }
}
