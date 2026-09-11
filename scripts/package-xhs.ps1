[CmdletBinding()]
param(
    [string]$DistPath = "dist",
    # 留空时按 package.json 的 version 生成 release/wenyao-xhs-<版本>.zip
    [string]$OutputPath = "",
    [string]$IconPath = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $projectRoot "package.json"
$packageVersion = [string]((Get-Content -LiteralPath $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json).version)
if ([string]::IsNullOrWhiteSpace($packageVersion)) {
    throw "Could not read the release version from $packageJsonPath"
}
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
    $image = $null
    try {
        try {
            $image = [System.Drawing.Image]::FromStream($stream, $true, $true)
        }
        catch {
            throw "Icon is not a valid decodable PNG file: $PathValue"
        }
        if ($image.RawFormat.Guid -ne [System.Drawing.Imaging.ImageFormat]::Png.Guid) {
            throw "Icon must be a PNG file: $PathValue"
        }
        return @{ Width = $image.Width; Height = $image.Height }
    }
    finally {
        if ($null -ne $image) {
            $image.Dispose()
        }
        $stream.Dispose()
    }
}

$dist = Get-ProjectPath $DistPath
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = "release/wenyao-xhs-$packageVersion.zip"
}
$zipPath = Get-ProjectPath $OutputPath
$releaseDirectory = Split-Path -Parent $zipPath
$summaryPath = Join-Path $releaseDirectory "release-summary.md"
$indexPath = Join-Path $dist "index.html"
$temporarySuffix = [System.Guid]::NewGuid().ToString("N")
$temporaryZipPath = Join-Path $releaseDirectory (".wenyao-" + $temporarySuffix + ".zip")
$temporarySummaryPath = Join-Path $releaseDirectory (".release-summary-" + $temporarySuffix + ".md")
$backupZipPath = Join-Path $releaseDirectory (".wenyao-backup-" + $temporarySuffix + ".zip")
$backupSummaryPath = Join-Path $releaseDirectory (".release-summary-backup-" + $temporarySuffix + ".md")
$publicationStarted = $false
$publicationCompleted = $false
$zipBackedUp = $false
$summaryBackedUp = $false
$newZipPublished = $false
$newSummaryPublished = $false

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
    $zipStream = [System.IO.File]::Open(
        $temporaryZipPath,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )
    try {
        $zipArchive = New-Object System.IO.Compression.ZipArchive(
            $zipStream,
            [System.IO.Compression.ZipArchiveMode]::Create,
            $true
        )
        try {
            foreach ($file in $distFiles) {
                $entryName = (Get-RelativeFilePath $dist $file.FullName).Replace("\", "/")
                $entry = $zipArchive.CreateEntry(
                    $entryName,
                    [System.IO.Compression.CompressionLevel]::Optimal
                )
                $sourceStream = [System.IO.File]::OpenRead($file.FullName)
                $entryStream = $entry.Open()
                try {
                    $sourceStream.CopyTo($entryStream)
                }
                finally {
                    $entryStream.Dispose()
                    $sourceStream.Dispose()
                }
            }
        }
        finally {
            $zipArchive.Dispose()
        }
    }
    finally {
        $zipStream.Dispose()
    }

    $zipFile = Get-Item -LiteralPath $temporaryZipPath
    if ($zipFile.Length -gt $maxZipBytes) {
        throw "ZIP exceeds the 10MB hard limit: $($zipFile.Length) bytes"
    }

    $archive = [System.IO.Compression.ZipFile]::OpenRead($temporaryZipPath)
    try {
        $zipManifest = @{}
        foreach ($entry in $archive.Entries) {
            $entryName = $entry.FullName
            if ($entryName.Contains("\")) {
                throw "ZIP contains a backslash path separator: $entryName"
            }
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

    $zipHash = (Get-FileHash -LiteralPath $temporaryZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $sizeStatus = if ($zipFile.Length -le $recommendedZipBytes) {
        "PASS (below the 2MB recommendation)"
    }
    else {
        "PASS (below the 10MB limit, but above the 2MB recommendation)"
    }
    $fileRows = @($distNames | ForEach-Object {
        "| $_ | $($distManifest[$_].Length) | $($distManifest[$_].Sha256) |"
    }) -join [Environment]::NewLine
    $chinaOffset = [System.TimeSpan]::FromHours(8)
    $buildTime = [System.DateTimeOffset]::UtcNow.ToOffset($chinaOffset).ToString("yyyy-MM-dd HH:mm:ss zzz")

    $summary = @"
# $appName XHS release summary

- Name: $appName
- Version: $packageVersion
- Build time: $buildTime
- ZIP: $zipPath
- ZIP bytes: $($zipFile.Length)
- ZIP SHA-256: $zipHash
$iconSummary

## Listing description

> $description

## Validation

- [x] Local static build scan: 0 violations
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

- [ ] Upload the ZIP and icon to the XHS PC simulator
- [ ] Complete the device checklist in docs/xhs-review-guide.md
"@

    Set-Content -LiteralPath $temporarySummaryPath -Value $summary -Encoding UTF8
    $publicationStarted = $true
    if (Test-Path -LiteralPath $zipPath) {
        Move-Item -LiteralPath $zipPath -Destination $backupZipPath
        $zipBackedUp = $true
    }
    if (Test-Path -LiteralPath $summaryPath) {
        Move-Item -LiteralPath $summaryPath -Destination $backupSummaryPath
        $summaryBackedUp = $true
    }
    Move-Item -LiteralPath $temporaryZipPath -Destination $zipPath
    $newZipPublished = $true
    Move-Item -LiteralPath $temporarySummaryPath -Destination $summaryPath
    $newSummaryPublished = $true
    $publicationCompleted = $true
    if (Test-Path -LiteralPath $backupZipPath) {
        Remove-Item -LiteralPath $backupZipPath -Force
    }
    if (Test-Path -LiteralPath $backupSummaryPath) {
        Remove-Item -LiteralPath $backupSummaryPath -Force
    }
    Write-Output "Created ZIP: $zipPath"
    Write-Output "Created summary: $summaryPath"
    Write-Output "ZIP bytes: $($zipFile.Length)"
    Write-Output "ZIP SHA-256: $zipHash"
}
catch {
    $failureMessage = $_.Exception.Message
    if (Test-Path -LiteralPath $temporaryZipPath) {
        Remove-Item -LiteralPath $temporaryZipPath -Force
    }
    if (Test-Path -LiteralPath $temporarySummaryPath) {
        Remove-Item -LiteralPath $temporarySummaryPath -Force
    }
    $rollbackSucceeded = $false
    if ($publicationStarted -and -not $publicationCompleted) {
        try {
            if ($newZipPublished -and (Test-Path -LiteralPath $zipPath)) {
                Remove-Item -LiteralPath $zipPath -Force
            }
            if ($newSummaryPublished -and (Test-Path -LiteralPath $summaryPath)) {
                Remove-Item -LiteralPath $summaryPath -Force
            }
            if ($zipBackedUp -and (Test-Path -LiteralPath $backupZipPath)) {
                Move-Item -LiteralPath $backupZipPath -Destination $zipPath
            }
            if ($summaryBackedUp -and (Test-Path -LiteralPath $backupSummaryPath)) {
                Move-Item -LiteralPath $backupSummaryPath -Destination $summaryPath
            }
            $rollbackSucceeded = $true
        }
        catch {
            throw "$failureMessage Rollback also failed: $($_.Exception.Message)"
        }
    }
    if ($rollbackSucceeded) {
        throw "$failureMessage Previous final artifacts were restored."
    }
    throw $failureMessage
}
