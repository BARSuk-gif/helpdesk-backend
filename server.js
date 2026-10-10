import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import * as crypto from "crypto";
import pino from 'pino';
import pinoPretty from 'pino-pretty';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const logger = pino(pinoPretty());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tickets.json');

app.use(cors());
app.use(
  bodyParser.json({
    type(req) {
      return true;
    },
  })
);
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

const defaultTickets = [
  {
    id: crypto.randomUUID(),
    name: "Поменять краску в принтере, ком. 404",
    description: "Принтер HP LJ-1210, картриджи на складе",
    status: false,
    created: Date.now(),
  },
  {
    id: crypto.randomUUID(),
    name: "Переустановить Windows, PC-Hall24",
    description: "",
    status: false,
    created: Date.now(),
  },
  {
    id: crypto.randomUUID(),
    name: "Установить обновление KB-31642dv3875",
    description: "Вышло критическое обновление для Windows",
    status: false,
    created: Date.now(),
  },
];

const readTickets = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultTickets, null, 2), 'utf8');
      return [...defaultTickets];
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    logger.error(`Error reading tickets file: ${error.message}`);
    return [...defaultTickets];
  }
};

const writeTickets = (data) => {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    logger.error(`Error writing tickets file: ${error.message}`);
  }
};

let tickets = readTickets();

app.use(async (request, response) => {
  const { method, id } = request.query;
  switch (method) {
    case "allTickets": {
      logger.info('All tickets has been called');
      const list = tickets.map(({ id, name, status, created }) => ({ id, name, status, created }));
      response.send(JSON.stringify(list)).end();
      break;
    }
    case "ticketById": {
      const ticket = tickets.find((ticket) => ticket.id === id);
      if (!ticket) {
        response
          .status(404)
          .send(JSON.stringify({ message: "Ticket not found" }))
          .end();
        break;
      }
      response.send(JSON.stringify(ticket)).end();
      break;
    }
    case "createTicket": {
      try {
        const createData = request.body;
        const name = typeof createData.name === 'string' ? createData.name.trim() : '';

        if (!name) {
          logger.warn('createTicket: empty name');
          response.status(400).send(JSON.stringify({ message: 'Name is required' })).end();
          return;
        }

        const newTicket = {
          id: crypto.randomUUID(),
          name,
          status: false,
          description: typeof createData.description === 'string' ? createData.description.trim() : '',
          created: Date.now(),
        };
        tickets.push(newTicket);
        writeTickets(tickets);
        logger.info(`New ticket created: ${JSON.stringify(newTicket)}`);
        response.send(JSON.stringify(newTicket)).end();
      } catch (error) {
        logger.error(`Error creating new ticket: ${error.message}`);
        response.status(500).send(JSON.stringify({ error: error.message }));
      }
      break;
    }
    case "deleteById": {
      const ticket = tickets.find((ticket) => ticket.id === id);
      if (ticket) {
        tickets = tickets.filter((ticket) => ticket.id !== id);
        writeTickets(tickets);
        logger.info(`Ticket deleted: ${JSON.stringify(ticket)}`);
        response.status(204).end();
      } else {
        logger.warn(`Ticket not found: ${id}`);
        response.status(404).send(JSON.stringify({ message: "Ticket not found" })).end();
      }
      break;
    }
     
    case "updateById": {
      try {
        const ticket = tickets.find((t) => t.id === id);

        if (!ticket) {
          logger.warn(`Ticket not found: ${id}`);
          response.status(404).send(JSON.stringify({ message: "Ticket not found" })).end();
          return;
        }

        const updateData = request.body || {};

        // белый список: id и created менять нельзя
        if (typeof updateData.name === 'string') {
          const name = updateData.name.trim();
          if (!name) {
            response.status(400).send(JSON.stringify({ message: 'Name cannot be empty' })).end();
            return;
          }
          ticket.name = name;
        }

        if (typeof updateData.description === 'string') {
          ticket.description = updateData.description.trim();
        }

        if (typeof updateData.status === 'boolean') {
          ticket.status = updateData.status;
        }

        writeTickets(tickets);
        logger.info(`Ticket updated: ${JSON.stringify(ticket)}`);
        response.send(JSON.stringify(ticket)).end();
      } catch (error) {
        logger.error(`Error updating ticket: ${error.message}`);
        response.status(500).send(JSON.stringify({ error: error.message })).end();
      }
      break;
    }

    default:
      logger.warn(`Unknown method: ${method}`);
      response.status(404).end();
      break;
  }
});

const port = process.env.PORT || 7070;

const bootstrap = async () => {
  try {
    app.listen(port, () =>
        logger.info(`Server has been started on port ${port}`)
    );
  } catch (error) {
    console.error(error);
  }
};

bootstrap();
