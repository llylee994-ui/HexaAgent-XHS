[CmdletBinding()]
param(
    [string]$DistPath = "dist",
    [string]$OutputPath = "release/wenyao-xhs-0.1.0.zip",
    [string]$IconPath = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = Split-Path -Parent $PSScriptRoot
$allowedExtensions = @(
    ".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".woff", ".woff2", ".json"
)
$maxZipBytes = 10MB
$recommendedZipBytes = 2MB
$appName = [string][char]0x95EE + [string][char]0x723B
$designPath = Join-Path $projectRoot "docs/superpowers/specs/2026-08-30-xhs-release-package-design.md"
$designText = Get-Content -LiteralPath $designPath -Raw -Encoding UTF8
$descriptionMatch = [regex]::Match($designText, "(?m)^> (.+ AI .+)$")
if (-not $descriptionMatch.Success) {
    throw "Could not read the approved listing description from $designPath"
}
$description = $descriptionMatch.Groups[1].Value

function Get-ProjectPath([string]$PathValue) {
    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $projectRoot $PathValue))
}

function Get-RelativeFilePath([string]$BasePath, [string]$FilePath) {
    $baseWithSeparator = $BasePath.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
    $baseUri = New-Object System.Uri($baseWithSeparator)
    $fileUri = New-Object System.Uri($FilePath)
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($fileUri).ToString()).Replace("\", "/")
}

function Get-StreamSha256([System.IO.Stream]$Stream) {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([System.BitConverter]::ToString($algorithm.ComputeHash($Stream))).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $algorithm.Dispose()
    }
}

function Get-PngDimensions([string]$PathValue) {
    $stream = [System.IO.File]::OpenRead($PathValue)
    try {
        $header = New-Object byte[] 24
        if ($stream.Read($header, 0, $header.Length) -ne $header.Length) {
            throw "Icon is not a complete PNG file: $PathValue"
        }
        $signature = @(137, 80, 78, 71, 13, 10, 26, 10)
        for ($index = 0; $index -lt $signature.Count; $index++) {
            if ($header[$index] -ne $signature[$index]) {
                throw "Icon must be a PNG file: $PathValue"
            }
        }
        $width = [System.Net.IPAddress]::NetworkToHostOrder([System.BitConverter]::ToInt32($header, 16))
        $height = [System.Net.IPAddress]::NetworkToHostOrder([System.BitConverter]::ToInt32($header, 20))
        return @{ Width = $width; Height = $height }
    }
    finally {
        $stream.Dispose()
    }
}

$dist = Get-ProjectPath $DistPath
$zipPath = Get-ProjectPath $OutputPath
$releaseDirectory = Split-Path -Parent $zipPath
$summaryPath = Join-Path $releaseDirectory "release-summary.md"
$indexPath = Join-Path $dist "index.html"
$zipCreated = $false

