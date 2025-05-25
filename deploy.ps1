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

# Function to check system requirements
function Test-SystemRequirements {
    Write-Status "Checking system requirements..."
    
    # Check CPU
    $cpuInfo = Get-WmiObject Win32_Processor
    if ($cpuInfo.NumberOfCores -lt 4) {
        Write-Warning "System has less than 4 CPU cores. Performance may be affected."
    }
    
    # Check RAM
    $ramInfo = Get-WmiObject Win32_ComputerSystem
    $totalRAM = [math]::Round($ramInfo.TotalPhysicalMemory / 1GB, 2)
    if ($totalRAM -lt 8) {
        Write-Warning "System has less than 8GB RAM. Performance may be affected."
    }
    
    # Check disk space
    $diskInfo = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeSpace = [math]::Round($diskInfo.FreeSpace / 1GB, 2)
    if ($freeSpace -lt 20) {
        Write-Warning "Less than 20GB free disk space. Please ensure sufficient space."
    }

    # Check GPU if available
    if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
        $gpuInfo = nvidia-smi --query-gpu=gpu_name,memory.total --format=csv,noheader
        Write-Status "GPU detected: $gpuInfo"
        $env:USE_GPU = "true"
    } else {
        Write-Warning "No NVIDIA GPU detected. Running in CPU-only mode."
        $env:USE_GPU = "false"
    }
}

# Function to create backup
function Backup-Configuration {
    param($BackupPath = "backups")
    
    Write-Status "Creating backup..."
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = Join-Path $BackupPath $timestamp
    
    try {
        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        
        # Backup .env file
        if (Test-Path .env) {
            Copy-Item .env -Destination (Join-Path $backupDir "env_backup")
        }
        
        # Backup database
        if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
            $dbBackupFile = Join-Path $backupDir "database_backup.sql"
            docker-compose exec postgres pg_dump -U omnimind > $dbBackupFile
        }

        # Backup Grafana dashboards
        if (Test-Path "grafana/dashboards") {
            Copy-Item "grafana/dashboards" -Destination (Join-Path $backupDir "grafana_dashboards") -Recurse
        }

        # Backup Prometheus data
        if (Test-Path "prometheus_data") {
            Copy-Item "prometheus_data" -Destination (Join-Path $backupDir "prometheus_data") -Recurse
        }
        
        Write-Status "Backup created at: $backupDir"
    } catch {
        Write-Error "Failed to create backup: $_"
        exit 1
    }
}

