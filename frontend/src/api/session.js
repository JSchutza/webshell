import axios from 'axios'

// Set base URL for API - use explicit URL with no trailing slash
const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000,
  withCredentials: true // Keep credentials enabled for session management
})

/**
 * Check if the backend server is available
 * @returns {Promise<boolean>} - True if server is available
 */
export const checkServerStatus = async () => {
  try {
    const response = await api.get('/status')
    console.log('Server status:', response.data)
    return true
  } catch (error) {
    console.error('Backend server is not available:', error)
    return false
  }
}

/**
 * Check if a session exists on the backend
 * @param {string} sessionId - Session ID to check
 * @returns {Promise<boolean>} - True if session exists
 */
export const checkSession = async (sessionId) => {
  if (!sessionId) return false
  
  try {
    // Use a lightweight command like 'pwd' to check if session exists
    await api.post('/command', {
      sessionId,
      command: 'pwd',
    })
    console.log('Session exists:', sessionId)
    return true
  } catch (error) {
    // If error is 404 with 'Session not found', session is invalid
    if (error.response?.status === 404 && error.response?.data?.error?.includes('Session not found')) {
      console.log('Session not found:', sessionId)
      return false
    }
    
    // For network errors, we can't be sure, so throw
    if (error.code === 'ERR_NETWORK') {
      throw new Error('Unable to connect to backend server. Is it running on port 3001?')
    }
    
    // Other errors likely mean the session doesn't exist
    console.error('Error checking session:', error)
    return false
  }
}

/**
 * Start a new terminal session
 * @returns {Promise<Object>} - Session information
 */
export const startSession = async () => {
  try {
    console.log('Starting new session...')
    const response = await api.post('/start-session')
    console.log('Session started:', response.data)
    return response.data
  } catch (error) {
    console.error('Error starting session:', error)
    if (error.code === 'ERR_NETWORK') {
      throw new Error('Unable to connect to backend server. Is it running on port 3001?')
    }
    throw new Error(error.response?.data?.error || 'Could not start session')
  }
}

/**
 * Execute a command in the container
 * @param {string} sessionId - Session ID
 * @param {string} command - Command to execute
 * @returns {Promise<Object>} - Command execution result
 */
export const executeCommand = async (sessionId, command) => {
  try {
    console.log(`Executing command: ${command}`)
    // Log the full URL being called
    console.log(`POST URL: ${api.defaults.baseURL}/command`)
    
    const response = await api.post('/command', {
      sessionId,
      command,
    })
    
    console.log('Command response:', response.data)
    return response.data
  } catch (error) {
    console.error('Error executing command:', error)
    console.error('Error details:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data
    })
    
    if (error.code === 'ERR_NETWORK') {
      throw new Error('Unable to connect to backend server. Is it running on port 3001?')
    }
    throw new Error(error.response?.data?.error || 'Command execution failed')
  }
}

/**
 * End the terminal session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} - Result
 */
export const endSession = async (sessionId) => {
  if (!sessionId) {
    console.log('No session ID provided, skipping end session call')
    return { success: true }
  }
  
  try {
    console.log(`Ending session: ${sessionId}`)
    console.log(`POST URL: ${api.defaults.baseURL}/end-session`)
    
    const response = await api.post('/end-session', {
      sessionId,
    })
    console.log('Session ended successfully')
    return response.data
  } catch (error) {
    console.error('Error ending session:', error)
    console.error('Error details:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status
    })
    
    if (error.code === 'ERR_NETWORK') {
      throw new Error('Unable to connect to backend server. Is it running on port 3001?')
    }
    throw new Error(error.response?.data?.error || 'Could not end session')
  }
} 