try {
    if (-not (Test-Path -LiteralPath $dist -PathType Container)) {
        throw "Build directory does not exist: $dist"
    }
    if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
        throw "Root index.html does not exist: $indexPath"
    }

    Push-Location $projectRoot
    try {
        & node "scripts/verify-xhs-build.mjs" $dist
        if ($LASTEXITCODE -ne 0) {
            throw "XHS build validation failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }

    $distFiles = @(Get-ChildItem -LiteralPath $dist -File -Recurse | Sort-Object FullName)
    if ($distFiles.Count -eq 0) {
        throw "Build directory contains no files: $dist"
    }

    $distManifest = @{}
    foreach ($file in $distFiles) {
        $relativeName = Get-RelativeFilePath $dist $file.FullName
        $distManifest[$relativeName] = @{
            Length = $file.Length
            Sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }

    New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    if (Test-Path -LiteralPath $summaryPath) {
        Remove-Item -LiteralPath $summaryPath -Force
    }
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $dist,
        $zipPath,
        [System.IO.Compression.CompressionLevel]::Optimal,
        $false
    )
    $zipCreated = $true

    $zipFile = Get-Item -LiteralPath $zipPath
    if ($zipFile.Length -gt $maxZipBytes) {
        throw "ZIP exceeds the 10MB hard limit: $($zipFile.Length) bytes"
    }

    $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $zipManifest = @{}
        foreach ($entry in $archive.Entries) {
            $entryName = $entry.FullName.Replace("\", "/")
            if ($entryName.EndsWith("/")) {
                continue
            }
            if ($entryName.StartsWith("/") -or $entryName -match "(^|/)\.\.(/|$)") {
                throw "ZIP contains an unsafe path: $entryName"
            }
            $extension = [System.IO.Path]::GetExtension($entryName).ToLowerInvariant()
            if ($allowedExtensions -notcontains $extension) {
                throw "ZIP contains an unsupported file type: $entryName"
            }

            $entryStream = $entry.Open()
            try {
                $entryHash = Get-StreamSha256 $entryStream
            }
            finally {
                $entryStream.Dispose()
            }
            $zipManifest[$entryName] = @{ Length = $entry.Length; Sha256 = $entryHash }
        }
    }
    finally {
        $archive.Dispose()
    }

    if (-not $zipManifest.ContainsKey("index.html")) {
        throw "ZIP root does not contain index.html"
    }
    $extraHtml = @($zipManifest.Keys | Where-Object {
        $_.ToLowerInvariant().EndsWith(".html") -and $_ -ne "index.html"
    })
    if ($extraHtml.Count -gt 0) {
        throw "ZIP contains extra HTML entries: $($extraHtml -join ', ')"
    }

    $distNames = @($distManifest.Keys | Sort-Object)
    $zipNames = @($zipManifest.Keys | Sort-Object)
    if (@(Compare-Object $distNames $zipNames).Count -ne 0) {
        throw "ZIP file list does not match the verified dist directory"
    }
    foreach ($name in $distNames) {
        if ($distManifest[$name].Length -ne $zipManifest[$name].Length -or
            $distManifest[$name].Sha256 -ne $zipManifest[$name].Sha256) {
            throw "ZIP entry differs from dist: $name"
        }
    }

    $iconSummary = "- Icon: not generated yet; it is not included in the runtime ZIP"
    if ($IconPath) {
        $resolvedIconPath = Get-ProjectPath $IconPath
        if (-not (Test-Path -LiteralPath $resolvedIconPath -PathType Leaf)) {
            throw "Icon does not exist: $resolvedIconPath"
        }
        $dimensions = Get-PngDimensions $resolvedIconPath
        if ($dimensions.Width -ne 512 -or $dimensions.Height -ne 512) {
            throw "Icon must be exactly 512x512; received $($dimensions.Width)x$($dimensions.Height)"
        }
        $iconHash = (Get-FileHash -LiteralPath $resolvedIconPath -Algorithm SHA256).Hash.ToLowerInvariant()
        $iconSummary = "- Icon: $resolvedIconPath (512x512 PNG; SHA-256: $iconHash; not included in runtime ZIP)"
    }

    $zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $sizeStatus = if ($zipFile.Length -le $recommendedZipBytes) {
        "PASS (below the 2MB recommendation)"
    }
    else {
        "PASS (below the 10MB limit, but above the 2MB recommendation)"
    }
    $fileRows = @($distNames | ForEach-Object {
        "| $_ | $($distManifest[$_].Length) | $($distManifest[$_].Sha256) |"
    }) -join [Environment]::NewLine
    $buildTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"

    $summary = @"
# $appName XHS release summary

- Name: $appName
- Version: 0.1.0
- Build time: $buildTime
- ZIP: $zipPath
- ZIP bytes: $($zipFile.Length)
- ZIP SHA-256: $zipHash
$iconSummary

## Listing description

> $description

## Validation

- [x] Official static build scan: 0 violations
- [x] ZIP root directly contains index.html with no dist wrapper
- [x] ZIP contains only allowed extensions
- [x] ZIP entry names, sizes, and SHA-256 values match verified dist files
- [x] ZIP size: $sizeStatus
- [x] Icon is not included in the runtime ZIP
- [x] This release does not use JSBridge

## ZIP manifest

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
$fileRows

## Next container checks

Upload the ZIP and icon to the XHS PC simulator, then complete the device checklist in docs/xhs-review-guide.md.
"@

    Set-Content -LiteralPath $summaryPath -Value $summary -Encoding UTF8
    Write-Output "Created ZIP: $zipPath"
    Write-Output "Created summary: $summaryPath"
    Write-Output "ZIP bytes: $($zipFile.Length)"
    Write-Output "ZIP SHA-256: $zipHash"
}
catch {
    if ($zipCreated -and (Test-Path -LiteralPath $zipPath)) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    throw
}
