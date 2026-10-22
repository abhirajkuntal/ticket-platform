# ticket-platform

A REST API for managing support tickets, built with Node.js, Express, TypeScript, and Zod.

## Features

- CRUD for tickets (create, list, view, update, delete)
- Input validation with Zod
- Filtering by status and pagination on the list endpoint
- Consistent JSON error format
- Health check endpoint

> Data is stored in memory for now, so it resets when the server restarts.

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

The server runs on http://localhost:3000. Set a different port with the `PORT` environment variable.

## API

Base path: `/api/v1`

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/v1/tickets` | List tickets (`?status=open&page=1&limit=10`) |
| POST | `/api/v1/tickets` | Create a ticket |
| GET | `/api/v1/tickets/:id` | Get one ticket |
| PATCH | `/api/v1/tickets/:id` | Update title, description, or status |
| DELETE | `/api/v1/tickets/:id` | Delete a ticket |

Ticket statuses: `open`, `in_progress`, `closed`.

### Example

```bash
curl -i -X POST localhost:3000/api/v1/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login bug","description":"Users cannot log in"}'
```

### Errors

All errors share one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": [] } }
```

Codes: `VALIDATION_ERROR` (400), `INVALID_JSON` (400), `NOT_FOUND` (404), `INTERNAL` (500).

## Project structure

```
src/
  server.ts    # Express app, routes, validation, error handling
```

