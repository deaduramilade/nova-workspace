# Nova — start local development infrastructure (Windows)
# Usage: .\deploy\local-dev.ps1 [up|down|status]

param(
    [ValidateSet("up", "down", "status")]
    [string]$Action = "up"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

switch ($Action) {
    "up" {
        docker compose up -d postgres redis neko
        docker compose ps postgres redis neko
        Write-Host "[nova] Backend:  cd backend; uvicorn app.main:app --reload --port 8000"
        Write-Host "[nova] Frontend: cd frontend; npm run dev"
        Write-Host "[nova] App:      http://localhost:3000"
    }
    "down" {
        docker compose down
        Write-Host "[nova] Local infrastructure stopped."
    }
    "status" {
        docker compose ps postgres redis neko
    }
}