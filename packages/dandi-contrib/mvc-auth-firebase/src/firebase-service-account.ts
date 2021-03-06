import { ConfigToken } from '@dandi/config'
import { ModelBase, Property } from '@dandi/model'
import * as admin from 'firebase-admin'

export class FirebaseServiceAccount extends ModelBase implements admin.ServiceAccount {
  public static configToken(key: string): ConfigToken<FirebaseServiceAccount> {
    return {
      key,
      type: FirebaseServiceAccount,
      encrypted: true,
    }
  }

  @Property(String)
  public projectId?: string

  @Property(String)
  public clientEmail?: string

  @Property(String)
  public privateKey?: string

  // Note: cannot use @dandi/model's source mapping because the snake_case properties
  // need to be accessible to Firebase

  private get project_id(): string {
    return this.projectId
  }

  private get client_email(): string {
    return this.clientEmail
  }

  private get private_key(): string {
    return this.privateKey
  }

  constructor(source?: any) {
    super(source)
  }
}
