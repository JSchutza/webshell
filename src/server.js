const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const DOCKER_IMAGE = 'webshell-image';

// CORS configuration - more explicit and permissive
app.use(cors({
  origin: 'http://localhost:3000', // Frontend URL instead of wildcard
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Body:`, req.body);
  next();
});

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api', apiLimiter);

// Session storage
const sessions = {};

// Command security - blacklist approach
const BLACKLISTED_COMMANDS = [
  'sudo', 'su', // Privilege escalation
  'apt', 'apt-get', 'yum', 'dnf', 'pacman', // Package management
  'systemctl', 'service', // System service management
  'mkfs', 'fdisk', 'parted', // Disk partitioning
  'ssh', 'scp', 'sftp', // Remote access
  'nc', 'netcat', // Raw networking (in some modes)
  'nmap', // Network scanning
  'chroot', // Change root directory
  ':(){ :|:& };:', 'perl -e', // Fork bombs and code execution
  'mount', 'umount', // Filesystem mounting
  'adduser', 'useradd', 'userdel', // User management
  'passwd', // Password changes
  'reboot', 'shutdown', 'halt', 'poweroff', // System control
  'iptables', 'ufw', // Firewall management
  'modprobe', 'insmod', 'rmmod', // Kernel module management
  'crontab', // Scheduling
];

// Commands that need argument sanitization
const COMMANDS_NEEDING_SANITIZATION = {
  'rm': sanitizeRm,
  'dd': sanitizeDd,
  'chmod': sanitizeChmod,
  'chown': sanitizeChown,
  'kill': sanitizeKill,
  'wget': sanitizeDownload,
  'curl': sanitizeDownload,
  'eval': () => ({ allowed: false, reason: 'eval command is not allowed' }),
  'exec': () => ({ allowed: false, reason: 'exec command is not allowed' }),
};

// Sanitize dangerous parts of commands
function sanitizeCommand(command) {
  // Extract the base command and arguments
  const parts = command.split(' ');
  const baseCommand = parts[0];
  
  // Check against blacklist
  if (BLACKLISTED_COMMANDS.includes(baseCommand)) {
    return {
      allowed: false,
      reason: `Command '${baseCommand}' is not allowed for security reasons`
    };
  }
  
  // Check if command needs special sanitization
  if (COMMANDS_NEEDING_SANITIZATION[baseCommand]) {
    return COMMANDS_NEEDING_SANITIZATION[baseCommand](command, parts);
  }
  
  // Allow pipes for command chaining, but block other dangerous operations
  if (command.includes('&&') || command.includes('||') || 
      command.includes(';') || 
      command.includes('$(') || command.includes('`')) {
    return {
      allowed: false,
      reason: 'Command chaining with &&, ||, ;, $(), or backticks is not allowed'
    };
  }
  
  // Handle piped commands - check each command in the pipe
  if (command.includes('|')) {
    const pipedCommands = command.split('|').map(cmd => cmd.trim());
    
    for (const cmd of pipedCommands) {
      // Skip empty commands
      if (!cmd) continue;
      
      // Get the base command of this segment
      const cmdParts = cmd.split(' ');
      const cmdBase = cmdParts[0];
      
      // Check if any command in the pipe is blacklisted
      if (BLACKLISTED_COMMANDS.includes(cmdBase)) {
        return {
          allowed: false,
          reason: `Command '${cmdBase}' in pipe is not allowed for security reasons`
        };
      }
      
      // Check if any command needs sanitization
      if (COMMANDS_NEEDING_SANITIZATION[cmdBase]) {
        const sanitizeResult = COMMANDS_NEEDING_SANITIZATION[cmdBase](cmd, cmdParts);
        if (!sanitizeResult.allowed) {
          return sanitizeResult;
        }
      }
    }
  }
  
  // Default: allow the command
  return { allowed: true, sanitized: command };
}

// Sanitize rm command to prevent dangerous usage
function sanitizeRm(command, parts) {
  // Block recursive forced removal of root or other sensitive directories
  if (parts.includes('-rf') || parts.includes('-fr') || parts.includes('-r') || parts.includes('-f')) {
    const targetIndex = parts.findIndex(part => part.startsWith('/') || part === '.' || part === '..');
    if (targetIndex !== -1) {
      const target = parts[targetIndex];
      // Dangerous paths that should be blocked with rm -rf
      if (target === '/' || target === '/*' || target === '..' || target === '../..' || target === '../*') {
        return {
          allowed: false,
          reason: `Removing '${target}' recursively is not allowed`
        };
      }
    }
  }
  return { allowed: true, sanitized: command };
}

// Sanitize dd command to prevent dangerous usage
function sanitizeDd(command, parts) {
  // Prevent writing to system devices or using dangerous block sizes
  const dangerousTargets = ['if=/dev/zero', 'of=/dev/sda', 'of=/dev/hda', 'bs=1G', 'bs=1024M'];
  for (const part of parts) {
    for (const target of dangerousTargets) {
      if (part.startsWith(target)) {
        return {
          allowed: false,
          reason: `Using dd with '${part}' is not allowed for security reasons`
        };
      }
    }
  }
  return { allowed: true, sanitized: command };
}

// Sanitize chmod command
function sanitizeChmod(command, parts) {
  // Block setting dangerous permissions on important directories
  if (parts.includes('777') || parts.includes('a+rwx')) {
    const targetIndex = parts.findIndex(part => part.startsWith('/'));
    if (targetIndex !== -1) {
      return {
        allowed: false,
        reason: 'Setting fully open permissions on system directories is not allowed'
      };
    }
  }
  return { allowed: true, sanitized: command };
}

// Sanitize chown command
function sanitizeChown(command, parts) {
  // Block changing ownership of important directories
  const targetIndex = parts.findIndex(part => part.startsWith('/'));
  if (targetIndex !== -1 && !parts[targetIndex].startsWith('/home/webuser')) {
    return {
      allowed: false,
      reason: 'Changing ownership of system directories is not allowed'
    };
  }
  return { allowed: true, sanitized: command };
}

// Sanitize kill command
function sanitizeKill(command, parts) {
  // Block killing system processes
  if (parts.includes('-9') || parts.includes('-KILL')) {
    return {
      allowed: false,
      reason: 'Force killing processes is not allowed'
    };
  }
  return { allowed: true, sanitized: command };
}

// Sanitize curl and wget to prevent piping to bash
function sanitizeDownload(command, parts) {
  if (command.includes('| bash') || command.includes('| sh') || 
      command.includes('|bash') || command.includes('|sh')) {
    return {
      allowed: false,
      reason: 'Piping downloads directly to shell is not allowed'
    };
  }
  return { allowed: true, sanitized: command };
}

const COMMAND_TIMEOUT = 5000; // 5 seconds

// Build Docker image on startup
const buildDockerImage = () => {
  return new Promise((resolve, reject) => {
    console.log('Building Docker image...');
    exec('docker build -t webshell-image .', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error building Docker image: ${error.message}`);
        return reject(error);
      }
      console.log('Docker image built successfully');
      resolve();
    });
  });
};

// Create an API router
const apiRouter = express.Router();

// Add a simple test endpoint to check if the server is running
apiRouter.get('/status', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running', timestamp: Date.now() });
});

// Start session endpoint
apiRouter.post('/start-session', (req, res) => {
  console.log('Starting new session');
  const sessionId = uuidv4();
  const containerName = `webshell-${sessionId}`;
  
  // Create a new Docker container for this session - with network access
  exec(`docker run -d --name ${containerName} ${DOCKER_IMAGE} tail -f /dev/null`, (error, stdout, stderr) => {
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

// Command execution endpoint
apiRouter.post('/command', (req, res) => {
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
  const sanitizedCommand = sanitizeCommand(command);
  if (!sanitizedCommand.allowed) {
    console.log(`Command not allowed: ${command}, Reason: ${sanitizedCommand.reason}`);
    return res.status(403).json({ 
      stdout: '',
      stderr: `Command rejected: ${sanitizedCommand.reason}\n\nFor security reasons, certain commands and arguments are restricted in this environment.\nTry a different approach or refer to the help documentation.`,
      status: 1
    });
  }
  
  const { containerName } = sessions[sessionId];
  
  // Execute the command in the container
  exec(`docker exec ${containerName} ${sanitizedCommand.sanitized}`, { timeout: COMMAND_TIMEOUT }, (error, stdout, stderr) => {
    if (error && error.killed) {
      console.log(`Command timed out: ${sanitizedCommand.sanitized}`);
      return res.status(408).json({
        stdout: '',
        stderr: 'Command execution timed out',
        status: 124
      });
    }
    
    console.log(`Command executed: ${sanitizedCommand.sanitized}, Status: ${error ? error.code : 0}`);
    res.json({
      stdout: stdout || '',
      stderr: stderr || '',
      status: error ? error.code : 0
    });
  });
});

// End session endpoint
apiRouter.post('/end-session', (req, res) => {
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

// Mount the API router
app.use('/api', apiRouter);

// Default route for testing
app.get('/', (req, res) => {
  res.send('WebShell API Server is running. Use /api endpoints to interact with the API.');
});

// Catch-all route for 404s
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Endpoint not found' });
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

// Start the server
const startServer = async () => {
  try {
    // Build Docker image first
    await buildDockerImage();
    
    // Then start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Available endpoints:');
      console.log('- GET  /api/status');
      console.log('- POST /api/start-session');
      console.log('- POST /api/command');
      console.log('- POST /api/end-session');
      console.log('- GET  / (Server test page)');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 