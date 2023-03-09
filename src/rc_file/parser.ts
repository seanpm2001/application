/*
 * @adonisjs/application
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { inspect } from 'node:util'

import globParent from 'glob-parent'
import * as errors from '../exceptions.js'
import { directories } from '../directories.js'
import type { AppEnvironments, MetaFileNode, PreloadNode, ProviderNode, RcFile } from '../types.js'

/**
 * Rc file parser is used to parse and validate the `.adonisrc.json` file contents.
 */
export class RcFileParser {
  /**
   * Defaults for the RcFile. This object initiates all
   * the known properties
   */
  #defaults: RcFile = {
    typescript: true,
    preloads: [],
    metaFiles: [],
    commandsAliases: {},
    commands: [],
    providers: [],
    directories: directories,
    tests: {
      suites: [],
      timeout: 2000,
      forceExit: true,
    },
    raw: {},
  }

  /**
   * RcFile merged with defaults
   */
  #rcFile: RcFile

  constructor(rcFile: Record<string, any>) {
    this.#rcFile = Object.assign(this.#defaults, rcFile)
    this.#rcFile.raw = rcFile
  }

  /**
   * An array of known environments
   */
  #knownEnvironments(): Exclude<AppEnvironments, 'unknown'>[] {
    return ['web', 'console', 'test', 'repl']
  }

  /**
   * Returns the assets bundler object
   */
  #getAssetsBundler() {
    if (!this.#rcFile.assetsBundler) {
      return
    }

    if (!this.#rcFile.assetsBundler.name) {
      throw new errors.E_MISSING_BUNDLER_NAME()
    }

    if (!this.#rcFile.assetsBundler.devServerCommand) {
      throw new errors.E_MISSING_BUNDLER_DEV_COMMAND()
    }

    if (!this.#rcFile.assetsBundler.buildCommand) {
      throw new errors.E_MISSING_BUNDLER_BUILD_COMMAND()
    }

    return {
      name: this.#rcFile.assetsBundler.name,
      devServerCommand: this.#rcFile.assetsBundler.devServerCommand,
      buildCommand: this.#rcFile.assetsBundler.buildCommand,
    }
  }

  /**
   * Returns a normalized array of preload files
   */
  #getPreloads(): PreloadNode[] {
    return this.#rcFile.preloads.map((preload: PreloadNode | string) => {
      const normalizedPreload =
        typeof preload === 'string'
          ? {
              file: preload,
              optional: false,
              environment: this.#knownEnvironments(),
            }
          : preload

      if (!normalizedPreload.file) {
        throw new errors.E_MISSING_PRELOAD_FILE([inspect(preload)])
      }

      return {
        file: normalizedPreload.file,
        environment: normalizedPreload.environment ?? this.#knownEnvironments(),
      }
    })
  }

  /**
   * Returns a normalized array of providers
   */
  #getProviders(): ProviderNode[] {
    return this.#rcFile.providers.map((provider: ProviderNode | string) => {
      const normalizedProvider =
        typeof provider === 'string'
          ? {
              file: provider,
              environment: this.#knownEnvironments(),
            }
          : provider

      if (!normalizedProvider.file) {
        throw new errors.E_MISSING_PROVIDER_FILE([inspect(provider)])
      }

      return {
        file: normalizedProvider.file,
        environment: normalizedProvider.environment ?? this.#knownEnvironments(),
      }
    })
  }

  /**
   * Returns a nornalized array of meta files
   */
  #getMetaFiles(): MetaFileNode[] {
    return this.#rcFile.metaFiles.map((pattern: MetaFileNode | string) => {
      const normalizeMetaFile =
        typeof pattern === 'string'
          ? {
              pattern: pattern,
              reloadServer: true,
            }
          : pattern

      if (!normalizeMetaFile.pattern) {
        throw new errors.E_MISSING_METAFILE_PATTERN([inspect(pattern)])
      }

      return {
        pattern: normalizeMetaFile.pattern,
        reloadServer: normalizeMetaFile.reloadServer ?? true,
      }
    })
  }

  /**
   * Returns a normalized array of test suites
   */
  #getSuites() {
    const suites = this.#rcFile.tests.suites || []

    return suites.map((suite) => {
      if (!suite.name) {
        throw new errors.E_MISSING_SUITE_NAME([inspect(suite)])
      }

      if (!suite.files) {
        throw new errors.E_MISSING_SUITE_FILES([inspect(suite)])
      }

      const files = Array.isArray(suite.files) ? [...suite.files] : [suite.files]
      return {
        name: suite.name,
        files: files,
        directories: files.map((file) => globParent(file)),
        timeout: suite.timeout,
      }
    })
  }

  /**
   * Parse and validate file contents and merge them with defaults
   */
  parse(): RcFile {
    return {
      typescript: this.#rcFile.typescript,
      ...(this.#rcFile.assetsBundler ? { assetsBundler: this.#getAssetsBundler() } : {}),
      preloads: this.#getPreloads(),
      metaFiles: this.#getMetaFiles(),
      commands: [...this.#rcFile.commands],
      directories: { ...this.#rcFile.directories },
      commandsAliases: { ...this.#rcFile.commandsAliases },
      providers: this.#getProviders(),
      tests: {
        suites: this.#getSuites(),
        timeout: this.#rcFile.tests.timeout ?? 2000,
        forceExit: this.#rcFile.tests.forceExit ?? true,
      },
      raw: this.#rcFile.raw,
    }
  }
}
