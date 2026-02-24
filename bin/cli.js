#!/usr/bin/env node
import { startServer } from '../src/server.js';
import open from 'open';

const PORT = Number.parseInt(process.env.PORT ?? '3001', 10);

const server = await startServer(PORT);
const address = server.address();
const effectivePort = typeof address === 'object' && address ? address.port : PORT;
open(`http://localhost:${effectivePort}`);
