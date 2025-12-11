// Deepgram speech-to-text Node.js service
// Place this file in electron-app/services/deepgram-server.js

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { readFileSync, unlinkSync } from 'fs';
// Correct way to import the client constructor from the Deepgram SDK
import { createClient } from '@deepgram/sdk'; 
// Correct named import for WebSocket Server
import { WebSocketServer } from 'ws'; 
import { createServer } from 'http';


const app = express();
const upload = multer({ dest: 'uploads/' });
// Using process.env for the API key is recommended practice
const PORT = process.env.DEEPGRAM_PORT || 5002;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || 'f9071b5bd59b40a869272ac2b8832bd043e413c9'; 

app.use(cors());

// Instantiate the Deepgram client using the correct factory function (createClient)
const deepgram = createClient(DEEPGRAM_API_KEY);

const server = createServer(app);
// Use the imported WebSocketServer class and attach it to the HTTP server
const wss = new WebSocketServer({ server });

wss.on('connection', async (ws) => {
  // Use deepgram.listen.live() for streaming transcription
  const deepgramSocket = deepgram.listen.live({
    punctuate: true,
    interim_results: true,
    language: 'en-US', // Standard language tag
    encoding: 'linear16',
    sample_rate: 16000,
  });

  deepgramSocket.on('open', () => {
    ws.send(JSON.stringify({ type: 'status', message: 'Deepgram connection open' }));
  });

  // Use 'transcript' event for incoming results
  deepgramSocket.on('transcript', (data) => {
    // Forward the full Deepgram data object to the client
    ws.send(JSON.stringify({ type: 'transcript', data }));
  });

  deepgramSocket.on('error', (err) => {
    ws.send(JSON.stringify({ type: 'error', message: err.message }));
  });

  ws.on('message', (msg) => {
    // Forward audio data received from the client to Deepgram
    deepgramSocket.send(msg);
  });

  ws.on('close', () => {
    // Gracefully close the Deepgram socket
    deepgramSocket.finish(); 
  });
});

app.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No audio file uploaded.' });
  }
  try {
    const audio = readFileSync(req.file.path);
    
    // Use deepgram.transcription.preRecorded() with Buffer and options
    const result = await deepgram.transcription.preRecorded(
      audio, 
      { mimetype: req.file.mimetype }
    );
    
    unlinkSync(req.file.path); // Clean up uploaded file
    
    // Access the transcript from the result object
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    res.json({ ok: true, transcript });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'deepgram', port: PORT });
});

server.listen(PORT, () => {
  console.log(`Deepgram server (HTTP+WebSocket) listening on port ${PORT}`);
});