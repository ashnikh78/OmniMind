# OmniMind API Documentation

## Overview

The OmniMind API provides a comprehensive set of endpoints for managing projects, tasks, users, and analytics. This documentation covers all available endpoints, authentication methods, and best practices for integration.

## Base URL

```
https://api.omnimind.ai/v1
```

## Authentication

### API Keys

All API requests require authentication using an API key. Include your API key in the `X-API-Key` header:

```http
X-API-Key: your_api_key_here
```

### OAuth 2.0

For user-specific operations, OAuth 2.0 authentication is required. The following OAuth flows are supported:

1. **Authorization Code Flow**
2. **Client Credentials Flow**
3. **Implicit Flow**

#### Authorization Code Flow

1. Redirect users to the authorization endpoint:
```
GET /oauth/authorize
  ?client_id=your_client_id
  &redirect_uri=your_redirect_uri
  &response_type=code
  &scope=read write
```

2. Exchange the authorization code for tokens:
```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=authorization_code
&redirect_uri=your_redirect_uri
&client_id=your_client_id
&client_secret=your_client_secret
```

## Rate Limiting

API requests are rate-limited based on your subscription tier:

| Tier    | Requests per minute |
|---------|-------------------|
| Basic   | 60                |
| Pro     | 300               |
| Enterprise| 1000            |

Rate limit headers are included in all responses:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1617235200
```

## Endpoints

### Projects

#### List Projects
```http
GET /projects
```

Query Parameters:
- `page` (integer): Page number for pagination
- `per_page` (integer): Number of items per page
- `sort` (string): Sort field (created_at, updated_at, name)
- `order` (string): Sort order (asc, desc)
- `search` (string): Search term for project name/description

Response:
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "status": "string",
      "created_at": "string",
      "updated_at": "string",
      "owner": {
        "id": "string",
        "name": "string",
        "email": "string"
      }
    }
  ],
  "meta": {
    "total": 0,
    "page": 0,
    "per_page": 0,
    "total_pages": 0
  }
}
```

#### Create Project
```http
POST /projects
```

Request Body:
```json
{
  "name": "string",
  "description": "string",
  "status": "string",
  "owner_id": "string",
  "members": [
    {
      "user_id": "string",
      "role": "string"
    }
  ]
}
```

#### Get Project
```http
GET /projects/{project_id}
```

#### Update Project
```http
PUT /projects/{project_id}
```

#### Delete Project
```http
DELETE /projects/{project_id}
```

### Tasks

#### List Tasks
```http
GET /projects/{project_id}/tasks
```

Query Parameters:
- `page` (integer): Page number for pagination
- `per_page` (integer): Number of items per page
- `status` (string): Filter by status
- `assignee` (string): Filter by assignee
- `due_date` (string): Filter by due date
- `sort` (string): Sort field
- `order` (string): Sort order

#### Create Task
```http
POST /projects/{project_id}/tasks
```

Request Body:
```json
{
  "title": "string",
  "description": "string",
  "status": "string",
  "priority": "string",
  "assignee_id": "string",
  "due_date": "string",
  "tags": ["string"],
  "dependencies": ["string"]
}
```

#### Get Task
```http
GET /tasks/{task_id}
```

#### Update Task
```http
PUT /tasks/{task_id}
```

#### Delete Task
```http
DELETE /tasks/{task_id}
```

### Users

#### List Users
```http
GET /users
```

#### Create User
```http
POST /users
```

Request Body:
```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "role": "string",
  "department": "string",
  "title": "string"
}
```

#### Get User
```http
GET /users/{user_id}
```

#### Update User
```http
PUT /users/{user_id}
```

#### Delete User
```http
DELETE /users/{user_id}
```

### Analytics

#### Get Project Analytics
```http
GET /analytics/projects/{project_id}
```

Query Parameters:
- `start_date` (string): Start date for analytics
- `end_date` (string): End date for analytics
- `metrics` (string[]): Specific metrics to include

Response:
```json
{
  "task_completion": {
    "total": 0,
    "completed": 0,
    "overdue": 0,
    "completion_rate": 0
  },
  "time_tracking": {
    "total_hours": 0,
    "average_completion_time": 0
  },
  "user_activity": {
    "active_users": 0,
    "contributions": {}
  }
}
```

#### Get User Analytics
```http
GET /analytics/users/{user_id}
```

#### Get System Analytics
```http
GET /analytics/system
```

### Webhooks

#### Create Webhook
```http
POST /webhooks
```

Request Body:
```json
{
  "url": "string",
  "events": ["string"],
  "secret": "string"
}
```

#### List Webhooks
```http
GET /webhooks
```

#### Delete Webhook
```http
DELETE /webhooks/{webhook_id}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

Common error codes:
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

## Best Practices

1. **Error Handling**
   - Always check for error responses
   - Implement exponential backoff for retries
   - Handle rate limiting appropriately

2. **Performance**
   - Use pagination for large datasets
   - Implement caching where appropriate
   - Use compression for large payloads

3. **Security**
   - Never expose API keys in client-side code
   - Use HTTPS for all requests
   - Implement proper input validation
   - Follow the principle of least privilege

4. **Monitoring**
   - Monitor API usage and quotas
   - Track error rates and response times
   - Set up alerts for unusual patterns

## SDKs and Libraries

Official SDKs are available for:
- Python
- JavaScript/TypeScript
- Java
- .NET
- Ruby
- Go

Example usage with Python SDK:
```python
from omnimind import OmniMind

client = OmniMind(api_key="your_api_key")

# Create a project
project = client.projects.create(
    name="My Project",
    description="Project description"
)

# Create a task
task = client.tasks.create(
    project_id=project.id,
    title="New Task",
    description="Task description"
)
```

## Support

For API support:
- Email: api-support@omnimind.ai
- Documentation: https://docs.omnimind.ai
- Status Page: https://status.omnimind.ai 