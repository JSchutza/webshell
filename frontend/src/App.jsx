import { useState, useEffect } from 'react'
import Terminal from './components/Terminal'
import { startSession, checkServerStatus, checkSession } from './api/session'

function App() {
  const [sessionId, setSessionId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [darkMode, setDarkMode] = useState(true)
  const [backendStatus, setBackendStatus] = useState('checking')

  // First check if backend is available
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const isAvailable = await checkServerStatus()
        setBackendStatus(isAvailable ? 'connected' : 'unavailable')
        
        if (!isAvailable) {
          setError('Backend server is not available. Make sure it is running on port 3001.')
        }
      } catch (err) {
        console.error('Failed to check backend status:', err)
        setBackendStatus('unavailable')
        setError('Failed to connect to the backend server. Please make sure it is running.')
      }
    }
    
    checkBackend()
  }, [])

  // Initialize session after backend check
  useEffect(() => {
    if (backendStatus !== 'connected') return
    
    const initSession = async () => {
      try {
        // Check for existing session
        const existingSessionId = localStorage.getItem('webshell_session_id')
        
        if (existingSessionId) {
          console.log('Found existing session, verifying:', existingSessionId)
          // Verify if the session still exists on the backend
          const isValid = await checkSession(existingSessionId)
          
          if (isValid) {
            console.log('Using existing session:', existingSessionId)
            setSessionId(existingSessionId)
            setIsLoading(false)
            return
          }
          // If not valid, continue to create a new session
          console.log('Stored session is invalid, removing from localStorage')
          localStorage.removeItem('webshell_session_id')
        }
        
        // Start a new session
        console.log('Creating new session')
        const { sessionId } = await startSession()
        localStorage.setItem('webshell_session_id', sessionId)
        setSessionId(sessionId)
      } catch (err) {
        console.error('Failed to initialize session:', err)
        setError(err.message || 'Failed to connect to the server. Please try again later.')
      } finally {
        setIsLoading(false)
      }
    }

    initSession()
  }, [backendStatus])

  const toggleTheme = () => {
    setDarkMode(!darkMode)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white text-xl">
          {backendStatus === 'checking' 
            ? 'Checking backend server...' 
            : 'Initializing terminal...'}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-900">
        <div className="text-white text-xl max-w-md p-4">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p>{error}</p>
          <div className="mt-4 p-3 bg-red-800 rounded-md">
            <h3 className="font-bold">Troubleshooting:</h3>
            <ul className="list-disc ml-5 mt-2">
              <li>Check if backend server is running on port 3001</li>
              <li>Run <code className="bg-red-700 px-1 rounded">./run-backend.sh</code> in a separate terminal</li>
              <li>Make sure Docker is installed and running</li>
              <li>Try clearing session data: <button 
                  onClick={() => {
                    localStorage.removeItem('webshell_session_id'); 
                    window.location.reload();
                  }}
                  className="bg-red-700 px-1 rounded hover:bg-red-600"
                >
                  Clear Session
                </button>
              </li>
            </ul>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <header className={`flex justify-between items-center p-2 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
        <div className="text-xl font-bold ml-2 flex items-center">
          <span className={darkMode ? 'text-green-400' : 'text-green-600'}>WebShell</span>
          <span className={`ml-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Unix Terminal in Browser
          </span>
        </div>
        <div className="flex items-center">
          <div className={`mr-4 px-2 py-1 rounded text-sm ${backendStatus === 'connected' 
            ? 'bg-green-700 text-green-100' 
            : 'bg-red-700 text-red-100'}`}>
            {backendStatus === 'connected' ? 'Backend Connected' : 'Backend Offline'}
          </div>
          <button 
            onClick={toggleTheme}
            className={`p-2 rounded ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-300 text-gray-700'}`}
          >
            {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden">
        {sessionId && <Terminal sessionId={sessionId} darkMode={darkMode} />}
      </main>
      
      <footer className={`p-2 text-xs text-center ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
        WebShell - Secure sandboxed shell environment in your browser
      </footer>
    </div>
  )
}

export default App 