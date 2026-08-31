import { readdir, readFile } from 'node:fs/promises'
import { extname, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ALLOWED_EXTENSIONS = new Set([
  '.html',
  '.css',
  '.js',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.woff',
  '.woff2',
  '.json',
])
const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.svg'])
const FORBIDDEN_DIRECTORIES = new Set(['node_modules', '.git'])
const INERT_URLS = [
  'https://react.dev/errors/',
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
]

const CONTENT_RULES = [
  {
    rule: 'network-api',
    pattern:
      /\bfetch\s*\(|\bXMLHttpRequest\b|\bnew\s+(?:WebSocket|EventSource|RTCPeerConnection)\s*\(/i,
  },
  {
    rule: 'worker',
    pattern: /\bnew\s+(?:Worker|SharedWorker)\s*\(|\bnavigator\.serviceWorker\b/i,
  },
  { rule: 'webassembly', pattern: /\bWebAssembly\b|\.wasm(?:["'`?]|$)/i },
  { rule: 'eval', pattern: /\beval\s*\(/i },
  { rule: 'new-function', pattern: /\bnew\s+Function\s*\(/i },
  {
    rule: 'clipboard',
    pattern:
      /\bnavigator\.clipboard\.(?:readText|writeText)\s*\(|\bdocument\.execCommand\s*\(\s*["'](?:copy|cut|paste)["']/i,
  },
  {
    rule: 'geolocation',
    pattern: /\bnavigator\.geolocation\.(?:getCurrentPosition|watchPosition)\s*\(/i,
  },
  {
    rule: 'hardware-api',
    pattern: /\bnavigator\.(?:bluetooth|usb|hid|serial)\b/i,
  },
  {
    rule: 'sensor',
    pattern:
      /\bnew\s+(?:Accelerometer|Gyroscope|Magnetometer)\s*\(|\bDevice(?:Motion|Orientation)Event\b|["']device(?:motion|orientation)["']/i,
  },
  {
    rule: 'screen-api',
    pattern: /\.(?:getDisplayMedia|requestFullscreen|webkitRequestFullscreen)\s*\(/i,
  },
  {
    rule: 'device-api',
    pattern:
      /\bnavigator\.(?:getBattery|connection)\b|\bnavigator\.mediaDevices\.enumerateDevices\s*\(/i,
  },
  { rule: 'storage-api', pattern: /\bnavigator\.storage\.persist\s*\(/i },
  {
    rule: 'credentials-api',
    pattern: /\bnavigator\.(?:credentials|locks)\b/i,
  },
  {
    rule: 'unsupported-runtime',
    pattern:
      /\bnew\s+(?:PaymentRequest|Notification|NDEFReader)\s*\(|\bnavigator\.(?:requestMIDIAccess|xr\b|keyboard\.lock\s*\()|\.requestPointerLock\s*\(|\bwindow\.getScreenDetails\s*\(/i,
  },
  { rule: 'new-window', pattern: /\bwindow\.open\s*\(/i },
  { rule: 'prompt', pattern: /\bwindow\.prompt\s*\(/i },
  {
    rule: 'navigation',
    pattern: /\b(?:window\.)?location\.(?:href\s*=(?!=)|assign\s*\(|replace\s*\()/i,
  },
  { rule: 'download', pattern: /(?:\bdownload\s*=|\.download\s*=)/i },
  { rule: 'target-blank', pattern: /target\s*=\s*["']?_blank\b/i },
]

const HTML_RULES = [
  { rule: 'base-element', pattern: /<base\b/i },
  { rule: 'inline-event-handler', pattern: /\son[a-z]+\s*=/i },
  { rule: 'javascript-uri', pattern: /javascript\s*:/i },
  { rule: 'iframe', pattern: /<iframe\b/i },
  { rule: 'object-element', pattern: /<object\b/i },
  { rule: 'form-element', pattern: /<form\b/i },
  {
    rule: 'custom-csp',
    pattern: /<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy["']/i,
  },
  { rule: 'modulepreload', pattern: /\bmodulepreload\b/i },
]

async function listBuildFiles(root) {
  const entries = await readdir(root, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = resolve(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listBuildFiles(absolutePath)))
    } else if (entry.isFile()) {
      files.push(absolutePath)
    }
  }

  return files.sort()
}

function relativePath(root, file) {
  return relative(root, file).replaceAll('\\', '/')
}

function addViolation(violations, root, file, rule, match) {
  violations.push({
    file: relativePath(root, file) || '.',
    rule,
    match: String(match),
  })
}

function stripInertUrls(content) {
  return INERT_URLS.reduce((result, url) => result.replaceAll(url, ''), content)
}

function scanContent(root, file, content, violations) {
  const contentWithoutInertUrls = stripInertUrls(content)
  const externalUrl = contentWithoutInertUrls.match(/https?:\/\//i)
  if (externalUrl) {
    addViolation(violations, root, file, 'external-url', externalUrl[0])
  }

  for (const { rule, pattern } of CONTENT_RULES) {
    const match = content.match(pattern)
    if (match) addViolation(violations, root, file, rule, match[0])
  }

  if (extname(file).toLowerCase() === '.js') {
    scanJavaScriptSyntax(root, file, content, violations)
  }
}

function scanJavaScriptSyntax(root, file, content, violations) {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  let moduleSyntax
  let topLevelAwait

  function visit(node, functionDepth) {
    if (
      !moduleSyntax &&
      (ts.isImportDeclaration(node) ||
        ts.isImportEqualsDeclaration(node) ||
        ts.isExportDeclaration(node) ||
        ts.isExportAssignment(node) ||
        (ts.canHaveModifiers(node) &&
          ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) ||
        (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) ||
        (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword))
    ) {
      moduleSyntax = node.getText(source).slice(0, 120)
    }
    if (!topLevelAwait && functionDepth === 0 && ts.isAwaitExpression(node)) {
      topLevelAwait = node.getText(source).slice(0, 120)
    }
    if (
      !topLevelAwait &&
      functionDepth === 0 &&
      ts.isForOfStatement(node) &&
      node.awaitModifier
    ) {
      topLevelAwait = node.getText(source).slice(0, 120)
    }

    const childDepth = ts.isFunctionLike(node) ? functionDepth + 1 : functionDepth
    ts.forEachChild(node, (child) => visit(child, childDepth))
  }

  visit(source, 0)
  if (moduleSyntax) addViolation(violations, root, file, 'module-syntax', moduleSyntax)
  if (topLevelAwait) addViolation(violations, root, file, 'top-level-await', topLevelAwait)
  if (source.parseDiagnostics.length > 0) {
    addViolation(
      violations,
      root,
      file,
      'javascript-syntax',
      ts.flattenDiagnosticMessageText(source.parseDiagnostics[0].messageText, ' '),
    )
  }
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
    if (/\btype\s*=\s*["']module["']/i.test(attributes)) {
      addViolation(violations, root, file, 'module-script', scriptMatch[0])
    }
  }
}

function scanHtmlContract(root, file, content, violations) {
  for (const { rule, pattern } of HTML_RULES) {
    const match = content.match(pattern)
    if (match) addViolation(violations, root, file, rule, match[0])
  }

  scanHtmlScripts(root, file, content, violations)

  if (!/^\s*<!doctype\s+html>/i.test(content)) {
    addViolation(violations, root, file, 'missing-doctype', 'DOCTYPE html')
  }
  if (!/<html\b[^>]*\blang\s*=\s*["']zh-CN["']/i.test(content)) {
    addViolation(violations, root, file, 'invalid-lang', 'lang="zh-CN"')
  }
  if (!/<meta\b[^>]*\bcharset\s*=\s*["']?UTF-8["']?/i.test(content)) {
    addViolation(violations, root, file, 'invalid-charset', 'charset=UTF-8')
  }

  const viewport = [...content.matchAll(/<meta\b([^>]*)>/gi)]
    .map((match) => parseAttributes(match[1]))
    .find((attributes) => attributes.get('name')?.toLowerCase() === 'viewport')
    ?.get('content')
  const requiredViewportValues = ['width=device-width', 'initial-scale=1.0', 'viewport-fit=cover']
  const viewportValues = new Set(
    (viewport ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase()),
  )
  if (!viewport || requiredViewportValues.some((value) => !viewportValues.has(value))) {
    addViolation(violations, root, file, 'invalid-viewport', viewport ?? 'missing viewport')
  }
}

function parseAttributes(attributes) {
  const result = new Map()
  const pattern = /(?:^|\s)([\w:-]+)\s*=\s*(["'])(.*?)\2/g
  let match
  while ((match = pattern.exec(attributes)) !== null) {
    result.set(match[1].toLowerCase(), match[3])
  }
  return result
}

function normalizeResourcePath(buildFile, resource) {
  const withoutSuffix = resource.split(/[?#]/, 1)[0]
  let decoded = withoutSuffix
  try {
    decoded = decodeURIComponent(withoutSuffix)
  } catch {
    return null
  }
  return posix.normalize(posix.join(posix.dirname(buildFile), decoded))
}

function validateResource(root, file, resource, fileSet, violations, options = {}) {
  if (!resource || resource.startsWith('#')) return
  if (options.allowMemory && /^(?:data|blob):/i.test(resource)) return

  if (/^(?:https?:)?\/\//i.test(resource)) {
    addViolation(violations, root, file, 'external-resource', resource)
    return
  }
  if (/^(?:data|blob|javascript):/i.test(resource)) {
    addViolation(violations, root, file, 'invalid-resource-scheme', resource)
    return
  }
  if (!resource.startsWith('./')) {
    addViolation(violations, root, file, 'absolute-resource-path', resource)
  }

  const buildFile = relativePath(root, file)
  const normalized = normalizeResourcePath(buildFile, resource)
  if (!normalized || normalized === '..' || normalized.startsWith('../')) {
    addViolation(violations, root, file, 'resource-path-traversal', resource)
    return
  }
  if (!fileSet.has(normalized.replace(/^\//, ''))) {
    addViolation(violations, root, file, 'missing-resource', resource)
  }
}

function scanHtmlResources(root, file, content, fileSet, violations) {
  const elementPattern = /<([a-z][\w:-]*)\b([^>]*)>/gi
  let elementMatch

  while ((elementMatch = elementPattern.exec(content)) !== null) {
    const tag = elementMatch[1].toLowerCase()
    const attributes = parseAttributes(elementMatch[2])
    for (const attribute of ['src', 'href', 'poster', 'xlink:href']) {
      const resource = attributes.get(attribute)
      if (!resource) continue
      validateResource(root, file, resource, fileSet, violations, {
        allowMemory: ['img', 'input', 'image', 'use'].includes(tag),
      })
    }

    const srcset = attributes.get('srcset')
    if (srcset) {
      for (const resource of parseSrcsetUrls(srcset)) {
        validateResource(root, file, resource, fileSet, violations, {
          allowMemory: ['img', 'source'].includes(tag),
        })
      }
    }
  }
}

function parseSrcsetUrls(srcset) {
  const urls = []
  let index = 0
  while (index < srcset.length) {
    while (index < srcset.length && /[\s,]/.test(srcset[index])) index += 1
    if (index >= srcset.length) break

    const start = index
    const isDataUrl = srcset.slice(index).toLowerCase().startsWith('data:')
    while (
      index < srcset.length &&
      !/\s/.test(srcset[index]) &&
      (isDataUrl || srcset[index] !== ',')
    ) {
      index += 1
    }
    let url = srcset.slice(start, index)
    const trailingSeparator = isDataUrl && /,+$/.test(url)
    if (trailingSeparator) url = url.replace(/,+$/, '')
    if (url) urls.push(url)

    if (trailingSeparator) continue
    while (index < srcset.length && srcset[index] !== ',') index += 1
    if (index < srcset.length) index += 1
  }
  return urls
}

function scanCssResources(root, file, content, fileSet, violations) {
  const importMatch = content.match(/@import\b/i)
  if (importMatch) addViolation(violations, root, file, 'css-import', importMatch[0])

  const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi
  let urlMatch
  while ((urlMatch = urlPattern.exec(content)) !== null) {
    validateResource(root, file, urlMatch[1].trim(), fileSet, violations, { allowMemory: true })
  }
}

export async function scanBuild(rootInput) {
  const root = resolve(rootInput)
  const violations = []
  const files = await listBuildFiles(root)
  const fileSet = new Set(files.map((file) => relativePath(root, file)))

  if (!fileSet.has('index.html')) {
    addViolation(violations, root, resolve(root, 'index.html'), 'missing-root-index', 'index.html')
  }

  for (const file of files) {
    const buildFile = relativePath(root, file)
    const extension = extname(file).toLowerCase()
    const segments = buildFile.split('/')

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      addViolation(violations, root, file, 'unsupported-extension', extension || '(none)')
    }
    if (segments.some((segment) => FORBIDDEN_DIRECTORIES.has(segment))) {
      addViolation(violations, root, file, 'forbidden-directory', buildFile)
    }
    if (extension === '.html' && buildFile !== 'index.html') {
      addViolation(violations, root, file, 'extra-html', buildFile)
    }
    if (!TEXT_EXTENSIONS.has(extension)) continue

    const content = await readFile(file, 'utf8')
    scanContent(root, file, content, violations)

    if (extension === '.html') {
      scanHtmlContract(root, file, content, violations)
      scanHtmlResources(root, file, content, fileSet, violations)
    } else if (extension === '.svg') {
      scanHtmlResources(root, file, content, fileSet, violations)
    } else if (extension === '.css') {
      scanCssResources(root, file, content, fileSet, violations)
    }
  }

  return violations
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
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
