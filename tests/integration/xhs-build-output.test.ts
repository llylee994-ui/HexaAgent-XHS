import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'

it(
  'builds the production entry as a strict IIFE without forbidden capability probes',
  async () => {
    const root = resolve(import.meta.dirname, '../..')
    const npmCli = process.env.npm_execpath
    expect(npmCli).toBeTruthy()
    execFileSync(process.execPath, [npmCli!, 'run', 'build'], {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'pipe',
    })

    const html = await readFile(join(root, 'dist', 'index.html'), 'utf8')
    const scriptSource = html.match(/<script\s+defer\s+src="([^"]+)"/i)?.[1]
    expect(scriptSource).toMatch(/^\.\/assets\/.*\.js$/)

    const assetFiles = await readdir(join(root, 'dist', 'assets'))
    const jsFiles = assetFiles.filter((file) => file.endsWith('.js'))
    expect(jsFiles).toHaveLength(1)

    const bundle = await readFile(join(root, 'dist', 'assets', jsFiles[0]), 'utf8')
    expect(bundle).toMatch(/^["']use strict["'];\(function\(\)\{/)
    expect(bundle).not.toContain('navigator.connection')
  },
  30_000,
)
