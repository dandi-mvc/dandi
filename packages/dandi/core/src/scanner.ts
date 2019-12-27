import { Constructor } from '@dandi/common'

import { InjectionToken } from './injection-token'
import { localOpinionatedToken, localSymbolToken } from './local-token'
import { MultiProvider } from './provider'
import { Registerable } from './module'

export interface ScannerConstructor {
  new (config: any[]): Scanner;
}

export interface Scanner {
  scan(): Promise<Registerable[]>
}

export const Scanner: InjectionToken<Scanner> = localOpinionatedToken<Scanner>('Scanner', { multi: true })
export const ScannerConfig: InjectionToken<any[]> = localSymbolToken<any[]>('ScannerConfig')

export function scannerProvider<T extends Scanner>(
  scanner: Constructor<Scanner>,
  config: any[],
): MultiProvider<Scanner> {
  return {
    provide: Scanner,
    useClass: scanner,
    multi: true,
    providers: [
      {
        provide: ScannerConfig,
        useValue: config,
      },
    ],
  }
}
