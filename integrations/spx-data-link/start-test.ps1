param([string]$SpxInstallation = 'C:\SPX1.4.1', [string]$NodePath = 'node')
$ErrorActionPreference = 'Stop'
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$pilotRoot = Join-Path $repositoryRoot '.local\spx-data-link-test'
if ((Get-NetTCPConnection -LocalPort 5657 -State Listen -ErrorAction SilentlyContinue) -and (Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue)) {
    Write-Output 'The test ports are already in use. Existing test: http://127.0.0.1:5657/gc/YCSLinkTest/CurrentRound'
    return
}
foreach ($testPort in @(5657, 8787)) {
    if (Get-NetTCPConnection -LocalPort $testPort -State Listen -ErrorAction SilentlyContinue) { throw "Port $testPort is already in use. Stop the earlier test before starting another copy." }
}
& $NodePath (Join-Path $PSScriptRoot 'setup-test.mjs') $SpxInstallation
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the isolated SPX test.' }
$sourceScript = Join-Path $PSScriptRoot 'server.mjs'
$sourceProcess = Start-Process -FilePath $NodePath -ArgumentList @('"' + $sourceScript + '"') -WorkingDirectory $repositoryRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $pilotRoot 'data-service.log') -RedirectStandardError (Join-Path $pilotRoot 'data-service-error.log')
$spxProcess = Start-Process -FilePath (Join-Path $pilotRoot 'spx-server.exe') -WorkingDirectory $pilotRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $pilotRoot 'spx.log') -RedirectStandardError (Join-Path $pilotRoot 'spx-error.log')
@{ sourcePid = $sourceProcess.Id; spxPid = $spxProcess.Id; nodePath = $sourceProcess.Path } | ConvertTo-Json | Set-Content (Join-Path $pilotRoot 'processes.json')
Write-Output 'Open http://127.0.0.1:5657/gc/YCSLinkTest/CurrentRound'
Write-Output "Test process IDs: data=$($sourceProcess.Id), SPX=$($spxProcess.Id)"
