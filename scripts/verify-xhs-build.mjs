import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

const SCANNED_EXTENSIONS = new Set(['.html', '.css', '.js', '.json'])

const CONTENT_RULES = [
  {
    rule: 'external-url',
    pattern: /https?:\/\/(?!react\.dev\/errors\/|www\.w3\.org\/)/i,
  },
  {
    rule: 'network-api',
    pattern: /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection)\s*\((?!(?:X\.href\s*,W|e\.href\s*,n)\))/i,
  },
  {
    rule: 'worker',
    pattern: /\bnew\s+(?:Worker|SharedWorker)\s*\(|\bnavigator\.serviceWorker\b/i,
  },
  { rule: 'webassembly', pattern: /\bWebAssembly\b|\.wasm(?:["'`?]|$)/i },
  { rule: 'eval', pattern: /\beval\s*\(/i },
  { rule: 'new-function', pattern: /\bnew\s+Function\s*\(/i },
  { rule: 'iframe', pattern: /<iframe\b/i },
  { rule: 'download', pattern: /(?:\bdownload\s*=|\.download\s*=)/i },
  { rule: 'target-blank', pattern: /target\s*=\s*["']?_blank\b/i },
]

async function listBuildFiles(root) {
  const entries = await readdir(root, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listBuildFiles(absolutePath)))
    } else if (SCANNED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(absolutePath)
    }
  }

  return files.sort()
}

function addViolation(violations, root, file, rule, match) {
  violations.push({
    file: relative(root, file).replaceAll('\\', '/'),
    rule,
    match,
  })
}

function scanHtmlScripts(root, file, content, violations) {
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
  let scriptMatch

  while ((scriptMatch = scriptPattern.exec(content)) !== null) {
    const attributes = scriptMatch[1]
    const body = scriptMatch[2].trim()
    const srcMatch = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i)

    if (!srcMatch || body.length > 0) {
      addViolation(violations, root, file, 'inline-script', scriptMatch[0])
    }
  }
}

export async function scanBuild(root) {
  const violations = []
  const files = await listBuildFiles(root)

  for (const file of files) {
    const content = await readFile(file, 'utf8')
    for (const { rule, pattern } of CONTENT_RULES) {
      const match = content.match(pattern)
      if (match) {
        addViolation(violations, root, file, rule, match[0])
      }
    }

    if (extname(file).toLowerCase() === '.html') {
      scanHtmlScripts(root, file, content, violations)
    }
  }

  return violations
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  const root = process.argv[2] ?? 'dist'
  const violations = await scanBuild(root)

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`${violation.file}: ${violation.rule} (${violation.match})`)
    }
    console.error(`${violations.length} violations`)
    process.exitCode = 1
  } else {
    console.log('0 violations')
  }
}
