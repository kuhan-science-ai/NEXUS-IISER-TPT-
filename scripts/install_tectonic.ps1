$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$installDirectory = Join-Path $projectRoot '.tools\tectonic'
$workDirectory = Join-Path $env:TEMP "nexus-tectonic-install-$PID"
$archivePath = Join-Path $workDirectory 'tectonic.zip'
$downloadUrl = 'https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-pc-windows-msvc.zip'
$expectedSha256 = 'f61ce51f0b0ade1015b7de7ef368541c5424e9756ecbd0d7af97d6d48030845f'

New-Item -ItemType Directory -Force -Path $installDirectory, $workDirectory | Out-Null
Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
$actualSha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha256 -ne $expectedSha256) {
  throw "Tectonic archive checksum mismatch. Expected $expectedSha256 but received $actualSha256."
}

Expand-Archive -LiteralPath $archivePath -DestinationPath $workDirectory -Force
$tectonicExecutable = Get-ChildItem -LiteralPath $workDirectory -Filter 'tectonic.exe' -File -Recurse | Select-Object -First 1
if (-not $tectonicExecutable) { throw 'The verified Tectonic archive did not contain tectonic.exe.' }
Copy-Item -LiteralPath $tectonicExecutable.FullName -Destination (Join-Path $installDirectory 'tectonic.exe') -Force

$resolvedInstall = (Resolve-Path -LiteralPath $installDirectory).Path
$resolvedWork = (Resolve-Path -LiteralPath $workDirectory).Path
if (-not $resolvedWork.StartsWith($env:TEMP, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Refusing to remove an install work directory outside the system temporary directory.'
}
Remove-Item -LiteralPath $resolvedWork -Recurse -Force
Write-Output "Installed Tectonic at $(Join-Path $resolvedInstall 'tectonic.exe')."
