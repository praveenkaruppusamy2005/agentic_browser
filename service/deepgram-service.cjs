const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const { WebSocketServer } = require("ws");
const { createServer } = require("http");
const dotenv = require("dotenv");

dotenv.config();

const PORT = process.env.DEEPGRAM_PORT || 5002;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "abef8620af739141d202b79d340d6c7f82151d5b";

// Create Deepgram client
const deepgram = createClient(DEEPGRAM_API_KEY);

// Create HTTP server
const server = createServer();

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[Deepgram Service] Client connected');

  // Create Deepgram live transcription connection
  const deepgramConnection = deepgram.listen.live({
    model: "nova-2",
    language: "en-US",
    smart_format: true,
    encoding: "linear16",
    sample_rate: 16000,
    interim_results: true,
    punctuate: true,
  });

  // Handle Deepgram connection open
  deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
    console.log('[Deepgram Service] Deepgram connection opened');
    ws.send(JSON.stringify({ type: 'status', message: 'Deepgram connection open' }));
  });

  // Handle transcripts from Deepgram
  deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
    try {
      // Forward transcript to frontend in expected format
      ws.send(JSON.stringify({
        type: 'transcript',
        data: {
          is_final: data.is_final || false,
          channel: {
            alternatives: data.channel?.alternatives || []
          }
        }
      }));
    } catch (err) {
      console.error('[Deepgram Service] Error forwarding transcript:', err);
    }
  });

  // Handle Deepgram metadata
  deepgramConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
    console.log('[Deepgram Service] Metadata:', data);
  });

  // Handle Deepgram errors
  deepgramConnection.on(LiveTranscriptionEvents.Error, (err) => {
    console.error('[Deepgram Service] Deepgram error:', err);
    ws.send(JSON.stringify({
      type: 'error',
      message: err.message || 'Deepgram transcription error'
    }));
  });

  // Handle Deepgram connection close
  deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
    console.log('[Deepgram Service] Deepgram connection closed');
  });

  // Forward audio data from frontend to Deepgram
  ws.on('message', (audioData) => {
    try {
      if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
        // Send binary audio data to Deepgram
        deepgramConnection.send(audioData);
      }
    } catch (err) {
      console.error('[Deepgram Service] Error sending audio to Deepgram:', err);
    }
  });

  // Handle frontend WebSocket close
  ws.on('close', () => {
    console.log('[Deepgram Service] Client disconnected');
    try {
      deepgramConnection.finish();
    } catch (err) {
      console.error('[Deepgram Service] Error closing Deepgram connection:', err);
    }
  });

  // Handle frontend WebSocket error
  ws.on('error', (err) => {
    console.error('[Deepgram Service] WebSocket error:', err);
    try {
      deepgramConnection.finish();
    } catch (e) {}
  });
});

server.listen(PORT, () => {
  console.log(`[Deepgram Service] WebSocket server listening on ws://127.0.0.1:${PORT}`);
  console.log(`[Deepgram Service] Using Deepgram API key: ${DEEPGRAM_API_KEY.substring(0, 10)}...`);
});

