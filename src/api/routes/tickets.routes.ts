import { createTicket, getTicket, listTickets, updateTicket } from "../controllers/tickets.controller";
import { Router } from "../core/router";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { validateBody, validateParams } from "../middlewares/validate.middleware";
import { idParams } from "../validators/common.validator";
import { createTicketSchema, ticketActionSchema } from "../validators/tickets.validator";

const ticketId = validateParams(idParams, "Ticket");

export const ticketRoutes = new Router()
  .get("/", authenticate, listTickets)
  .post("/", authenticate, requireRole("STUDENT"), validateBody(createTicketSchema), createTicket)
  .get("/:id", authenticate, ticketId, getTicket)
  .patch("/:id", authenticate, ticketId, validateBody(ticketActionSchema), updateTicket)
  // For clients that can only POST (HTML forms, some tools).
  .post("/:id", authenticate, ticketId, validateBody(ticketActionSchema), updateTicket);
