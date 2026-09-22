$ErrorActionPreference = 'Stop'

function Stop-OwnedLlamaServer {
    param([System.Diagnostics.Process]$Process)

    if ($null -eq $Process -or $Process.HasExited) {
        return
    }

    Write-Host "[AI Bracho] Stopping llama-server PID $($Process.Id)..."
    Stop-Process -Id $Process.Id -ErrorAction SilentlyContinue
    if (-not $Process.WaitForExit(5000)) {
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    }
}

function Wait-LlamaServerReady {
    param(
        [System.Diagnostics.Process]$Process,
        [string]$BaseUrl,
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $healthUrl = "$($BaseUrl.TrimEnd('/'))/health"

    while ((Get-Date) -lt $deadline) {
        if ($Process.HasExited) {
            throw "llama-server exited during startup with code $($Process.ExitCode)."
        }

        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                return
            }
        }
        catch {
            # Loading and connection failures are expected until the model is ready.
        }

        Start-Sleep -Milliseconds 500
    }

    throw "Timed out after $TimeoutSeconds seconds waiting for $healthUrl."
}

$requiredVariables = @(
    'AI_BRACHO_PROJECT_DIR',
    'AI_BRACHO_LLAMA_SERVER_EXE',
    'AI_BRACHO_MODEL_PATH',
    'AI_BRACHO_LLM_URL',
    'AI_BRACHO_STARTUP_TIMEOUT_SECONDS'
)

foreach ($name in $requiredVariables) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        Write-Error "[AI Bracho] Missing development setting: $name"
        exit 1
    }
}

if (-not (Test-Path -LiteralPath $env:AI_BRACHO_LLAMA_SERVER_EXE -PathType Leaf)) {
    Write-Error "[AI Bracho] llama-server.exe was not found: $env:AI_BRACHO_LLAMA_SERVER_EXE"
    exit 1
}

if (-not (Test-Path -LiteralPath $env:AI_BRACHO_MODEL_PATH -PathType Leaf)) {
    Write-Error "[AI Bracho] Q4 GGUF model was not found: $env:AI_BRACHO_MODEL_PATH"
    exit 1
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Error '[AI Bracho] pnpm was not found in PATH.'
    exit 1
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    $userCargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
    if (Test-Path -LiteralPath (Join-Path $userCargoBin 'cargo.exe') -PathType Leaf) {
        $env:PATH = "$userCargoBin;$env:PATH"
    }
    else {
        Write-Error '[AI Bracho] Cargo was not found in PATH.'
        exit 1
    }
}

$portProbe = [System.Net.Sockets.TcpClient]::new()
try {
    $portTask = $portProbe.ConnectAsync('127.0.0.1', 8080)
    if ($portTask.Wait(300) -and $portProbe.Connected) {
        Write-Error '[AI Bracho] Port 8080 is already in use. Stop the existing server before running dev-start.bat.'
        exit 1
    }
}
catch {
    # Connection refused means the development port is available.
}
finally {
    $portProbe.Dispose()
}

$logDirectory = Join-Path $env:AI_BRACHO_PROJECT_DIR 'runtime\.dev-logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$stdoutLog = Join-Path $logDirectory 'llama-server.stdout.log'
$stderrLog = Join-Path $logDirectory 'llama-server.stderr.log'

$serverArguments = @(
    '--model', ('"{0}"' -f $env:AI_BRACHO_MODEL_PATH),
    '--ctx-size', '4096',
    '--host', '127.0.0.1',
    '--port', '8080'
)

$llamaProcess = $null
$tauriExitCode = 1

try {
    Write-Host '[AI Bracho] Starting llama-server...'
    $llamaProcess = Start-Process `
        -FilePath $env:AI_BRACHO_LLAMA_SERVER_EXE `
        -ArgumentList $serverArguments `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru

    Write-Host "[AI Bracho] llama-server PID: $($llamaProcess.Id)"
    Write-Host '[AI Bracho] Waiting for the model API to become ready...'
    Wait-LlamaServerReady `
        -Process $llamaProcess `
        -BaseUrl $env:AI_BRACHO_LLM_URL `
        -TimeoutSeconds ([int]$env:AI_BRACHO_STARTUP_TIMEOUT_SECONDS)

    Write-Host "[AI Bracho] Local model API is ready at $env:AI_BRACHO_LLM_URL."
    Push-Location $env:AI_BRACHO_PROJECT_DIR
    try {
        & pnpm tauri dev
        $tauriExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Error "[AI Bracho] $($_.Exception.Message)"
    if (Test-Path -LiteralPath $stderrLog) {
        $serverError = Get-Content -Tail 20 -LiteralPath $stderrLog -ErrorAction SilentlyContinue
        if ($serverError) {
            Write-Host '[AI Bracho] llama-server stderr:'
            $serverError | Write-Host
        }
    }
}
finally {
    Stop-OwnedLlamaServer -Process $llamaProcess
}

exit $tauriExitCode
