import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { prepareXhsBuild } from '../../scripts/prepare-xhs-build.mjs'

async function makeBuild(html: string) {
  const root = await mkdtemp(join(tmpdir(), 'hexagent-xhs-prepare-'))
  await mkdir(join(root, 'assets'))
  await writeFile(join(root, 'index.html'), html)
  await writeFile(join(root, 'assets', 'app.js'), 'const ready = true')
  return root
}

describe('prepareXhsBuild', () => {
  it('converts the single Vite module entry into a deferred classic script', async () => {
    const root = await makeBuild(
      '<!doctype html><script type="module" crossorigin src="./assets/app.js"></script>',
    )

    await expect(prepareXhsBuild(root)).resolves.toEqual({ entry: './assets/app.js' })
    await expect(readFile(join(root, 'index.html'), 'utf8')).resolves.toBe(
      '<!doctype html><script defer src="./assets/app.js"></script>',
    )
  })

  it.each([
    ['zero', '<!doctype html><main></main>'],
    [
      'multiple',
      '<script type="module" src="./a.js"></script><script type="module" src="./b.js"></script>',
    ],
  ])('rejects %s module entries', async (_name, html) => {
    const root = await makeBuild(html)

    await expect(prepareXhsBuild(root)).rejects.toThrow(/exactly one module entry/i)
  })

  it('rejects a module entry without a dot-relative source', async () => {
    const root = await makeBuild('<script type="module" src="/assets/app.js"></script>')

    await expect(prepareXhsBuild(root)).rejects.toThrow(/\.\/ relative path/i)
  })

  it('does not textually rewrite JavaScript strings or member expressions', async () => {
    const root = await makeBuild('<script type="module" src="./assets/app.js"></script>')
    const source =
      'const label = "navigator.connection"; const speed = navigator.connection?.downlink'
    await writeFile(
      join(root, 'assets', 'app.js'),
      source,
    )

    await prepareXhsBuild(root)

    await expect(readFile(join(root, 'assets', 'app.js'), 'utf8')).resolves.toBe(source)
  })
})