# Function to validate environment variables
function Test-EnvironmentVariables {
    Write-Status "Validating environment variables..."
    
    $requiredVars = @(
        "API_HOST", "API_PORT", "OLLAMA_HOST", "POSTGRES_URL",
        "REDIS_URL", "JWT_SECRET_KEY", "ENCRYPTION_KEY",
        "PROMETHEUS_ENABLED", "GRAFANA_ENABLED", "LOG_LEVEL"
    )
    
    if (-not (Test-Path .env)) {
        Write-Error ".env file not found. Creating default .env file..."
        @"
# Application Settings
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=false

# Model Settings
OLLAMA_HOST=http://ollama:11434
DEFAULT_MODEL=llama2-7b
MODEL_CACHE_SIZE=10GB
WHISPER_MODEL=small

# Database Settings
POSTGRES_USER=omnimind
POSTGRES_PASSWORD=omnimind
POSTGRES_DB=omnimind
POSTGRES_URL=postgresql://omnimind:omnimind@postgres:5432/omnimind

# Redis Settings
REDIS_URL=redis://redis:6379

# Storage Settings
CHROMA_PERSIST_DIR=.chroma
COMPLIANCE_MODE=gdpr_ccpa_hipaa
PII_DETECTION_LEVEL=strict
AUDIT_LOG_PATH=logs/compliance

# Security Settings
JWT_SECRET_KEY=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Monitoring Settings
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
LOG_LEVEL=INFO
"@ | Out-File -FilePath .env -Encoding UTF8
    }
    
    $missingVars = @()
    foreach ($var in $requiredVars) {
        if (-not (Get-Content .env | Select-String "^$var=")) {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Error "Missing required environment variables: $($missingVars -join ', ')"
        exit 1
    }
}

# Function to check network connectivity
function Test-NetworkConnectivity {
    Write-Status "Checking network connectivity..."
    
    $endpoints = @(
        "https://api.github.com",
        "https://hub.docker.com",
        "https://ollama.ai",
        "https://prometheus.io",
        "https://grafana.com"
    )
    
    foreach ($endpoint in $endpoints) {
        try {
            $response = Invoke-WebRequest -Uri $endpoint -Method HEAD -UseBasicParsing
            Write-Status "Connected to $endpoint"
        } catch {
            Write-Warning "Cannot connect to $endpoint"
        }
    }
}

# Function to check and create necessary directories
function Initialize-Directories {
    Write-Status "Creating necessary directories..."
    
    $directories = @(
        ".chroma",
        "logs/compliance",
        "logs/audit",
        "logs/security",
        "prometheus_data",
        "grafana_data",
        "grafana/provisioning/datasources",
        "grafana/provisioning/dashboards",
        "grafana/dashboards",
        "backups"
    )
    
    foreach ($dir in $directories) {
        try {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        } catch {
            Write-Error "Failed to create directory $dir : $_"
            exit 1
        }
    }
}

# Function to initialize Grafana configuration
function Initialize-Grafana {
    Write-Status "Initializing Grafana configuration..."
    
    try {
        # Create datasource configuration
        $datasourceConfig = @{
            apiVersion = 1
            datasources = @(
                @{
                    name = "Prometheus"
                    type = "prometheus"
                    access = "proxy"
                    url = "http://prometheus:9090"
                    isDefault = $true
                }
            )
        }
        
        $datasourceConfig | ConvertTo-Json | Out-File -FilePath "grafana/provisioning/datasources/datasources.yml" -Encoding UTF8
        
        # Create dashboard provider configuration
        $dashboardConfig = @{
            apiVersion = 1
            providers = @(
                @{
                    name = "Default"
                    orgId = 1
                    folder = ""
                    type = "file"
                    disableDeletion = $false
                    editable = $true
                    options = @{
                        path = "/var/lib/grafana/dashboards"
                    }
                }
            )
        }
        
        $dashboardConfig | ConvertTo-Json | Out-File -FilePath "grafana/provisioning/dashboards/dashboards.yml" -Encoding UTF8
    } catch {
        Write-Error "Failed to initialize Grafana configuration: $_"
        exit 1
    }
}

# Main deployment process
try {
    # Check system requirements
    Test-SystemRequirements
    
    # Check network connectivity
    Test-NetworkConnectivity
    
    # Check if Docker is installed
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker is not installed. Please install Docker first."
        exit 1
    }
    
    # Check if Docker Compose is installed
    if (!(Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        Write-Error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    }
    
    # Check Docker daemon status
    try {
        docker info | Out-Null
    } catch {
        Write-Error "Docker daemon is not running. Please start Docker Desktop."
        exit 1
    }
    
    # Initialize directories
    Initialize-Directories
    
    # Initialize Grafana configuration
    Initialize-Grafana
    
    # Validate environment variables
    Test-EnvironmentVariables
    
    # Create backup before deployment
    Backup-Configuration
    
    # Build and start containers
    Write-Status "Building and starting containers..."
    if ($env:USE_GPU -eq "false") {
        Write-Warning "Building without GPU support..."
        docker-compose -f docker-compose.yml -f docker-compose.cpu.yml up -d --build
    } else {
        docker-compose up -d --build
    }
    
    # Wait for services to be ready
    Write-Status "Waiting for services to be ready..."
    Start-Sleep -Seconds 30
    
    # Check if services are running
    Write-Status "Checking service status..."
    $failedServices = docker-compose ps --format "{{.Name}}:{{.Status}}" | Where-Object { $_ -match "Exit" }
    if ($failedServices) {
        Write-Error "Some services failed to start: $failedServices"
        Write-Error "Check logs with 'docker-compose logs'"
        exit 1
    }
    
    Write-Status "Deployment completed successfully!"
    Write-Status "You can access the application at:"
    Write-Host "  - API: http://localhost:8000"
    Write-Host "  - Admin Panel: http://localhost:8000/admin"
    Write-Host "  - Prometheus: http://localhost:9090"
    Write-Host "  - Grafana: http://localhost:3000"
    
} catch {
    Write-Error "Deployment failed: $_"
    Write-Error "Stack trace: $($_.ScriptStackTrace)"
    exit 1
} 