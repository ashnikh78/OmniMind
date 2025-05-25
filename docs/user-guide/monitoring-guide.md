# Monitoring Guide

## Overview
This guide provides detailed information about the monitoring system, available metrics, and how to use the dashboards effectively.

## Available Metrics

### 1. System Performance Metrics
```promql
# CPU Usage
rate(node_cpu_seconds_total{mode="idle"}[5m])

# Memory Usage
node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes

# Disk I/O
rate(node_disk_read_bytes_total[5m])
rate(node_disk_written_bytes_total[5m])

# Network I/O
rate(node_network_receive_bytes_total[5m])
rate(node_network_transmit_bytes_total[5m])
```

### 2. Database Metrics
```promql
# Connections
pg_stat_activity_count

# Operations
rate(pg_stat_database_tup_returned[5m])
rate(pg_stat_database_tup_fetched[5m])

# Transactions
rate(pg_stat_database_xact_commit[5m])
rate(pg_stat_database_xact_rollback[5m])

# Cache
pg_stat_bgwriter_buffers_alloc
pg_stat_bgwriter_buffers_backend
```

### 3. Redis Metrics
```promql
# Connections
redis_connected_clients

# Commands
rate(redis_commands_processed_total[5m])

# Memory
redis_memory_used_bytes

# Keyspace
redis_keyspace_keys
```

### 4. Security Metrics
```promql
# Security Checks
rate(security_checks_total[5m])
rate(security_checks_failed[5m])

# Authentication
rate(security_auth_failures[5m])
security_mfa_enrollment

# Authorization
rate(security_permission_violations[5m])

# Threats
rate(security_threat_detected[5m])
security_threat_risk
```

## Dashboard Usage

### 1. System Performance Dashboard

#### CPU Usage Panel
- **Metric**: `rate(node_cpu_seconds_total{mode="idle"}[5m])`
- **Visualization**: Time series graph
- **Thresholds**:
  - Warning: > 70%
  - Critical: > 90%
- **Alert**: CPU usage exceeds threshold for 5 minutes

#### Memory Usage Panel
- **Metric**: `node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes`
- **Visualization**: Gauge
- **Thresholds**:
  - Warning: > 80%
  - Critical: > 95%
- **Alert**: Memory usage exceeds threshold for 5 minutes

#### Disk I/O Panel
- **Metrics**:
  - Read: `rate(node_disk_read_bytes_total[5m])`
  - Write: `rate(node_disk_written_bytes_total[5m])`
- **Visualization**: Time series graph
- **Thresholds**:
  - Warning: > 100MB/s
  - Critical: > 200MB/s
- **Alert**: Disk I/O exceeds threshold for 5 minutes

### 2. Database Dashboard

#### Connections Panel
- **Metric**: `pg_stat_activity_count`
- **Visualization**: Gauge
- **Thresholds**:
  - Warning: > 80% of max_connections
  - Critical: > 90% of max_connections
- **Alert**: Connection count exceeds threshold

#### Operations Panel
- **Metrics**:
  - Tuples Returned: `rate(pg_stat_database_tup_returned[5m])`
  - Tuples Fetched: `rate(pg_stat_database_tup_fetched[5m])`
- **Visualization**: Time series graph
- **Thresholds**:
  - Warning: > 1000 ops/s
  - Critical: > 2000 ops/s
- **Alert**: Operation rate exceeds threshold

### 3. Redis Dashboard

#### Connections Panel
- **Metric**: `redis_connected_clients`
- **Visualization**: Gauge
- **Thresholds**:
  - Warning: > 100
  - Critical: > 200
- **Alert**: Connection count exceeds threshold

#### Memory Usage Panel
- **Metric**: `redis_memory_used_bytes`
- **Visualization**: Gauge
- **Thresholds**:
  - Warning: > 80% of maxmemory
  - Critical: > 90% of maxmemory
- **Alert**: Memory usage exceeds threshold

### 4. Security Dashboard

#### Security Checks Panel
- **Metrics**:
  - Total: `rate(security_checks_total[5m])`
  - Failed: `rate(security_checks_failed[5m])`
- **Visualization**: Time series graph
- **Thresholds**:
  - Warning: > 10% failure rate
  - Critical: > 20% failure rate
- **Alert**: Security check failure rate exceeds threshold

#### Threat Detection Panel
- **Metrics**:
  - Threats: `rate(security_threat_detected[5m])`
  - Risk Score: `security_threat_risk`
- **Visualization**: Time series graph
- **Thresholds**:
  - Warning: Risk score > 7
  - Critical: Risk score > 9
- **Alert**: Threat risk score exceeds threshold

## Alert Configuration

### 1. Alert Rules
```yaml
groups:
- name: system
  rules:
  - alert: HighCPUUsage
    expr: rate(node_cpu_seconds_total{mode="idle"}[5m]) > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: High CPU usage
      description: CPU usage is above 90% for 5 minutes

  - alert: HighMemoryUsage
    expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.95
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: High memory usage
      description: Memory usage is above 95% for 5 minutes
```

### 2. Alert Notifications
```yaml
receivers:
- name: 'team-omnimind'
  email_configs:
  - to: 'team@omnimind.ai'
    send_resolved: true
  slack_configs:
  - channel: '#alerts'
    send_resolved: true
```

## Custom Dashboards

### 1. Creating Custom Panels
1. Click "Add Panel" in dashboard
2. Select visualization type
3. Configure metrics:
   ```promql
   # Example custom metric
   rate(security_checks_total{component="api"}[5m])
   ```
4. Set thresholds and alerts
5. Save panel

### 2. Dashboard Variables
```promql
# Component variable
label_values(security_checks_total, component)

# Environment variable
label_values(security_checks_total, environment)
```

### 3. Dashboard Links
- Link to related dashboards
- Link to documentation
- Link to alert rules
- Link to runbooks

## Best Practices

### 1. Dashboard Organization
- Group related metrics
- Use consistent naming
- Include documentation
- Set appropriate refresh rates
- Use appropriate time ranges

### 2. Alert Management
- Set meaningful thresholds
- Use appropriate severity levels
- Include clear descriptions
- Configure proper notifications
- Review and update regularly

### 3. Performance Optimization
- Use appropriate scrape intervals
- Optimize query performance
- Manage retention policies
- Monitor resource usage
- Regular maintenance

## Troubleshooting

### 1. Common Issues
- Missing metrics
- High latency
- Alert storms
- Resource exhaustion
- Configuration errors

### 2. Solutions
- Check scrape configuration
- Verify network connectivity
- Review alert rules
- Optimize queries
- Check resource limits

## Additional Resources
- Prometheus documentation
- Grafana documentation
- Alert manager guide
- Metric naming conventions
- Best practices guide 