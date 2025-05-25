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

# Function to check security logs
function Get-SecurityLogs {
    param(
        [int]$LastHours = 24
    )
    
    try {
        $logs = @()
        
        # Check application logs
        if (Test-Path "logs/security.log") {
            $logs += Get-Content "logs/security.log" | Select-String -Pattern "ERROR|WARNING|CRITICAL"
        }
        
        # Check system logs
        $systemLogs = Get-EventLog -LogName Security -After (Get-Date).AddHours(-$LastHours)
        $logs += $systemLogs | Where-Object { $_.EntryType -in @("Error", "Warning", "FailureAudit") }
        
        # Check Docker logs
        $dockerLogs = docker-compose logs --tail=1000 | Select-String -Pattern "error|warning|critical"
        $logs += $dockerLogs
        
        return $logs
    } catch {
        Write-Error "Failed to get security logs: $($_.Exception.Message)"
        return @()
    }
}

# Function to check for suspicious activities
function Test-SuspiciousActivities {
    param(
        [int]$Threshold = 5
    )
    
    try {
        $suspiciousActivities = @()
        
        # Check failed login attempts
        $failedLogins = Get-EventLog -LogName Security -After (Get-Date).AddHours(-1) |
            Where-Object { $_.EventID -eq 4625 } |
            Group-Object -Property {$_.ReplacementStrings[5]} |
            Where-Object { $_.Count -gt $Threshold }
        
        if ($failedLogins) {
            $suspiciousActivities += "Multiple failed login attempts detected for: $($failedLogins.Name -join ', ')"
        }
        
        # Check for unusual process activity
        $unusualProcesses = Get-Process | Where-Object {
            $_.CPU -gt 80 -or
            $_.WorkingSet -gt 1GB -or
            $_.Path -notlike "*\Windows\*" -and $_.Path -notlike "*\Program Files*"
        }
        
        if ($unusualProcesses) {
            $suspiciousActivities += "Unusual process activity detected: $($unusualProcesses.Name -join ', ')"
        }
        
        # Check for unusual network connections
        $unusualConnections = Get-NetTCPConnection | Where-Object {
            $_.State -eq "Established" -and
            $_.RemoteAddress -notlike "192.168.*" -and
            $_.RemoteAddress -notlike "10.*" -and
            $_.RemoteAddress -notlike "127.*"
        }
        
        if ($unusualConnections) {
            $suspiciousActivities += "Unusual network connections detected: $($unusualConnections.RemoteAddress -join ', ')"
        }
        
        return $suspiciousActivities
    } catch {
        Write-Error "Failed to check suspicious activities: $($_.Exception.Message)"
        return @()
    }
}

# Function to check system security
function Test-SystemSecurity {
    try {
        $securityIssues = @()
        
        # Check Windows Defender status
        $defenderStatus = Get-MpComputerStatus
        if (-not $defenderStatus.AntivirusEnabled) {
            $securityIssues += "Windows Defender is not enabled"
        }
        
        # Check firewall status
        $firewallStatus = Get-NetFirewallProfile
        if ($firewallStatus.Enabled -contains $false) {
            $securityIssues += "Firewall is not enabled for all profiles"
        }
        
        # Check for open ports
        $openPorts = Get-NetTCPConnection -State Listen | Where-Object {
            $_.LocalPort -notin @(80, 443, 8000, 11434, 9090, 3000)
        }
        if ($openPorts) {
            $securityIssues += "Unexpected open ports detected: $($openPorts.LocalPort -join ', ')"
        }
        
        # Check for weak permissions
        $weakPermissions = Get-ChildItem -Path ".\" -Recurse |
            Where-Object { $_.PSIsContainer -eq $false } |
            Get-Acl |
            Where-Object { $_.Access.FileSystemRights -match "FullControl|Modify" }
        
        if ($weakPermissions) {
            $securityIssues += "Files with weak permissions detected"
        }
        
        return $securityIssues
    } catch {
        Write-Error "Failed to check system security: $($_.Exception.Message)"
        return @()
    }
}

