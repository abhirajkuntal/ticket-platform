import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import cors from "cors";

type Status = "open" | "in_progress" | "closed";
type Ticket = {
  id: string; title: string; description: string;
  status: Status; createdAt: string; updatedAt: string;
};

const tickets = new Map<string, Ticket>();

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

const statusEnum = z.enum(["open", "in_progress", "closed"]);
const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().max(2000).default(""),
});
const updateSchema = createSchema.partial().extend({ status: statusEnum.optional() });
const listQuery = z.object({
  status: statusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid input", details);
  }
  return result.data;
}

function findOr404(id: string): Ticket {
  const t = tickets.get(id);
  if (!t) throw new HttpError(404, "NOT_FOUND", `Ticket ${id} not found`);
  return t;
}

function etagFor(t:Ticket): string {
   const hash = createHash("sha1").update(JSON.stringify(t)).digest("base64url"); 
   return `"${hash}"`;
}

function etagMatches(header: string | undefined, etag: string): boolean {
    if (!header) return false;
    if (header.trim() === "*" ) return true;
    return header.split(",").some((tag) => tag.trim().replace(/^W\//, "") === etag);
}

const app = express();
app.use(express.json({ limit: "100kb" }));

// CORS
app.use(cors({origin: ["https://example.com"]}));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/v1/tickets", (req, res) => {
  const q = parse(listQuery, req.query);
  let items = [...tickets.values()];
  if (q.status) items = items.filter((t) => t.status === q.status);
  const start = (q.page - 1) * q.limit;
  res.json({
    data: items.slice(start, start + q.limit),
    meta: { page: q.page, limit: q.limit, total: items.length },
  });
});

app.post("/api/v1/tickets", (req, res) => {
  const body = parse(createSchema, req.body);
  const now = new Date().toISOString();
  const ticket: Ticket = { id: randomUUID(), ...body, status: "open", createdAt: now, updatedAt: now };
  tickets.set(ticket.id, ticket);
  res.status(201).location(`/api/v1/tickets/${ticket.id}`).json(ticket);
});

app.get("/api/v1/tickets/:id", (req, res) => {
  const ticket = findOr404(req.params.id);
  const etag = etagFor(ticket);

  res.set("ETag", etag);
  res.set("Cache-Control", "no-cache"); // cache but revalidate every time

  if (etagMatches(req.get("If-None-Match"), etag)) {
      res.status(304).end();
      return;
  }
  res.json(ticket);
});

app.patch("/api/v1/tickets/:id", (req, res) => {
  const ticket = findOr404(req.params.id);
  const changes = parse(updateSchema, req.body);
  const updated: Ticket = { ...ticket, ...changes, updatedAt: new Date().toISOString() };
  tickets.set(ticket.id, updated);
  res.json(updated);
});

app.delete("/api/v1/tickets/:id", (req, res) => {
  findOr404(req.params.id);
  tickets.delete(req.params.id);
  res.status(204).end();
});

// Unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

// Central error handler (must have 4 params)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if ((err as { type?: string })?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "Malformed JSON body" } });
    return;
  }
  console.error(err); // log details server-side, never leak them to the client
  res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`listening on http://localhost:${port}`));
