# Function to check service health
function Test-ServiceHealth {
    param(
        [string]$Service,
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec $TimeoutSeconds
        if ($response.StatusCode -eq 200) {
            Write-Host "[✓] $Service is healthy" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[✗] $Service is unhealthy (Status: $($response.StatusCode))" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[✗] $Service is unhealthy (Error: $($_.Exception.Message))" -ForegroundColor Red
        return $false
    }
}

# Function to check container health
function Test-ContainerHealth {
    param(
        [string]$ContainerName
    )
    
    try {
        $container = docker inspect $ContainerName 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[✗] Container $ContainerName not found" -ForegroundColor Red
            return $false
        }
        
        $health = $container | ConvertFrom-Json
        
        if ($health.State.Health.Status -eq "healthy") {
            Write-Host "[✓] Container $ContainerName is healthy" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[✗] Container $ContainerName is unhealthy (Status: $($health.State.Health.Status))" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[✗] Container $ContainerName health check failed (Error: $($_.Exception.Message))" -ForegroundColor Red
        return $false
    }
}

# Function to check resource usage
function Get-ResourceUsage {
    param(
        [string]$ContainerName
    )
    
    try {
        $stats = docker stats $ContainerName --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.NetIO}},{{.BlockIO}}" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[✗] Failed to get stats for container $ContainerName" -ForegroundColor Red
            return
        }
        
        $statsArray = $stats -split ","
        if ($statsArray.Count -lt 5) {
            Write-Host "[✗] Invalid stats format for container $ContainerName" -ForegroundColor Red
            return
        }
        
        Write-Host "`nResource usage for ${ContainerName}:" -ForegroundColor Yellow
        Write-Host "  CPU: $($statsArray[1])"
        Write-Host "  Memory: $($statsArray[2])"
        Write-Host "  Network: $($statsArray[3])"
        Write-Host "  Disk I/O: $($statsArray[4])"
    } catch {
        Write-Host "[✗] Failed to get resource usage for $ContainerName (Error: $($_.Exception.Message))" -ForegroundColor Red
    }
}

# Function to check disk space
function Test-DiskSpace {
    try {
        $diskInfo = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction Stop
        $freeSpace = [math]::Round($diskInfo.FreeSpace / 1GB, 2)
        $totalSpace = [math]::Round($diskInfo.Size / 1GB, 2)
        $usedSpace = $totalSpace - $freeSpace
        $usedPercentage = [math]::Round(($usedSpace / $totalSpace) * 100, 2)
        
        Write-Host "`nDisk Space Usage:" -ForegroundColor Yellow
        Write-Host "  Total: ${totalSpace}GB"
        Write-Host "  Used: ${usedSpace}GB (${usedPercentage}%)"
        Write-Host "  Free: ${freeSpace}GB"
        
        if ($freeSpace -lt 10) {
            Write-Host "[!] Warning: Less than 10GB free disk space" -ForegroundColor Red
        }
    } catch {
        Write-Host "[✗] Failed to check disk space (Error: $($_.Exception.Message))" -ForegroundColor Red
    }
}

# Function to check memory usage
function Test-MemoryUsage {
    $memoryInfo = Get-WmiObject Win32_OperatingSystem
    $totalMemory = [math]::Round($memoryInfo.TotalVisibleMemorySize / 1MB, 2)
    $freeMemory = [math]::Round($memoryInfo.FreePhysicalMemory / 1MB, 2)
    $usedMemory = $totalMemory - $freeMemory
    $usedPercentage = [math]::Round(($usedMemory / $totalMemory) * 100, 2)
    
    Write-Host "`nMemory Usage:" -ForegroundColor Yellow
    Write-Host "  Total: ${totalMemory}MB"
    Write-Host "  Used: ${usedMemory}MB (${usedPercentage}%)"
    Write-Host "  Free: ${freeMemory}MB"
    
    if ($freeMemory -lt 1000) {
        Write-Host "[!] Warning: Less than 1GB free memory" -ForegroundColor Red
    }
}

# Function to check network connectivity
function Test-NetworkConnectivity {
    Write-Host "`nNetwork Connectivity:" -ForegroundColor Yellow
    
    $endpoints = @(
        @{Name="API"; Url="http://localhost:8000/health"},
        @{Name="Ollama"; Url="http://localhost:11434/api/health"},
        @{Name="Prometheus"; Url="http://localhost:9090/-/healthy"},
        @{Name="Grafana"; Url="http://localhost:3000/api/health"}
    )
    
    foreach ($endpoint in $endpoints) {
        try {
            $response = Invoke-WebRequest -Uri $endpoint.Url -Method GET -UseBasicParsing -TimeoutSec 5
            Write-Host "  [✓] $($endpoint.Name) is reachable" -ForegroundColor Green
        } catch {
            Write-Host "  [✗] $($endpoint.Name) is not reachable" -ForegroundColor Red
        }
    }
}

# Main health check process
try {
    Write-Host "Starting comprehensive health check..." -ForegroundColor Yellow
    
    # Check API health
    Write-Host "`nChecking API health..."
    Test-ServiceHealth -Service "API" -Url "http://localhost:8000/health"
    
    # Check Ollama health
    Write-Host "`nChecking Ollama health..."
    Test-ServiceHealth -Service "Ollama" -Url "http://localhost:11434/api/health"
    
    # Check Redis health
    Write-Host "`nChecking Redis health..."
    try {
        $redisResponse = docker-compose exec redis redis-cli ping
        if ($redisResponse -match "PONG") {
            Write-Host "[✓] Redis is healthy" -ForegroundColor Green
        } else {
            Write-Host "[✗] Redis is unhealthy" -ForegroundColor Red
        }
    } catch {
        Write-Host "[✗] Redis is unhealthy (Error: $($_.Exception.Message))" -ForegroundColor Red
    }
    
    # Check PostgreSQL health
    Write-Host "`nChecking PostgreSQL health..."
    try {
        $pgResponse = docker-compose exec postgres pg_isready -U omnimind
        if ($pgResponse -match "accepting connections") {
            Write-Host "[✓] PostgreSQL is healthy" -ForegroundColor Green
        } else {
            Write-Host "[✗] PostgreSQL is unhealthy" -ForegroundColor Red
        }
    } catch {
        Write-Host "[✗] PostgreSQL is unhealthy (Error: $($_.Exception.Message))" -ForegroundColor Red
    }
    
    # Check Prometheus health
    Write-Host "`nChecking Prometheus health..."
    Test-ServiceHealth -Service "Prometheus" -Url "http://localhost:9090/-/healthy"
    
    # Check Grafana health
    Write-Host "`nChecking Grafana health..."
    Test-ServiceHealth -Service "Grafana" -Url "http://localhost:3000/api/health"
    
    # Check container status
    Write-Host "`nChecking container status..."
    $containers = docker-compose ps --format "{{.Name}}"
    foreach ($container in $containers) {
        Test-ContainerHealth -ContainerName $container
        Get-ResourceUsage -ContainerName $container
    }
    
    # Check system resources
    Test-DiskSpace
    Test-MemoryUsage
    Test-NetworkConnectivity
    
    Write-Host "`nHealth check completed!" -ForegroundColor Green
    
} catch {
    Write-Host "`n[✗] Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack trace: $($_.ScriptStackTrace)" -ForegroundColor Red
    exit 1
} 