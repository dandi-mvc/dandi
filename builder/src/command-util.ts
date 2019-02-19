import { dirname, resolve } from 'path'

import { Constructor } from '@dandi/common'
import { AmbientInjectableScanner, Container, LogLevel } from '@dandi/core'
import { ConsoleLogListener, LoggingModule } from '@dandi/core/logging'
import { PrettyColorsLogging } from '@dandi/logging'

import { Command } from 'commander'

import { Builder } from './builder'
import { BuilderProject } from './builder-project'
import { BuilderProjectOptions } from './builder-project-options'
import { ActionHost, Actions, CommandAction, CommandInfo } from './command-action'
import { CommandRunner } from './command-runner'
import { Publisher } from './publisher'

export type CommanderArgs = (string | Command)[]

export class CommandUtil {

  public static projectAction(actionName: keyof Actions<BuilderProject>, start: number): (...args: CommanderArgs) => Promise<void> {
    return this.action(BuilderProject, actionName, start)
  }

  public static builderAction(actionName: keyof Actions<Builder>, start: number): (...args: CommanderArgs) => Promise<void> {
    return this.action(Builder, actionName, start)
  }

  public static publisherAction(actionName: keyof Actions<Publisher>, start: number): (...args: CommanderArgs) => Promise<void> {
    return this.action(Publisher, actionName, start)
  }

  private static action<THost>(hostType: Constructor<THost>, actionName: CommandAction<THost>, start: number):
    (...args: CommanderArgs) => Promise<void> {
    return async (...args: [string | Command]): Promise<void> => {
      const cmd = args.pop() as Command
      const cmdArgs = args as string[]
      const projectPath = cmd.config ? resolve(process.cwd(), dirname(cmd.config)) : process.cwd()
      const options = { projectPath, configFile: cmd.config }
      const info: CommandInfo = {
        command: cmd,
        args: cmdArgs,
      }

      const container = new Container({
        providers: [
          AmbientInjectableScanner,
          CommandRunner,
          LoggingModule.use(
            ConsoleLogListener,
            PrettyColorsLogging.set({ filter: cmd.parent.verbose ? LogLevel.debug : LogLevel.info }),
          ),
          {
            provide: ActionHost,
            useClass: hostType,
          },
          {
            provide: CommandAction,
            useValue: actionName,
          },
          {
            provide: CommandInfo,
            useValue: info,
          },
          {
            provide: BuilderProjectOptions,
            useValue: options,
          },
        ],
      })
      await container.start(start)
    }
  }

}
