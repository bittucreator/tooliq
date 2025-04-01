// Database service using Supabase
import { debugLog, debugError } from "../debug.js"
import { getSupabase, handleSupabaseError } from "./supabase-client.js"
import { getAuthToken } from "./auth-service.js"

// Database tables
const TABLES = {
  EXTRACTIONS: "extractions",
  USERS: "users",
  SUBSCRIPTIONS: "subscriptions",
  USER_PREFERENCES: "user_preferences",
}

class DatabaseService {
  constructor() {
    this.initialized = false
  }

  // Initialize database service
  async initialize() {
    if (this.initialized) return

    try {
      // Get Supabase client
      await getSupabase()

      this.initialized = true
      debugLog("Database service initialized")
    } catch (error) {
      debugError("Error initializing database service:", error)
      throw error
    }
  }

  // Create a record
  async create(table, data) {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      // Ensure user is authenticated
      const token = await getAuthToken()
      if (!token) {
        throw new Error("Authentication required")
      }

      // Insert data
      const { data: result, error } = await supabase.from(table).insert(data).select()

      if (error) throw handleSupabaseError(error)

      return result[0]
    } catch (error) {
      debugError(`Error creating record in ${table}:`, error)
      throw error
    }
  }

  // Read a record by ID
  async getById(table, id) {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      // Query data
      const { data, error } = await supabase.from(table).select().eq("id", id).single()

      if (error) {
        if (error.code === "PGRST116") {
          // Record not found
          return null
        }
        throw handleSupabaseError(error)
      }

      return data
    } catch (error) {
      debugError(`Error getting record from ${table} with ID ${id}:`, error)
      throw error
    }
  }

  // Query records
  async query(table, queryOptions = {}) {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      // Start query
      let query = supabase.from(table).select(queryOptions.select || "*")

      // Apply filters
      if (queryOptions.filters) {
        for (const filter of queryOptions.filters) {
          const { column, operator, value } = filter

          switch (operator) {
            case "eq":
              query = query.eq(column, value)
              break
            case "neq":
              query = query.neq(column, value)
              break
            case "gt":
              query = query.gt(column, value)
              break
            case "gte":
              query = query.gte(column, value)
              break
            case "lt":
              query = query.lt(column, value)
              break
            case "lte":
              query = query.lte(column, value)
              break
            case "like":
              query = query.like(column, `%${value}%`)
              break
            case "ilike":
              query = query.ilike(column, `%${value}%`)
              break
            case "in":
              query = query.in(column, value)
              break
            case "is":
              query = query.is(column, value)
              break
          }
        }
      }

      // Apply order
      if (queryOptions.order) {
        const { column, ascending } = queryOptions.order
        query = query.order(column, { ascending })
      }

      // Apply pagination
      if (queryOptions.limit) {
        query = query.limit(queryOptions.limit)
      }

      if (queryOptions.offset) {
        query = query.offset(queryOptions.offset)
      }

      // Execute query
      const { data, error } = await query

      if (error) throw handleSupabaseError(error)

      return data
    } catch (error) {
      debugError(`Error querying ${table}:`, error)
      throw error
    }
  }

  // Update a record
  async update(table, id, data) {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      // Ensure user is authenticated
      const token = await getAuthToken()
      if (!token) {
        throw new Error("Authentication required")
      }

      // Update data
      const { data: result, error } = await supabase.from(table).update(data).eq("id", id).select()

      if (error) throw handleSupabaseError(error)

      return result[0]
    } catch (error) {
      debugError(`Error updating record in ${table} with ID ${id}:`, error)
      throw error
    }
  }

  // Delete a record
  async delete(table, id) {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      // Ensure user is authenticated
      const token = await getAuthToken()
      if (!token) {
        throw new Error("Authentication required")
      }

      // Delete data
      const { error } = await supabase.from(table).delete().eq("id", id)

      if (error) throw handleSupabaseError(error)

      return true
    } catch (error) {
      debugError(`Error deleting record from ${table} with ID ${id}:`, error)
      throw error
    }
  }

  // Get user profile
  async getUserProfile(userId) {
    try {
      return await this.getById(TABLES.USERS, userId)
    } catch (error) {
      debugError(`Error getting user profile for ${userId}:`, error)
      throw error
    }
  }

  // Create or update user profile
  async upsertUserProfile(userData) {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      // Ensure user is authenticated
      const token = await getAuthToken()
      if (!token) {
        throw new Error("Authentication required")
      }

      // Upsert data
      const { data, error } = await supabase.from(TABLES.USERS).upsert(userData).select()

      if (error) throw handleSupabaseError(error)

      return data[0]
    } catch (error) {
      debugError(`Error upserting user profile:`, error)
      throw error
    }
  }

  // Get user subscription
  async getUserSubscription(userId) {
    try {
      const subscriptions = await this.query(TABLES.SUBSCRIPTIONS, {
        filters: [
          { column: "user_id", operator: "eq", value: userId },
          { column: "status", operator: "in", value: ["active", "trialing"] },
        ],
        order: { column: "created_at", ascending: false },
        limit: 1,
      })

      return subscriptions.length > 0 ? subscriptions[0] : null
    } catch (error) {
      debugError(`Error getting subscription for user ${userId}:`, error)
      throw error
    }
  }

  // Create subscription record
  async createSubscription(subscriptionData) {
    try {
      return await this.create(TABLES.SUBSCRIPTIONS, subscriptionData)
    } catch (error) {
      debugError(`Error creating subscription:`, error)
      throw error
    }
  }

  // Update subscription record
  async updateSubscription(id, subscriptionData) {
    try {
      return await this.update(TABLES.SUBSCRIPTIONS, id, subscriptionData)
    } catch (error) {
      debugError(`Error updating subscription ${id}:`, error)
      throw error
    }
  }

  // Get user preferences
  async getUserPreferences(userId) {
    try {
      const preferences = await this.query(TABLES.USER_PREFERENCES, {
        filters: [{ column: "user_id", operator: "eq", value: userId }],
        limit: 1,
      })

      return preferences.length > 0 ? preferences[0] : null
    } catch (error) {
      debugError(`Error getting preferences for user ${userId}:`, error)
      throw error
    }
  }

  // Save user preferences
  async saveUserPreferences(userId, preferences) {
    try {
      await this.initialize()

      const supabase = await getSupabase()

      // Ensure user is authenticated
      const token = await getAuthToken()
      if (!token) {
        throw new Error("Authentication required")
      }

      // Check if preferences exist
      const existing = await this.getUserPreferences(userId)

      if (existing) {
        // Update existing preferences
        return await this.update(TABLES.USER_PREFERENCES, existing.id, {
          ...preferences,
          user_id: userId,
          updated_at: new Date().toISOString(),
        })
      } else {
        // Create new preferences
        return await this.create(TABLES.USER_PREFERENCES, {
          ...preferences,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    } catch (error) {
      debugError(`Error saving preferences for user ${userId}:`, error)
      throw error
    }
  }

  // Save extraction record
  async saveExtraction(extractionData) {
    try {
      return await this.create(TABLES.EXTRACTIONS, {
        ...extractionData,
        created_at: new Date().toISOString(),
      })
    } catch (error) {
      debugError(`Error saving extraction:`, error)
      throw error
    }
  }

  // Get user extractions
  async getUserExtractions(userId, limit = 10, offset = 0) {
    try {
      return await this.query(TABLES.EXTRACTIONS, {
        filters: [{ column: "user_id", operator: "eq", value: userId }],
        order: { column: "created_at", ascending: false },
        limit,
        offset,
      })
    } catch (error) {
      debugError(`Error getting extractions for user ${userId}:`, error)
      throw error
    }
  }
}

// Create singleton instance
const databaseService = new DatabaseService()

// Export table constants
export { TABLES }

export default databaseService

