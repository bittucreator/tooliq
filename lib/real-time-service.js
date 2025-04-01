// Real-time communication service using WebSockets
import { debugLog, debugError } from "../debug.js"

// WebSocket connection URL - replace with your actual WebSocket server
const WS_SERVER_URL = "wss://api.sendpe.in/ws"

// WebSocket connection states
const CONNECTION_STATES = {
  CONNECTING: 'connecting',
  OPEN: 'open',
  CLOSING: 'closing',
  CLOSED: 'closed'
}

class RealTimeService {
  constructor() {
    this.socket = null
    this.connectionState = CONNECTION_STATES.CLOSED
    this.messageHandlers = new Map()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 2000 // Start with 2 seconds
    this.heartbeatInterval = null
    this.lastMessageTime = Date.now()
  }

  // Initialize WebSocket connection
  async connect(authToken) {
    if (this.socket && (this.connectionState === CONNECTION_STATES.OPEN || 
                        this.connectionState === CONNECTION_STATES.CONNECTING)) {
      debugLog("WebSocket already connected or connecting")
      return
    }

    try {
      this.connectionState = CONNECTION_STATES.CONNECTING
      debugLog("Connecting to WebSocket server...")

      // Create WebSocket connection with auth token
      this.socket = new WebSocket(`${WS_SERVER_URL}?token=${authToken}`)
      
      // Set up event handlers
      this.socket.onopen = this._handleOpen.bind(this)
      this.socket.onmessage = this._handleMessage.bind(this)
      this.socket.onclose = this._handleClose.bind(this)
      this.socket.onerror = this._handleError.bind(this)
      
      // Return a promise that resolves when connection is established
      return new Promise((resolve, reject) => {
        // Set timeout for connection
        const timeout = setTimeout(() => {
          reject(new Error("WebSocket connection timeout"))
        }, 10000) // 10 seconds timeout
        
        // Temporary handlers for this promise
        const onOpen = () => {
          clearTimeout(timeout)
          this.socket.removeEventListener('open', onOpen)
          this.socket.removeEventListener('error', onError)
          resolve()
        }
        
        const onError = (error) => {
          clearTimeout(timeout)
          this.socket.removeEventListener('open', onOpen)
          this.socket.removeEventListener('error', onError)
          reject(error)
        }
        
        this.socket.addEventListener('open', onOpen)
        this.socket.addEventListener('error', onError)
      })
    } catch (error) {
      debugError("Error connecting to WebSocket server:", error)
      this.connectionState = CONNECTION_STATES.CLOSED
      throw error
    }
  }

  // Send message to the server
  async send(type, data) {
    if (!this.socket || this.connectionState !== CONNECTION_STATES.OPEN) {
      await this.connect()
    }
    
    const message = {
      type,
      data,
      timestamp: Date.now()
    }
    
    try {
      this.socket.send(JSON.stringify(message))
      debugLog(`Sent message: ${type}`)
      return true
    } catch (error) {
      debugError(`Error sending message: ${type}`, error)
      return false
    }
  }

  // Register a handler for a specific message type
  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, [])
    }
    this.messageHandlers.get(messageType).push(handler)
    
    return () => this.off(messageType, handler) // Return unsubscribe function
  }

  // Remove a handler for a specific message type
  off(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) return
    
    const handlers = this.messageHandlers.get(messageType)
    const index = handlers.indexOf(handler)
    
    if (index !== -1) {
      handlers.splice(index, 1)
    }
    
    if (handlers.length === 0) {
      this.messageHandlers.delete(messageType)
    }
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    
    if (this.socket) {
      this.connectionState = CONNECTION_STATES.CLOSING
      this.socket.close()
      this.socket = null
    }
    
    this.connectionState = CONNECTION_STATES.CLOSED
    debugLog("WebSocket disconnected")
  }

  // Handle WebSocket open event
  _handleOpen(event) {
    debugLog("WebSocket connection established")
    this.connectionState = CONNECTION_STATES.OPEN
    this.reconnectAttempts = 0
    this.reconnectDelay = 2000 // Reset reconnect delay
    this.lastMessageTime = Date.now()
    
    // Start heartbeat to keep connection alive
    this._startHeartbeat()
    
    // Notify subscribers
    this._notifyHandlers('connection', { status: 'connected' })
  }

  // Handle WebSocket message event
  _handleMessage(event) {
    this.lastMessageTime = Date.now()
    
    try {
      const message = JSON.parse(event.data)
      debugLog(`Received message: ${message.type}`)
      
      // Handle heartbeat response
      if (message.type === 'pong') {
        return
      }
      
      // Notify subscribers
      this._notifyHandlers(message.type, message.data)
      
      // Also notify generic message handlers
      this._notifyHandlers('message', message)
    } catch (error) {
      debugError("Error parsing WebSocket message:", error)
    }
  }

  // Handle WebSocket close event
  _handleClose(event) {
    const wasConnected = this.connectionState === CONNECTION_STATES.OPEN
    this.connectionState = CONNECTION_STATES.CLOSED
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    
    debugLog(`WebSocket connection closed: ${event.code} ${event.reason}`)
    
    // Attempt to reconnect if the connection was previously established
    // and we haven't exceeded max reconnect attempts
    if (wasConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
      this._attemptReconnect()
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      debugLog("Max reconnect attempts reached, giving up")
      this._notifyHandlers('connection', { 
        status: 'disconnected', 
        permanent: true,
        reason: 'Max reconnect attempts reached'
      })
    }
  }

  // Handle WebSocket error event
  _handleError(error) {
    debugError("WebSocket error:", error)
    this._notifyHandlers('error', { error })
  }

  // Attempt to reconnect with exponential backoff
  _attemptReconnect() {
    this.reconnectAttempts++
    const delay = Math.min(30000, this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1))
    
    debugLog(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(async () => {
      try {
        await this.connect()
        debugLog("Reconnected successfully")
      } catch (error) {
        debugError("Reconnect failed:", error)
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this._attemptReconnect()
        } else {
          debugLog("Max reconnect attempts reached, giving up")
          this._notifyHandlers('connection', { 
            status: 'disconnected', 
            permanent: true,
            reason: 'Max reconnect attempts reached'
          })
        }
      }
    }, delay)
  }

  // Start heartbeat to keep connection alive and detect disconnects
  _startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.connectionState === CONNECTION_STATES.OPEN) {
        // Check if we've received any messages recently
        const now = Date.now()
        if (now - this.lastMessageTime > 30000) { // 30 seconds
          debugLog("No messages received for 30 seconds, checking connection...")
          this.send('ping', {})
            .catch(error => {
              debugError("Heartbeat failed, connection may be dead:", error)
              this.disconnect()
              this._attemptReconnect()
            })
        } else {
          // Send regular heartbeat
          this.send('ping', {})
            .catch(error => {
              debugError("Heartbeat failed:", error)
            })
        }
      }
    }, 15000) // Send heartbeat every 15 seconds
  }

  // Notify all handlers for a specific message type
  _notifyHandlers(messageType, data) {
    if (this.messageHandlers.has(messageType)) {
      const handlers = this.messageHandlers.get(messageType)
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          debugError(`Error in ${messageType} handler:`, error)
        }
      })
    }
  }

  // Get current connection state
  getState() {
    return this.connectionState
  }

  // Check if connected
  isConnected() {
    return this.connectionState === CONNECTION_STATES.OPEN
  }
}

// Create singleton instance
const realTimeService = new RealTimeService()

export default realTimeService
