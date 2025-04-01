// Storage service using Supabase
import { debugLog, debugError } from "../debug.js"
import { getSupabase, handleSupabaseError } from "./supabase-client.js"
import { getAuthToken } from "./auth-service.js"

// Storage buckets
const BUCKETS = {
  EXTRACTIONS: "extractions",
  ASSETS: "assets",
  PROFILES: "profiles",
}

class StorageService {
  constructor() {
    this.initialized = false
  }

  // Initialize storage service
  async initialize() {
    if (this.initialized) return

    try {
      // Get Supabase client
      await getSupabase()

      this.initialized = true
      debugLog("Storage service initialized")
    } catch (error) {
      debugError("Error initializing storage service:", error)
      throw error
    }
  }

  // Upload file to storage
  async uploadFile(bucket, filePath, file, options = {}) {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      // Ensure user is authenticated
      const token = await getAuthToken()
      if (!token) {
        throw new Error("Authentication required")
      }

      // Upload file
      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: "3600",
        upsert: options.upsert || false,
        contentType: options.contentType,
      })

      if (error) throw handleSupabaseError(error)

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath)

      return {
        path: data.path,
        url: urlData.publicUrl,
      }
    } catch (error) {
      debugError(`Error uploading file to ${bucket}/${filePath}:`, error)
      throw error
    }
  }

  // Download file from storage
  async downloadFile(bucket, filePath) {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      // Download file
      const { data, error } = await supabase.storage.from(bucket).download(filePath)

      if (error) throw handleSupabaseError(error)

      return data
    } catch (error) {
      debugError(`Error downloading file from ${bucket}/${filePath}:`, error)
      throw error
    }
  }

  // Get public URL for file
  async getPublicUrl(bucket, filePath) {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      debugError(`Error getting public URL for ${bucket}/${filePath}:`, error)
      throw error
    }
  }

  // List files in a bucket/folder
  async listFiles(bucket, folderPath = "") {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      // Ensure user is authenticated
      const token = await getAuthToken()
      if (!token) {
        throw new Error("Authentication required")
      }

      // List files
      const { data, error } = await supabase.storage.from(bucket).list(folderPath)

      if (error) throw handleSupabaseError(error)

      return data
    } catch (error) {
      debugError(`Error listing files in ${bucket}/${folderPath}:`, error)
      throw error
    }
  }

  // Delete file from storage
  async deleteFile(bucket, filePath) {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      // Ensure user is authenticated
      const token = await getAuthToken()
      if (!token) {
        throw new Error("Authentication required")
      }

      // Delete file
      const { error } = await supabase.storage.from(bucket).remove([filePath])

      if (error) throw handleSupabaseError(error)

      return true
    } catch (error) {
      debugError(`Error deleting file ${bucket}/${filePath}:`, error)
      throw error
    }
  }

  // Create a signed URL for temporary access
  async createSignedUrl(bucket, filePath, expiresIn = 60) {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      // Ensure user is authenticated
      const token = await getAuthToken()
      if (!token) {
        throw new Error("Authentication required")
      }

      // Create signed URL
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, expiresIn)

      if (error) throw handleSupabaseError(error)

      return data.signedUrl
    } catch (error) {
      debugError(`Error creating signed URL for ${bucket}/${filePath}:`, error)
      throw error
    }
  }

  // Upload extraction data
  async uploadExtraction(extractionData, metadata) {
    try {
      await this.initialize()

      // Generate a unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const hostname = new URL(metadata.url).hostname.replace("www.", "")
      const filename = `${hostname}-${timestamp}.json`
      const filePath = `${metadata.userId}/${filename}`

      // Convert data to JSON
      const jsonData = JSON.stringify(extractionData)
      const blob = new Blob([jsonData], { type: "application/json" })

      // Upload file
      const result = await this.uploadFile(BUCKETS.EXTRACTIONS, filePath, blob, {
        contentType: "application/json",
      })

      return {
        ...result,
        filename,
      }
    } catch (error) {
      debugError("Error uploading extraction data:", error)
      throw error
    }
  }

  // Upload asset file
  async uploadAsset(file, userId, type = "image") {
    try {
      await this.initialize()

      // Generate a unique filename
      const timestamp = Date.now()
      const extension = this._getFileExtension(file.name || "file")
      const filename = `${userId}/${type}_${timestamp}.${extension}`

      // Upload file
      const result = await this.uploadFile(BUCKETS.ASSETS, filename, file, {
        contentType: file.type,
      })

      return result
    } catch (error) {
      debugError("Error uploading asset:", error)
      throw error
    }
  }

  // Upload profile picture
  async uploadProfilePicture(file, userId) {
    try {
      await this.initialize()

      // Generate filename
      const extension = this._getFileExtension(file.name || "avatar")
      const filename = `${userId}/avatar.${extension}`

      // Upload file
      const result = await this.uploadFile(BUCKETS.PROFILES, filename, file, {
        contentType: file.type,
        upsert: true,
      })

      return result
    } catch (error) {
      debugError("Error uploading profile picture:", error)
      throw error
    }
  }

  // Helper to get file extension
  _getFileExtension(filename) {
    return filename.split(".").pop().toLowerCase() || "bin"
  }
}

// Create singleton instance
const storageService = new StorageService()

// Export bucket constants
export { BUCKETS }

export default storageService

