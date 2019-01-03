#!/usr/bin/env ts-node

import { program } from './src/program'
import { CommandUtil } from './src/command-util'

program
  .action(CommandUtil.builderAction('build'))
  .parse(process.argv)
