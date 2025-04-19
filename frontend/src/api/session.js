import axios from 'axios'

// Set base URL for API
const api = axios.create({
  baseURL: 'http://localhost:3001/api', // Use full URL instead of relative path
  timeout: 10000,
  withCredentials: true
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
    const response = await api.post('/command', {
      sessionId,
      command,
    })
    return response.data
  } catch (error) {
    console.error('Error executing command:', error)
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
    const response = await api.post('/end-session', {
      sessionId,
    })
    console.log('Session ended successfully')
    return response.data
  } catch (error) {
    console.error('Error ending session:', error)
    if (error.code === 'ERR_NETWORK') {
      throw new Error('Unable to connect to backend server. Is it running on port 3001?')
    }
    throw new Error(error.response?.data?.error || 'Could not end session')
  }
} 