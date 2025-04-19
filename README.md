# WebShell - Web-Based Unix Shell Simulator

WebShell is a full-stack web application that provides a secure, isolated Unix shell environment in your browser. Each user session is sandboxed in its own Docker container, allowing command execution without risking the host system.

## Features

- Real-time terminal emulation in the browser
- Secure, isolated Docker container per session
- Support for most standard Unix commands
- Command history with up/down arrow navigation
- Dark/light theme toggle
- Automatic container cleanup after session timeout
- Command pipe chaining support
- Intelligent command argument sanitization

## Tech Stack

### Frontend
- Vite + React for UI
- Tailwind CSS for styling
- xterm.js for terminal emulation

### Backend
- Express.js (Node.js)
- Docker for container management
- UUID for session management

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
COMMAND_TIMEOUT=5000
SESSION_TIMEOUT=1800000
```

4. Build the Docker image:
```bash
docker build -t webshell-image .
```

### Running the Application

1. Start the backend server:
```bash
./run-backend.sh
```

2. In a separate terminal, start the frontend:
```bash
./run-frontend.sh
```

3. Open your browser and navigate to `http://localhost:3000`

## Security

WebShell uses a comprehensive security model to provide a flexible yet secure terminal environment:

### Security Architecture

- **Container Isolation**: Each session runs in a dedicated Docker container
- **Non-privileged User**: Containers run as a non-root user
- **Network Access**: Containers have limited network access
- **Resource Limits**: Commands have execution timeouts
- **Rate Limiting**: API endpoints are protected against abuse

### Command Security

Instead of a restrictive whitelist, WebShell uses an intelligent security approach:

- **Blacklist Model**: Only potentially dangerous commands are blocked
- **Argument Sanitization**: Certain commands are allowed but have their arguments checked
- **Command Chaining**: Pipe (`|`) chaining is allowed, but other forms (`&&`, `;`, etc.) are restricted
- **Command Substitution**: Backticks and `$()` substitution is restricted
- **Detailed Feedback**: Helpful error messages explain why commands are rejected

### Blacklisted Categories

- Privilege escalation (`sudo`, `su`)
- Package management (`apt`, `yum`, `dnf`)
- System services (`systemctl`, `service`)
- Disk partitioning (`mkfs`, `fdisk`)
- Remote access (`ssh`, `scp`)
- System control (`reboot`, `shutdown`)

### Argument Restrictions

- Recursive removal of system directories (`rm -rf /`)
- Writing to system devices (`dd` of=/dev/sda)
- Setting dangerous permissions (`chmod 777 /`)
- Changing ownership of system files (`chown`)
- Force killing processes (`kill -9`)
- Piping downloads directly to shell (`curl | bash`)

For more information, run the `security` command in the terminal.

## Deployment

- Frontend: Deploy to Vercel, Netlify, or similar static hosting
- Backend: Deploy to a server with Docker installed (Render, Fly.io, DigitalOcean)

## License

MIT 