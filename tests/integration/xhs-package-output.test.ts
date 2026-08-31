import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { expect, test } from 'vitest'

test('writes ZIP entry names with forward slashes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hexagent-xhs-package-'))
  const dist = join(root, 'dist')
  const output = join(root, 'release', 'tool.zip')
  await mkdir(join(dist, 'assets'), { recursive: true })
  await writeFile(
    join(dist, 'index.html'),
    '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><script defer src="./assets/app.js"></script></head><body></body></html>',
  )
  await writeFile(join(dist, 'assets', 'app.js'), '"use strict";(function(){})();')

  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      resolve('scripts/package-xhs.ps1'),
      '-DistPath',
      dist,
      '-OutputPath',
      output,
    ],
    {
      cwd: resolve('.'),
      encoding: 'utf8',
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'psmodulepath'),
      ),
    },
  )
  expect(result.status, result.stderr || result.stdout).toBe(0)

  const zipBytes = await readFile(output)
  expect(zipBytes.toString('latin1')).toContain('assets/app.js')
  expect(zipBytes.toString('latin1')).not.toContain('assets\\app.js')
})
