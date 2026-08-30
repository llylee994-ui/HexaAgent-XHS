import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanBuild } from '../../scripts/verify-xhs-build.mjs'

const VALID_VIEWPORT =
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">'

async function makeRoot(prefix = 'hexagent-xhs-scan-') {
  const root = await mkdtemp(join(tmpdir(), prefix))
  await mkdir(join(root, 'assets'))
  return root
}

async function writeValidIndex(root: string, extra = '') {
  await writeFile(
    join(root, 'index.html'),
    `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">${VALID_VIEWPORT}<script defer src="./assets/app.js"></script></head><body>${extra}</body></html>`,
  )
  await writeFile(join(root, 'assets', 'app.js'), 'const ready = true')
}

async function scanScript(source: string) {
  const root = await makeRoot()
  await writeValidIndex(root)
  await writeFile(join(root, 'assets', 'app.js'), source)
  return scanBuild(root)
}

describe('scanBuild', () => {
  it('reports forbidden capabilities in built assets', async () => {
    const root = await makeRoot('hexagent-xhs-build-')
    await writeFile(
      join(root, 'index.html'),
      `<!doctype html>${VALID_VIEWPORT}<script>inline content</script><script src="./assets/app.js"></script>`,
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
    const root = await makeRoot('hexagent-xhs-safe-')
    await writeFile(
      join(root, 'index.html'),
      `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">${VALID_VIEWPORT}<script defer src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css"></head></html>`,
    )
    await writeFile(join(root, 'assets', 'app.js'), 'const path = "./data.json"')
    await writeFile(join(root, 'assets', 'app.css'), 'body { color: black; }')
    await writeFile(join(root, 'assets', 'copy.json'), JSON.stringify({ text: '请勿联网' }))

    await expect(scanBuild(root)).resolves.toEqual([])
  })

  it('rejects a missing root index, extra html, and unsupported files', async () => {
    const root = await makeRoot()
    await writeFile(join(root, 'other.html'), '<!doctype html>')
    await writeFile(join(root, 'debug.map'), '{}')

    expect((await scanBuild(root)).map(({ rule }) => rule)).toEqual(
      expect.arrayContaining(['missing-root-index', 'extra-html', 'unsupported-extension']),
    )
  })

  it('rejects module scripts, invalid viewport, and non-relative assets', async () => {
    const root = await makeRoot()
    await writeFile(
      join(root, 'index.html'),
      '<!doctype html><meta name="viewport" content="width=device-width"><script type="module" src="/assets/app.js"></script>',
    )

    expect((await scanBuild(root)).map(({ rule }) => rule)).toEqual(
      expect.arrayContaining([
        'module-script',
        'invalid-viewport',
        'absolute-resource-path',
        'missing-resource',
      ]),
    )
  })

  it('rejects forbidden document constructs', async () => {
    const root = await makeRoot()
    await writeValidIndex(
      root,
      '<base href="./"><div onclick="act()"></div><a href="javascript:act()">x</a><object data="./x"></object><meta http-equiv="Content-Security-Policy" content="default-src self">',
    )

    expect((await scanBuild(root)).map(({ rule }) => rule)).toEqual(
      expect.arrayContaining([
        'base-element',
        'inline-event-handler',
        'javascript-uri',
        'object-element',
        'custom-csp',
      ]),
    )
  })

  it.each([
    ['network-api', 'fetch("./data.json")'],
    ['network-api', 'new XMLHttpRequest()'],
    ['module-syntax', 'export const value = 1'],
    ['module-syntax', 'import value from "./value.js"'],
    ['module-syntax', 'import("./value.js")'],
    ['clipboard', 'navigator.clipboard.writeText("x")'],
    ['clipboard', 'document.execCommand("copy")'],
    ['geolocation', 'navigator.geolocation.getCurrentPosition(ok)'],
    ['hardware-api', 'navigator.bluetooth.requestDevice()'],
    ['sensor', 'new DeviceMotionEvent("x")'],
    ['screen-api', 'element.requestFullscreen()'],
    ['device-api', 'navigator.getBattery()'],
    ['storage-api', 'navigator.storage.persist()'],
    ['credentials-api', 'navigator.credentials.get()'],
    ['unsupported-runtime', 'new PaymentRequest(methods, details)'],
    ['unsupported-runtime', 'new Notification("ready")'],
    ['unsupported-runtime', 'new NDEFReader()'],
    ['unsupported-runtime', 'navigator.requestMIDIAccess()'],
    ['unsupported-runtime', 'navigator.xr.requestSession("immersive-ar")'],
    ['unsupported-runtime', 'element.requestPointerLock()'],
    ['unsupported-runtime', 'navigator.keyboard.lock()'],
    ['unsupported-runtime', 'window.getScreenDetails()'],
    ['new-window', 'window.open("./x")'],
    ['prompt', 'window.prompt("x")'],
    ['navigation', 'location.assign("https://example.com")'],
  ])('reports %s for %s', async (rule, source) => {
    expect(await scanScript(source)).toContainEqual(expect.objectContaining({ rule }))
  })

  it('allows inert framework namespace strings, URL reads, and local browser storage', async () => {
    const violations = await scanScript(
      [
        'const docs = "https://react.dev/errors/"',
        'const svgNamespace = "http://www.w3.org/2000/svg"',
        'const mathNamespace = "http://www.w3.org/1998/Math/MathML"',
        'const xlinkNamespace = "http://www.w3.org/1999/xlink"',
        'const xmlNamespace = "http://www.w3.org/XML/1998/namespace"',
        'localStorage.setItem("key", "value")',
        'indexedDB.open("wenyao")',
        'const frameUrlIsText = frame.location.href === "text"',
      ].join('\n'),
    )

    expect(violations).toEqual([])
  })
})
