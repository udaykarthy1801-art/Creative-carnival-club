param([switch]$RestartApp)
$ErrorActionPreference = 'Stop'
$projectPath = $PSScriptRoot
$runtimeConfigPath = Join-Path $projectPath '.local-runtime.json'
if (-not (Test-Path -LiteralPath $runtimeConfigPath)) {
    throw 'This helper needs the local runtime configuration from the original setup. On another computer, follow README.md and run npm start.'
}
$runtimeConfig = Get-Content -LiteralPath $runtimeConfigPath -Raw | ConvertFrom-Json
$logPath = Join-Path $projectPath '.local-logs'
New-Item -ItemType Directory -Path $logPath -Force | Out-Null
$appFile = Join-Path $projectPath 'server\app.js'
$statePath = Join-Path $projectPath '.local-app.json'
if ($RestartApp -and (Test-Path -LiteralPath $statePath)) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $savedProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.pid)"
    if ($savedProcess -and $savedProcess.CommandLine.Contains($appFile)) {
        & node -e "process.kill(Number(process.argv[1]))" ([string]$state.pid)
        Start-Sleep -Milliseconds 500
    }
}
function Test-DatabasePort {
    $client = [System.Net.Sockets.TcpClient]::new()
    try { $client.Connect('127.0.0.1', 3306); return $true } catch { return $false } finally { $client.Dispose() }
}
if (-not (Test-DatabasePort)) {
    $argument = '--defaults-file="' + $runtimeConfig.defaultsFile + '"'
    Start-Process -FilePath $runtimeConfig.mysqlExecutable -ArgumentList @($argument,'--console') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logPath 'mysql-out.log') -RedirectStandardError (Join-Path $logPath 'mysql-error.log') | Out-Null
    for ($attempt=0; $attempt -lt 40; $attempt++) {
        if (Test-DatabasePort) { break }
        Start-Sleep -Milliseconds 500
    }
    if (-not (Test-DatabasePort)) { throw 'MySQL did not start. Check .local-logs/mysql-error.log.' }
}
$healthy = $false
try { $healthy = (Invoke-RestMethod 'http://127.0.0.1:5000/api/health' -TimeoutSec 3).success } catch {}
if (-not $healthy) {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $argument = '"' + $appFile + '"'
    $appProcess = Start-Process -FilePath $nodePath -ArgumentList $argument -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logPath 'app-out.log') -RedirectStandardError (Join-Path $logPath 'app-error.log')
    @{ pid = $appProcess.Id } | ConvertTo-Json | Set-Content -LiteralPath $statePath
    for ($attempt=0; $attempt -lt 40; $attempt++) {
        try { if ((Invoke-RestMethod 'http://127.0.0.1:5000/api/health' -TimeoutSec 2).success) { $healthy=$true; break } } catch {}
        Start-Sleep -Milliseconds 500
    }
    if (-not $healthy) { throw 'Application did not start. Check .local-logs/app-error.log.' }
}
Write-Output 'Creative Carnival: http://localhost:5000'
Write-Output 'Administrator: http://localhost:5000/admin.html'
Write-Output 'Choose your admin password with npm run admin:setup, then restart with this script -RestartApp.'
