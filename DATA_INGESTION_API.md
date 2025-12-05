# Data Ingestion API Documentation

## Overview

The Data Ingestion API allows you to import both ticket and transcript data into the servicing analysis system. The API automatically processes, validates, categorizes, and regenerates analytics when new data is added.

**Endpoint**: `/api/ingest`

**Methods**: `GET`, `POST`

---

## API Endpoints

### GET `/api/ingest`

Returns API status and usage information.

**Response Example**:
```json
{
  "endpoint": "/api/ingest",
  "status": "active",
  "description": "Data ingestion API for tickets and transcripts",
  "methods": ["POST"],
  "example": { ... }
}
```

---

### POST `/api/ingest`

Imports ticket or transcript data with automatic processing and analysis.

#### Request Body

```typescript
{
  type: 'tickets' | 'transcripts',
  data: string | object[],
  format: 'csv' | 'json',
  mode?: 'append' | 'replace'  // Default: 'append'
}
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | Yes | Data type: `'tickets'` or `'transcripts'` |
| `format` | string | Yes | Data format: `'csv'` or `'json'` |
| `data` | string \| object[] | Yes | CSV string or JSON array of records |
| `mode` | string | No | Import mode: `'append'` (default) or `'replace'` |

#### Response

```typescript
{
  success: boolean,
  message: string,
  stats?: {
    recordsProcessed: number,
    recordsAdded: number,
    recordsUpdated: number,
    totalRecords: number
  },
  errors?: string[]
}
```

---

## Ticket Data Import

### Required Fields

- `ticket_key` or `ticket_uuid` - Unique ticket identifier
- `ticket_created_at_utc` - ISO 8601 timestamp
- `project_name` - Must be one of the servicing projects

### Auto-Filtering

Only tickets from these projects will be imported:
- Servicing Help
- Servicing Escalations WG
- ServApp Support
- CMG Servicing Oversight

### Auto-Categorization

If no `category` is provided, tickets are automatically categorized based on title and description:

| Category | Keywords |
|----------|----------|
| Automated System Messages | automated, system message |
| Payment Issues | payment, pay |
| Escrow | escrow |
| Documentation | document, statement |
| Transfer/Boarding | transfer, boarding |
| Voice/Alert Requests | voice, alert |
| Account Access | access, login |
| Loan Info Request | loan info, information |
| Insurance/Coverage | insurance, coverage |
| Loan Changes | loan change, modification |
| Complaints/Escalations | complaint, escalation |
| General Inquiry | inquiry, question |
| Communication/Forwarded | forward, communication |
| Other | (default) |

### Example: JSON Format

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "type": "tickets",
    "format": "json",
    "mode": "append",
    "data": [
      {
        "ticket_key": "SH-12345",
        "ticket_uuid": "abc-123-def-456",
        "ticket_title": "Payment Processing Issue",
        "ticket_description": "Customer unable to make payment through portal",
        "ticket_created_at_utc": "2024-12-04T10:00:00.000Z",
        "project_name": "Servicing Help",
        "ticket_status": "Open",
        "ticket_priority": "High",
        "ticket_assignee_name": "John Smith"
      }
    ]
  }'
```

### Example: CSV Format

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "type": "tickets",
    "format": "csv",
    "mode": "append",
    "data": "ticket_key,ticket_uuid,ticket_title,ticket_description,ticket_created_at_utc,project_name,ticket_status,ticket_priority,ticket_assignee_name\nSH-12345,abc-123,Payment Issue,Cannot process payment,2024-12-04T10:00:00.000Z,Servicing Help,Open,High,John Smith"
  }'
