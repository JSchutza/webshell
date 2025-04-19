import { useState, useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { executeCommand, endSession } from '../api/session'

const Terminal = ({ sessionId, darkMode }) => {
  const terminalRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)
  const [commandHistory, setCommandHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [currentInput, setCurrentInput] = useState('')
  const [currentPath, setCurrentPath] = useState('~')
  const [isTerminalReady, setIsTerminalReady] = useState(false)
  
  // Get theme based on darkMode
  const getTheme = (isDark) => {
    return isDark 
      ? {
          background: '#1a202c',
          foreground: '#e2e8f0',
          cursor: '#a0aec0',
          selectionBackground: '#4a5568',
          selectionForeground: '#e2e8f0',
        } 
      : {
          background: '#f7fafc',
          foreground: '#1a202c',
          cursor: '#4a5568',
          selectionBackground: '#e2e8f0',
          selectionForeground: '#1a202c',
        }
  }
  
  // Initialize terminal
  useEffect(() => {
    // Only initialize if terminalRef is ready and there's a session
    if (!terminalRef.current || !sessionId) return;
    
    // Cleanup previous terminal instance if it exists
    if (xtermRef.current) {
      try {
        xtermRef.current.dispose();
      } catch (e) {
        console.warn("Error disposing terminal:", e);
      }
    }
    
    // Add a small delay to ensure DOM is fully ready
    const initTimer = setTimeout(() => {
      try {
        // Create xterm instance
        const term = new XTerm({
          cursorBlink: true,
          theme: getTheme(darkMode),
          fontFamily: '"Menlo", "Monaco", "Courier New", monospace',
          fontSize: 14,
          lineHeight: 1.2,
          scrollback: 1000,
          convertEol: true,
        });
        
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        
        // Open terminal in the DOM
        term.open(terminalRef.current);
        
        // Make sure terminal is visible before fitting
        setTimeout(() => {
          try {
            fitAddon.fit();
            setIsTerminalReady(true);
            
            // Set welcome message
            term.writeln('Welcome to WebShell - Unix Terminal in Browser');
            term.writeln('-------------------------------------------');
            term.writeln('This is a secure, sandboxed environment.');
            term.writeln('Type "help" for available commands.');
            term.writeln('');
            
            // Show prompt
            writePrompt(term, currentPath);
            
            // Store references
            xtermRef.current = term;
            fitAddonRef.current = fitAddon;
            
            // Set up event handlers
            setupTerminalHandlers(term);
          } catch (e) {
            console.error("Error fitting terminal:", e);
          }
        }, 100);
      } catch (e) {
        console.error("Error initializing terminal:", e);
      }
    }, 100);
    
    // Cleanup function
    return () => {
      clearTimeout(initTimer);
      try {
        if (xtermRef.current) {
          xtermRef.current.dispose();
          xtermRef.current = null;
        }
        // Don't call endSession here to avoid 404 errors
      } catch (e) {
        console.warn("Error cleaning up terminal:", e);
      }
    };
  }, [sessionId, darkMode]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && isTerminalReady) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          console.warn("Error during resize:", e);
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isTerminalReady]);
  
  // Setup terminal key handlers
  const setupTerminalHandlers = (term) => {
    let currentLine = '';
    
    term.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;
      
      if (domEvent.keyCode === 13) { // Enter key
        // Execute command
        term.write('\r\n');
        handleCommand(currentLine);
        currentLine = '';
        setHistoryIndex(-1);
      } else if (domEvent.keyCode === 8) { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write('\b \b');
        }
      } else if (domEvent.keyCode === 38) { // Up arrow
        // Navigate command history (up)
        if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          
          // Clear current line
          term.write('\x1b[2K\r');
          writePrompt(term, currentPath);
          
          currentLine = commandHistory[commandHistory.length - 1 - newIndex];
          term.write(currentLine);
        }
      } else if (domEvent.keyCode === 40) { // Down arrow
        // Navigate command history (down)
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          
          // Clear current line
          term.write('\x1b[2K\r');
          writePrompt(term, currentPath);
          
          currentLine = commandHistory[commandHistory.length - 1 - newIndex];
          term.write(currentLine);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          
          // Clear current line
          term.write('\x1b[2K\r');
          writePrompt(term, currentPath);
          currentLine = '';
        }
      } else if (printable) {
        // Add to current line
        currentLine += key;
        term.write(key);
      }
      
      // Update state for current input
      setCurrentInput(currentLine);
    });
  };
  
  // Write prompt to terminal
  const writePrompt = (term, path) => {
    if (term) {
      term.write(`\r\nwebuser@webshell:${path}$ `);
    }
  };
  
  // Handle command execution
  const handleCommand = async (command) => {
    if (!xtermRef.current) return;
    
    if (!command.trim()) {
      writePrompt(xtermRef.current, currentPath);
      return;
    }
    
    // Add to history
    setCommandHistory(prev => [...prev, command]);
    
    // Clear command
    setCurrentInput('');
    
    // Handle built-in commands
    if (command === 'clear' || command === 'cls') {
      xtermRef.current.clear();
      writePrompt(xtermRef.current, currentPath);
      return;
    }
    
    if (command === 'help') {
      xtermRef.current.writeln('Available commands:');
      xtermRef.current.writeln('  ls       - List directory contents');
      xtermRef.current.writeln('  pwd      - Print working directory');
      xtermRef.current.writeln('  cat      - Show file contents');
      xtermRef.current.writeln('  echo     - Display text');
      xtermRef.current.writeln('  mkdir    - Create directory');
      xtermRef.current.writeln('  touch    - Create empty file');
      xtermRef.current.writeln('  whoami   - Print current user');
      xtermRef.current.writeln('  date     - Show current date/time');
      xtermRef.current.writeln('  uptime   - Show system uptime');
      xtermRef.current.writeln('  tree     - Display directory tree');
      xtermRef.current.writeln('  ping     - Network ping utility');
      xtermRef.current.writeln('  curl     - Transfer data from/to servers');
      xtermRef.current.writeln('  wget     - Download files from the web');
      xtermRef.current.writeln('  nano     - Simple text editor');
      xtermRef.current.writeln('  vim      - Advanced text editor');
      xtermRef.current.writeln('  clear    - Clear terminal');
      xtermRef.current.writeln('  help     - Show this help');
      xtermRef.current.writeln('  security - Show security information');
      xtermRef.current.writeln('');
      xtermRef.current.writeln('Note: Most standard Linux commands are supported except those that could pose security risks.');
      xtermRef.current.writeln('      Commands can be piped together using |, but other forms of command chaining (&&, ||, ;) are restricted.');
      xtermRef.current.writeln('      Type "security" for more information about security restrictions.');
      writePrompt(xtermRef.current, currentPath);
      return;
    }
    
    if (command === 'security') {
      xtermRef.current.writeln('WebShell Security Information');
      xtermRef.current.writeln('---------------------------');
      xtermRef.current.writeln('This terminal operates in a secure, sandboxed Docker container environment.');
      xtermRef.current.writeln('');
      xtermRef.current.writeln('Security Approach:');
      xtermRef.current.writeln('- Most standard Linux commands are allowed');
      xtermRef.current.writeln('- Specific dangerous commands are blacklisted');
      xtermRef.current.writeln('- Certain commands have argument restrictions');
      xtermRef.current.writeln('- Command pipe (|) chaining is supported');
      xtermRef.current.writeln('- Other command chaining (&&, ||, ;) is restricted');
      xtermRef.current.writeln('- Command substitution ($(), ``) is restricted');
      xtermRef.current.writeln('');
      xtermRef.current.writeln('Blacklisted Commands:');
      xtermRef.current.writeln('- Privilege escalation: sudo, su');
      xtermRef.current.writeln('- Package management: apt, apt-get, yum, dnf');
      xtermRef.current.writeln('- System services: systemctl, service');
      xtermRef.current.writeln('- Disk partitioning: mkfs, fdisk');
      xtermRef.current.writeln('- Remote access: ssh, scp');
      xtermRef.current.writeln('- System control: reboot, shutdown');
      xtermRef.current.writeln('');
      xtermRef.current.writeln('Restricted Operations:');
      xtermRef.current.writeln('- Recursive removal of system directories');
      xtermRef.current.writeln('- Writing to system devices');
      xtermRef.current.writeln('- Setting dangerous permissions');
      xtermRef.current.writeln('- Changing ownership of system files');
      xtermRef.current.writeln('- Force killing processes');
      xtermRef.current.writeln('- Piping downloads directly to shell');
      writePrompt(xtermRef.current, currentPath);
      return;
    }
    
    try {
      if (!sessionId) {
        throw new Error("No active session. Is the backend server running?");
      }
      
      // Execute command on backend
      const response = await executeCommand(sessionId, command);
      
      // Check if we have stdout
      if (response.stdout) {
        const lines = response.stdout.split('\n');
        for (const line of lines) {
          if (line) xtermRef.current.writeln(line);
        }
      }
      
      // Check if we have stderr
      if (response.stderr) {
        const lines = response.stderr.split('\n');
        for (const line of lines) {
          if (line) {
            xtermRef.current.writeln(`\x1b[31m${line}\x1b[0m`); // Red text for errors
          }
        }
      }
      
      // Update path after cd command (simulated, actual path still container-based)
      if (command.startsWith('cd ')) {
        const newPath = command.substring(3).trim();
        if (newPath === '~' || newPath === '') {
          setCurrentPath('~');
        } else if (newPath === '..') {
          if (currentPath !== '~') {
            const parts = currentPath.split('/');
            parts.pop();
            setCurrentPath(parts.join('/') || '~');
          }
        } else if (newPath.startsWith('/')) {
          setCurrentPath(newPath);
        } else {
          setCurrentPath(currentPath === '~' ? `/${newPath}` : `${currentPath}/${newPath}`);
        }
      }
      
    } catch (error) {
      xtermRef.current.writeln(`\x1b[31mError: ${error.message || 'Failed to execute command'}\x1b[0m`);
      xtermRef.current.writeln('\x1b[31mMake sure the backend server is running on port 3001\x1b[0m');
    }
    
    writePrompt(xtermRef.current, currentPath);
  };

  return (
    <div className="terminal-container w-full h-full p-2">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
};

export default Terminal; 