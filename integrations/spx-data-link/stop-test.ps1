$ErrorActionPreference = 'Stop'
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$pilotRoot = Join-Path $repositoryRoot '.local\spx-data-link-test'
$processesFile = Join-Path $pilotRoot 'processes.json'
if (-not (Test-Path -LiteralPath $processesFile)) { Write-Output 'No recorded test processes.'; return }
$testProcesses = Get-Content -LiteralPath $processesFile -Raw | ConvertFrom-Json
foreach ($processInfo in @(@{ id=$testProcesses.spxPid; expected=(Join-Path $pilotRoot 'spx-server.exe') }, @{ id=$testProcesses.sourcePid; expected=$testProcesses.nodePath })) {
    $testProcess = Get-Process -Id $processInfo.id -ErrorAction SilentlyContinue
    if ($testProcess) {
        if (-not $processInfo.expected -or $testProcess.Path -ne $processInfo.expected) { throw "Process identity could not be verified for PID $($processInfo.id). Stop it manually after checking its path." }
        Stop-Process -Id $testProcess.Id
    }
}
Write-Output 'Isolated SPX and data-link service stopped. Saved test data retained.'
