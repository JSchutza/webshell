const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - more explicit
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Session storage
const sessions = {};
const ALLOWED_COMMANDS = ['ls', 'pwd', 'cat', 'echo', 'mkdir', 'touch', 'whoami', 'date', 'uptime', 'tree'];
const COMMAND_TIMEOUT = 5000; // 5 seconds

// Add a simple test endpoint to check if the server is running
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running', timestamp: Date.now() });
});

// Routes
app.post('/api/start-session', (req, res) => {
  console.log('Starting new session');
  const sessionId = uuidv4();
  const containerName = `webshell-${sessionId}`;
  
  // Create a new Docker container for this session
  exec(`docker run -d --name ${containerName} --network none alpine:latest tail -f /dev/null`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error creating container: ${error.message}`);
      return res.status(500).json({ error: 'Failed to create container' });
    }
    
    const containerId = stdout.trim();
    sessions[sessionId] = {
      containerId,
      containerName,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
    
    console.log(`Session created: ${sessionId}, Container: ${containerName}`);
    res.json({ sessionId });
  });
});

app.post('/api/command', (req, res) => {
  const { sessionId, command } = req.body;
  console.log(`Executing command: ${command} for session: ${sessionId}`);
  
  // Validate session
  if (!sessionId || !sessions[sessionId]) {
    console.log(`Session not found: ${sessionId}`);
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Update last activity
  sessions[sessionId].lastActivity = Date.now();
  
  // Validate command
  const baseCommand = command.split(' ')[0];
  if (!ALLOWED_COMMANDS.includes(baseCommand)) {
    console.log(`Command not allowed: ${command}`);
    return res.status(403).json({ 
      stdout: '',
      stderr: 'Command not allowed',
      status: 1
    });
  }
  
  const { containerName } = sessions[sessionId];
  
  // Execute the command in the container
  exec(`docker exec ${containerName} ${command}`, { timeout: COMMAND_TIMEOUT }, (error, stdout, stderr) => {
    if (error && error.killed) {
      console.log(`Command timed out: ${command}`);
      return res.status(408).json({
        stdout: '',
        stderr: 'Command execution timed out',
        status: 124
      });
    }
    
    console.log(`Command executed: ${command}, Status: ${error ? error.code : 0}`);
    res.json({
      stdout: stdout || '',
      stderr: stderr || '',
      status: error ? error.code : 0
    });
  });
});

app.post('/api/end-session', (req, res) => {
  const { sessionId } = req.body;
  console.log(`Ending session: ${sessionId}`);
  
  if (!sessionId || !sessions[sessionId]) {
    console.log(`Session not found: ${sessionId}`);
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const { containerName } = sessions[sessionId];
  
  // Stop and remove the container
  exec(`docker rm -f ${containerName}`, (error) => {
    if (error) {
      console.error(`Error removing container: ${error.message}`);
    }
    
    delete sessions[sessionId];
    console.log(`Session ended: ${sessionId}`);
    res.json({ success: true });
  });
});

// Cleanup stale sessions periodically
setInterval(() => {
  const now = Date.now();
  const sessionTimeout = 30 * 60 * 1000; // 30 minutes
  
  Object.keys(sessions).forEach(sessionId => {
    const session = sessions[sessionId];
    if (now - session.lastActivity > sessionTimeout) {
      exec(`docker rm -f ${session.containerName}`, (error) => {
        if (error) {
          console.error(`Error removing stale container: ${error.message}`);
        }
        console.log(`Cleaned up stale session: ${sessionId}`);
        delete sessions[sessionId];
      });
    }
  });
}, 5 * 60 * 1000); // Check every 5 minutes

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`- GET  /api/status`);
  console.log(`- POST /api/start-session`);
  console.log(`- POST /api/command`);
  console.log(`- POST /api/end-session`);
}); 