# Function to check Docker security
function Test-DockerSecurity {
    try {
        $dockerIssues = @()
        
        # Check for exposed ports
        $exposedPorts = docker ps --format "{{.Ports}}" | Select-String -Pattern "0.0.0.0"
        if ($exposedPorts) {
            $dockerIssues += "Docker containers with exposed ports detected"
        }
        
        # Check for privileged containers
        $privilegedContainers = docker ps --format "{{.Names}}" | ForEach-Object {
            docker inspect $_ | Select-String -Pattern "Privileged.*true"
        }
        if ($privilegedContainers) {
            $dockerIssues += "Privileged Docker containers detected"
        }
        
        # Check for root user in containers
        $rootUsers = docker ps --format "{{.Names}}" | ForEach-Object {
            docker exec $_ whoami | Select-String -Pattern "root"
        }
        if ($rootUsers) {
            $dockerIssues += "Containers running as root detected"
        }
        
        return $dockerIssues
    } catch {
        Write-Error "Failed to check Docker security: $($_.Exception.Message)"
        return @()
    }
}

# Function to generate security report
function Get-SecurityReport {
    param(
        [switch]$Detailed
    )
    
    try {
        Write-Host "`nGenerating Security Report..." -ForegroundColor Yellow
        
        # Get security logs
        Write-Host "`nChecking Security Logs..." -ForegroundColor Yellow
        $logs = Get-SecurityLogs
        if ($logs) {
            Write-Host "Found $($logs.Count) security-related log entries"
            if ($Detailed) {
                $logs | ForEach-Object { Write-Host "  $_" }
            }
        }
        
        # Check for suspicious activities
        Write-Host "`nChecking for Suspicious Activities..." -ForegroundColor Yellow
        $suspiciousActivities = Test-SuspiciousActivities
        if ($suspiciousActivities) {
            Write-Host "Suspicious activities detected:"
            $suspiciousActivities | ForEach-Object { Write-Host "  [!] $_" -ForegroundColor Red }
        } else {
            Write-Host "No suspicious activities detected" -ForegroundColor Green
        }
        
        # Check system security
        Write-Host "`nChecking System Security..." -ForegroundColor Yellow
        $securityIssues = Test-SystemSecurity
        if ($securityIssues) {
            Write-Host "Security issues detected:"
            $securityIssues | ForEach-Object { Write-Host "  [!] $_" -ForegroundColor Red }
        } else {
            Write-Host "No system security issues detected" -ForegroundColor Green
        }
        
        # Check Docker security
        Write-Host "`nChecking Docker Security..." -ForegroundColor Yellow
        $dockerIssues = Test-DockerSecurity
        if ($dockerIssues) {
            Write-Host "Docker security issues detected:"
            $dockerIssues | ForEach-Object { Write-Host "  [!] $_" -ForegroundColor Red }
        } else {
            Write-Host "No Docker security issues detected" -ForegroundColor Green
        }
        
        # Generate summary
        $totalIssues = $suspiciousActivities.Count + $securityIssues.Count + $dockerIssues.Count
        Write-Host "`nSecurity Report Summary:" -ForegroundColor Yellow
        Write-Host "  Total Issues: $totalIssues"
        Write-Host "  Suspicious Activities: $($suspiciousActivities.Count)"
        Write-Host "  System Security Issues: $($securityIssues.Count)"
        Write-Host "  Docker Security Issues: $($dockerIssues.Count)"
        
        if ($totalIssues -eq 0) {
            Write-Host "`nSystem security status: OK" -ForegroundColor Green
        } else {
            Write-Host "`nSystem security status: Needs Attention" -ForegroundColor Red
        }
        
    } catch {
        Write-Error "Failed to generate security report: $($_.Exception.Message)"
    }
}

# Main script
param(
    [switch]$Detailed,
    [switch]$Continuous,
    [int]$Interval = 300  # 5 minutes
)

try {
    if ($Continuous) {
        Write-Host "Starting continuous security monitoring..." -ForegroundColor Yellow
        while ($true) {
            Get-SecurityReport -Detailed:$Detailed
            Start-Sleep -Seconds $Interval
        }
    } else {
        Get-SecurityReport -Detailed:$Detailed
    }
} catch {
    Write-Error "Security monitoring failed: $($_.Exception.Message)"
    exit 1
} 