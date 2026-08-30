import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODULE_SCRIPT_PATTERN = /<script\b([^>]*)>\s*<\/script\s*>/gi

export async function prepareXhsBuild(root) {
  const indexPath = resolve(root, 'index.html')
  const html = await readFile(indexPath, 'utf8')
  const moduleEntries = [...html.matchAll(MODULE_SCRIPT_PATTERN)].filter((match) =>
    /\btype\s*=\s*["']module["']/i.test(match[1]),
  )

  if (moduleEntries.length !== 1) {
    throw new Error(`Expected exactly one module entry, found ${moduleEntries.length}`)
  }

  const [entry] = moduleEntries
  const src = entry[1].match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]
  if (!src?.startsWith('./')) {
    throw new Error('Module entry must use a ./ relative path')
  }

  const entryPath = resolve(root, src)
  const entryRelativePath = relative(resolve(root), entryPath)
  if (entryRelativePath === '..' || entryRelativePath.startsWith(`..\\`) || entryRelativePath.startsWith('../')) {
    throw new Error('Module entry must stay within the build root')
  }

  const bundle = await readFile(entryPath, 'utf8')
  const sanitizedBundle = bundle.replaceAll('navigator.connection', 'undefined')
  const preparedHtml = html.replace(entry[0], `<script defer src="${src}"></script>`)
  if (sanitizedBundle !== bundle) {
    await writeFile(entryPath, sanitizedBundle)
  }
  await writeFile(indexPath, preparedHtml)

  return { entry: src }
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const root = process.argv[2] ?? 'dist'
  const { entry } = await prepareXhsBuild(root)
  console.log(`Prepared classic entry: ${entry}`)
}
