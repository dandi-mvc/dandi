import { extname, resolve } from 'path'

import { Constructor } from '@dandi/common'
import { Inject, Injectable, Provider, Scanner, ScannerConfig, scannerProvider } from '@dandi/core'

import { readdir, stat } from 'fs-extra'

const DEFAULT_EXTENSIONS = ['.ts', '.js']

export interface FileSystemScannerConfig {
  extensions?: string[];
  include?: RegExp | RegExp[];
}

@Injectable()
export class FileSystemScanner implements Scanner {
  public static withConfig(config: FileSystemScannerConfig[]): Provider<Scanner> {
    return scannerProvider(FileSystemScanner, config)
  }

  constructor(@Inject(ScannerConfig) private config: FileSystemScannerConfig[]) {}

  public async scan(): Promise<Array<Provider<any> | Constructor<any>>> {
    return (await Promise.all(
      this.config.map((config) => this.scanDir(config, process.cwd()),
    )))
      .reduce((result, modules) => {
        result.push(...modules)
        return result
      }, [])
  }

  private async scanDir(config: FileSystemScannerConfig, dirPath: string): Promise<any[]> {
    const files = await readdir(dirPath)
    const modules = await Promise.all(
      files.map(async (file) => {
        const stats = await stat(file)
        if (stats.isDirectory()) {
          return await this.scanDir(config, resolve(dirPath, file))
        }
        if (!stats.isFile()) {
          return
        }
        const ext = extname(file)
        if ((config.extensions || DEFAULT_EXTENSIONS).includes(ext)) {
          return require(file)
        }
      }),
    )
    return modules.reduce((result, modules) => {
      if (Array.isArray(modules)) {
        result.push(...modules)
      } else {
        result.push(module)
      }
      return result
    }, [])
  }
}