```

### Response Example

```json
{
  "success": true,
  "message": "Successfully processed 1 records",
  "stats": {
    "recordsProcessed": 1,
    "recordsAdded": 1,
    "recordsUpdated": 0,
    "totalRecords": 23168
  }
}
```

---

## Transcript Data Import

### Required Fields

- `vendorCallKey` or `id` - Unique call identifier
- `agentName` - Agent name
- `conversation` - Array of conversation messages

### Conversation Format

Each message in the conversation array must have:
- `role` - Either `'agent'` or `'customer'`
- `text` - Message content

### Example: JSON Format

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "type": "transcripts",
    "format": "json",
    "mode": "append",
    "data": [
      {
        "vendorCallKey": "CALL-2024-001",
        "agentName": "Smith, John",
        "callDate": "2024-12-04",
        "conversation": [
          {
            "role": "agent",
            "text": "Hello, this is John from CMG Servicing. How can I help you today?"
          },
          {
            "role": "customer",
            "text": "Hi, this is Mary Johnson. I have a question about my escrow account."
          },
          {
            "role": "agent",
            "text": "I'd be happy to help you with that, Mary. Can you provide your loan number?"
          }
        ],
        "sentiment": "positive",
        "topics": ["escrow", "inquiry"],
        "department": "Servicing"
      }
    ]
  }'
```

### Response Example

```json
{
  "success": true,
  "message": "Successfully processed 1 transcript records",
  "stats": {
    "recordsProcessed": 1,
    "recordsAdded": 1,
    "recordsUpdated": 0,
    "totalRecords": 26899
  }
}
```

---

## Automatic Processing

When data is successfully imported, the system automatically:

1. **Validates** all required fields
2. **Filters** tickets to servicing projects only
3. **Categorizes** tickets (if not already categorized)
4. **Merges** with existing data (append mode) or replaces (replace mode)
5. **Updates** existing records if duplicate IDs are found
6. **Regenerates** all analytics and statistics
7. **Returns** detailed processing stats

---

## Modes

### Append Mode (Default)

- Adds new records to existing data
- Updates existing records if duplicate IDs found
- Preserves all existing records

### Replace Mode

- Replaces all existing data with new data
- Use with caution - all previous data will be lost

---

## Error Handling

The API returns detailed error information for validation failures:

```json
{
  "success": true,
  "message": "Successfully processed 5 records",
  "stats": { ... },
  "errors": [
    "Row 3: Missing ticket_created_at_utc",
    "Row 7: Missing ticket_key or ticket_uuid"
  ]
}
```

Common errors:
- Missing required fields
- Invalid project name (not in servicing projects)
- Invalid date format
- Malformed CSV data

---

## Integration Examples

### Node.js

```javascript
const fetch = require('node-fetch');

async function ingestTickets(tickets) {
  const response = await fetch('http://localhost:3000/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'tickets',
      format: 'json',
      mode: 'append',
      data: tickets
    })
  });

  return await response.json();
}
```

### Python

```python
import requests

def ingest_tickets(tickets):
    response = requests.post(
        'http://localhost:3000/api/ingest',
        json={
            'type': 'tickets',
            'format': 'json',
            'mode': 'append',
            'data': tickets
        }
    )
    return response.json()
```

### PowerShell

```powershell
$tickets = @(
    @{
        ticket_key = "SH-12345"
        ticket_uuid = "abc-123"
        ticket_title = "Test Ticket"
        ticket_created_at_utc = "2024-12-04T10:00:00.000Z"
        project_name = "Servicing Help"
    }
)

$body = @{
    type = "tickets"
    format = "json"
    mode = "append"
    data = $tickets
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3000/api/ingest" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

---

## Production Deployment

When deploying to production, update the URLs from `localhost:3000` to your production domain:

```bash
https://your-domain.vercel.app/api/ingest
```

---

## Testing

A test script is included at `test-ingest.js`:

```bash
# Start the dev server
npm run dev

# Run tests
node test-ingest.js
```

This tests:
- API status endpoint
- JSON ticket import
- JSON transcript import
- CSV ticket import
- Error handling

---

## Best Practices

1. **Batch Processing**: Send data in batches of 100-1000 records for optimal performance
2. **Error Handling**: Always check the `errors` array in responses
3. **Validation**: Validate data on your side before sending to reduce errors
4. **Mode Selection**: Use `append` mode for incremental updates, `replace` only when rebuilding entire dataset
5. **Rate Limiting**: Consider implementing rate limiting for production use
6. **Authentication**: Add authentication middleware for production deployments

---

## Monitoring

After each import, check:
- Response stats (recordsAdded, recordsUpdated)
- Error array for any validation issues
- Dashboard analytics to verify data appears correctly
- Browser console for any client-side errors

---

## Support

For issues or questions:
- Check error messages in the response
- Review this documentation
- Examine sample data formats
- Run the test script to verify setup
