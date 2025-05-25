# Function to print status messages
function Write-Status {
    param($Message)
    Write-Host "[✓] $Message" -ForegroundColor Green
}

function Write-Error {
    param($Message)
    Write-Host "[✗] $Message" -ForegroundColor Red
}

function Write-Warning {
    param($Message)
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

# Function to create backup
function Backup-Data {
    param(
        [string]$BackupPath = "backups",
        [switch]$FullBackup,
        [switch]$Incremental,
        [switch]$Verify,
        [switch]$Compress
    )
    
    Write-Status "Starting backup process..."
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = Join-Path $BackupPath $timestamp
    
    # Create backup directory
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    
    # Backup database
    Write-Status "Backing up database..."
    $dbBackupFile = Join-Path $backupDir "database_backup.sql"
    docker-compose exec postgres pg_dump -U omnimind -F c -b -v -f /tmp/db_backup.dump
    docker cp $(docker-compose ps -q postgres):/tmp/db_backup.dump $dbBackupFile
    
    # Backup Redis data
    Write-Status "Backing up Redis data..."
    $redisBackupFile = Join-Path $backupDir "redis_backup.rdb"
    docker-compose exec redis redis-cli SAVE
    docker cp $(docker-compose ps -q redis):/data/dump.rdb $redisBackupFile
    
    # Backup configuration files
    Write-Status "Backing up configuration files..."
    $configDir = Join-Path $backupDir "config"
    New-Item -ItemType Directory -Force -Path $configDir | Out-Null
    
    Copy-Item .env -Destination (Join-Path $configDir "env")
    Copy-Item docker-compose.yml -Destination (Join-Path $configDir "docker-compose.yml")
    Copy-Item prometheus.yml -Destination (Join-Path $configDir "prometheus.yml")
    
    # Backup Grafana data
    Write-Status "Backing up Grafana data..."
    $grafanaDir = Join-Path $backupDir "grafana"
    New-Item -ItemType Directory -Force -Path $grafanaDir | Out-Null
    
    Copy-Item "grafana/dashboards" -Destination (Join-Path $grafanaDir "dashboards") -Recurse
    Copy-Item "grafana/provisioning" -Destination (Join-Path $grafanaDir "provisioning") -Recurse
    
    # Backup Prometheus data
    Write-Status "Backing up Prometheus data..."
    $prometheusDir = Join-Path $backupDir "prometheus"
    New-Item -ItemType Directory -Force -Path $prometheusDir | Out-Null
    
    Copy-Item "prometheus_data" -Destination $prometheusDir -Recurse
    
    # Backup application data
    Write-Status "Backing up application data..."
    $appDir = Join-Path $backupDir "app"
    New-Item -ItemType Directory -Force -Path $appDir | Out-Null
    
    Copy-Item ".chroma" -Destination (Join-Path $appDir "chroma") -Recurse
    Copy-Item "logs" -Destination (Join-Path $appDir "logs") -Recurse
    
    # Create backup manifest
    $manifest = @{
        timestamp = $timestamp
        type = if ($FullBackup) { "full" } elseif ($Incremental) { "incremental" } else { "full" }
        components = @(
            "database",
            "redis",
            "config",
            "grafana",
            "prometheus",
            "app"
        )
        size = (Get-ChildItem $backupDir -Recurse | Measure-Object -Property Length -Sum).Sum
        checksum = (Get-FileHash -Path $backupDir -Algorithm SHA256).Hash
    }
    
    $manifest | ConvertTo-Json | Out-File -FilePath (Join-Path $backupDir "manifest.json") -Encoding UTF8
    
    # Verify backup if requested
    if ($Verify) {
        Write-Status "Verifying backup..."
        $verificationResults = @{
            database = Test-Path $dbBackupFile
            redis = Test-Path $redisBackupFile
            config = Test-Path (Join-Path $configDir "env")
            grafana = Test-Path (Join-Path $grafanaDir "dashboards")
            prometheus = Test-Path $prometheusDir
            app = Test-Path (Join-Path $appDir "chroma")
        }
        
        $verificationResults | ConvertTo-Json | Out-File -FilePath (Join-Path $backupDir "verification.json") -Encoding UTF8
        
        if ($verificationResults.Values -contains $false) {
            Write-Warning "Backup verification failed for some components"
        } else {
            Write-Status "Backup verification successful"
        }
    }
    
    # Compress backup if requested
    if ($Compress) {
        Write-Status "Compressing backup..."
        $zipFile = "$backupDir.zip"
        Compress-Archive -Path $backupDir -DestinationPath $zipFile -Force
        Remove-Item $backupDir -Recurse -Force
        Write-Status "Backup compressed to: $zipFile"
    }
    
    Write-Status "Backup completed successfully at: $backupDir"
    return $backupDir
}

# Function to restore from backup
function Restore-Data {
    param(
        [Parameter(Mandatory=$true)]
        [string]$BackupPath,
        [switch]$Verify,
        [switch]$DryRun
    )
    
    Write-Status "Starting restore process..."
    
    # Check if backup exists
    if (-not (Test-Path $BackupPath)) {
        Write-Error "Backup not found at: $BackupPath"
        return
    }
    
    # Read backup manifest
    $manifestPath = Join-Path $BackupPath "manifest.json"
    if (Test-Path $manifestPath) {
        $manifest = Get-Content $manifestPath | ConvertFrom-Json
        Write-Status "Restoring backup from: $($manifest.timestamp)"
    }
    
    if ($DryRun) {
        Write-Status "Dry run - would restore from: $BackupPath"
        return
    }
    
    # Stop services
    Write-Status "Stopping services..."
    docker-compose down
    
    # Restore database
    Write-Status "Restoring database..."
    $dbBackupFile = Join-Path $BackupPath "database_backup.sql"
    if (Test-Path $dbBackupFile) {
        docker-compose up -d postgres
        Start-Sleep -Seconds 10
        docker cp $dbBackupFile $(docker-compose ps -q postgres):/tmp/db_backup.dump
        docker-compose exec postgres pg_restore -U omnimind -d omnimind -v /tmp/db_backup.dump
    }
    
    # Restore Redis data
    Write-Status "Restoring Redis data..."
    $redisBackupFile = Join-Path $BackupPath "redis_backup.rdb"
    if (Test-Path $redisBackupFile) {
        docker-compose up -d redis
        Start-Sleep -Seconds 5
        docker cp $redisBackupFile $(docker-compose ps -q redis):/data/dump.rdb
        docker-compose restart redis
    }
    
    # Restore configuration files
    Write-Status "Restoring configuration files..."
    $configDir = Join-Path $BackupPath "config"
    if (Test-Path $configDir) {
        Copy-Item (Join-Path $configDir "env") .env -Force
        Copy-Item (Join-Path $configDir "docker-compose.yml") docker-compose.yml -Force
        Copy-Item (Join-Path $configDir "prometheus.yml") prometheus.yml -Force
    }
    
    # Restore Grafana data
    Write-Status "Restoring Grafana data..."
    $grafanaDir = Join-Path $BackupPath "grafana"
    if (Test-Path $grafanaDir) {
        Copy-Item (Join-Path $grafanaDir "dashboards") "grafana/dashboards" -Recurse -Force
        Copy-Item (Join-Path $grafanaDir "provisioning") "grafana/provisioning" -Recurse -Force
    }
    
    # Restore Prometheus data
    Write-Status "Restoring Prometheus data..."
    $prometheusDir = Join-Path $BackupPath "prometheus"
    if (Test-Path $prometheusDir) {
        Copy-Item $prometheusDir "prometheus_data" -Recurse -Force
    }
    
    # Restore application data
    Write-Status "Restoring application data..."
    $appDir = Join-Path $BackupPath "app"
    if (Test-Path $appDir) {
        Copy-Item (Join-Path $appDir "chroma") ".chroma" -Recurse -Force
        Copy-Item (Join-Path $appDir "logs") "logs" -Recurse -Force
    }
    
    # Start services
    Write-Status "Starting services..."
    docker-compose up -d
    
    # Verify restore if requested
    if ($Verify) {
        Write-Status "Verifying restore..."
        Start-Sleep -Seconds 30
        
        $services = @("app", "postgres", "redis", "prometheus", "grafana")
        $failedServices = @()
        
        foreach ($service in $services) {
            $status = docker-compose ps $service
            if ($status -match "Exit") {
                $failedServices += $service
            }
        }
        
        if ($failedServices.Count -gt 0) {
            Write-Warning "Restore verification failed for services: $($failedServices -join ', ')"
        } else {
            Write-Status "Restore verification successful"
        }
    }
    
    Write-Status "Restore completed successfully"
}

# Main script
param(
    [Parameter(Mandatory=$false)]
    [string]$BackupPath = "backups",
    [Parameter(Mandatory=$false)]
    [string]$RestorePath,
    [switch]$FullBackup,
    [switch]$Incremental,
    [switch]$Verify,
    [switch]$Compress,
    [switch]$DryRun,
    [switch]$ListBackups
)

# List available backups
if ($ListBackups) {
    if (Test-Path $BackupPath) {
        Write-Status "Available backups:"
        Get-ChildItem $BackupPath -Directory | ForEach-Object {
            $manifestPath = Join-Path $_.FullName "manifest.json"
            if (Test-Path $manifestPath) {
                $manifest = Get-Content $manifestPath | ConvertFrom-Json
                Write-Host "  - $($_.Name) ($($manifest.type) backup, $([math]::Round($manifest.size/1MB, 2)) MB)"
            } else {
                Write-Host "  - $($_.Name) (No manifest)"
            }
        }
    } else {
        Write-Warning "No backups found"
    }
    exit
}

# Restore from backup
if ($RestorePath) {
    Restore-Data -BackupPath $RestorePath -Verify:$Verify -DryRun:$DryRun
    exit
}

# Create backup
Backup-Data -BackupPath $BackupPath -FullBackup:$FullBackup -Incremental:$Incremental -Verify:$Verify -Compress:$Compress 