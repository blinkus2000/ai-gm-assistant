<#
.SYNOPSIS
    Starts, stops, restarts, or checks the status of the AI GM Assistant background service.

.DESCRIPTION
    This script runs the FastAPI backend via run.py as a background process using cmd.exe. 
    It captures the Process ID (PID) to a `service.pid` file and pipes all stdout/stderr 
    logs to `service.log`.

    Uses "taskkill /T" behind the scenes to safely kill the Uvicorn worker sub-processes.
#>

param (
    [Parameter(Position=0, Mandatory=$true, HelpMessage="Action to perform: start, stop, restart, or status")]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action
)

$pidFile = "service.pid"
$logFile = "service.log"

function Start-ServiceScript {
    if (Test-Path $pidFile) {
        $pidValue = (Get-Content $pidFile).Trim()
        $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        if ($null -ne $process) {
            Write-Host "Service is already running with PID $pidValue"
            return
        }
    }
    
    Write-Host "Starting AI GM Assistant service..."
    # Call through cmd to redirect output to service.log
    $argsList = "/c `"python run.py > $logFile 2>&1`""
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList $argsList -WindowStyle Hidden -PassThru
    $process.Id | Out-File -FilePath $pidFile -Encoding ascii
    Write-Host "Service started in background with PID $($process.Id)."
    Write-Host "Logs are being written to $logFile"
}

function Stop-ServiceScript {
    if (Test-Path $pidFile) {
        $pidValue = (Get-Content $pidFile).Trim()
        if ([string]::IsNullOrWhiteSpace($pidValue)) {
            Remove-Item $pidFile -ErrorAction SilentlyContinue
            Write-Host "Invalid PID file removed."
            return
        }
        
        $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        if ($null -ne $process) {
            Write-Host "Stopping service with PID $pidValue and its children..."
            # taskkill /T kills child processes, ensuring uvicorn workers doing tasks also die
            taskkill /F /T /PID $pidValue | Out-Null
            Start-Sleep -Seconds 1
        } else {
            Write-Host "Process with PID $pidValue not found, but PID file exists."
        }
        Remove-Item $pidFile -ErrorAction SilentlyContinue
        Write-Host "Service stopped."
    } else {
        Write-Host "Service does not appear to be running (no PID file)."
    }
}

function Get-ServiceStatus {
    if (Test-Path $pidFile) {
        $pidValue = (Get-Content $pidFile).Trim()
        if ([string]::IsNullOrWhiteSpace($pidValue)) {
            Write-Host "PID file exists, but it's empty."
            return
        }
        
        $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        if ($null -ne $process) {
            Write-Host "Service is RUNNING with PID $pidValue."
            Write-Host "----------- Last 10 lines of $logFile -----------"
            if (Test-Path $logFile) {
                try {
                    Get-Content $logFile -Tail 10 | ForEach-Object { Write-Host "  $_" }
                } catch {
                    Write-Host "  (Could not read logs - file might be locked)"
                }
            } else {
                Write-Host "  (Log file not found)"
            }
            Write-Host "--------------------------------------------------"
        } else {
            Write-Host "Service is NOT RUNNING, but PID file exists (stale)."
        }
    } else {
        Write-Host "Service is NOT RUNNING."
    }
}

switch ($Action) {
    "start"   { Start-ServiceScript }
    "stop"    { Stop-ServiceScript }
    "restart" { Stop-ServiceScript; Start-Sleep -Seconds 1; Start-ServiceScript }
    "status"  { Get-ServiceStatus }
}
