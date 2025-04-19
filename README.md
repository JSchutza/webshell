# WebShell - Web-Based Unix Shell Simulator

WebShell is a full-stack web application that provides a secure, isolated Unix shell environment in your browser. Each user session is sandboxed in its own Docker container, allowing command execution without risking the host system.

## Features

- Real-time terminal emulation in the browser
- Secure, isolated Docker container per session
- Support for common Unix commands
- Command history with up/down arrow navigation
- Dark/light theme toggle
- Automatic container cleanup after session timeout

## Tech Stack

### Frontend
- Vite + React for UI
- Tailwind CSS for styling
- xterm.js for terminal emulation

### Backend
- Express.js (Node.js)
- Docker for container management

## Getting Started

### Prerequisites

- Node.js (v14+)
- Docker installed and running
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/WebShell.git
cd WebShell
```

2. Install dependencies:
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

3. Create a `.env` file in the root directory:
```
PORT=3001
ALLOWED_COMMANDS=ls,pwd,cat,echo,mkdir,touch,whoami,date,uptime,tree
COMMAND_TIMEOUT=5000
SESSION_TIMEOUT=1800000
```

4. Build the Docker image (optional - will use Alpine by default):
```bash
docker build -t webshell-container .
```

### Running the Application

1. Start the backend server:
```bash
npm run dev
```

2. In a separate terminal, start the frontend:
```bash
cd frontend
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

## Security

- Containers run as a non-root user
- Network access is disabled in containers
- Command whitelist to prevent dangerous operations
- Rate limiting on API endpoints
- Command execution timeout

## Deployment

- Frontend: Deploy to Vercel, Netlify, or similar static hosting
- Backend: Deploy to a server with Docker installed (Render, Fly.io, DigitalOcean)

## License

MIT 