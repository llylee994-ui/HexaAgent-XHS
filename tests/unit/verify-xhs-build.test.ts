import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanBuild } from '../../scripts/verify-xhs-build.mjs'

describe('scanBuild', () => {
  it('reports forbidden capabilities in built assets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hexagent-xhs-build-'))
    await mkdir(join(root, 'assets'))
    await writeFile(
      join(root, 'index.html'),
      '<!doctype html><script>inline content</script><script src="./assets/app.js"></script>',
    )
    await writeFile(
      join(root, 'assets', 'app.js'),
      [
        'const remote = "https://example.com/data"',
        'fetch("./data.json")',
        'new Worker("worker.js")',
        'WebAssembly.instantiate(buffer)',
      ].join('\n'),
    )

    const violations = await scanBuild(root)

    expect(violations.map(({ rule }) => rule)).toEqual(
      expect.arrayContaining([
        'external-url',
        'network-api',
        'worker',
        'webassembly',
        'inline-script',
      ]),
    )
  })

  it('allows local assets and external-looking text in JSON content', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hexagent-xhs-safe-'))
    await mkdir(join(root, 'assets'))
    await writeFile(
      join(root, 'index.html'),
      '<!doctype html><script src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css">',
    )
    await writeFile(join(root, 'assets', 'app.js'), 'const path = "./data.json"')
    await writeFile(join(root, 'assets', 'app.css'), 'body { color: black; }')
    await writeFile(join(root, 'assets', 'copy.json'), JSON.stringify({ text: '请勿联网' }))

    await expect(scanBuild(root)).resolves.toEqual([])
  })
})
