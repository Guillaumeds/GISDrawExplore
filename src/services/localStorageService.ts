/**
 * Simple LocalStorage Service
 * Replaces React Query with browser localStorage + direct DB calls
 * No complex caching - just simple browser storage with TTL
 */

import { ConfigurationService } from './configurationService'
import { SugarcaneVariety, InterCropPlant, CropVariety } from '@/types/varieties'
import { Product } from '@/types/products'
import { Resource } from '@/types/resources'

interface StorageItem<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

export class LocalStorageService {
  private static readonly TTL = 24 * 60 * 60 * 1000 // 24 hours
  
  private static readonly KEYS = {
    SUGARCANE_VARIETIES: 'scanne_sugarcane_varieties',
    INTERCROP_VARIETIES: 'scanne_intercrop_varieties',
    PRODUCTS: 'scanne_products',
    RESOURCES: 'scanne_resources',
  } as const

  /**
   * Generic method to get data from localStorage or fetch from database
   */
  private static async getOrFetch<T>(
    key: string,
    fetchFunction: () => Promise<T>
  ): Promise<T> {
    try {
      // Try to get from localStorage first
      const stored = this.getFromStorage<T>(key)
      if (stored && this.isValid(stored)) {
        console.log(`📦 Using localStorage data for: ${key}`)
        return stored.data
      }

      // Fetch from database
      console.log(`🔄 Fetching fresh data from database for: ${key}`)
      const data = await fetchFunction()
      
      // Store in localStorage
      this.saveToStorage(key, data)
      
      return data
    } catch (error) {
      console.error(`❌ Error getting data for ${key}:`, error)
      throw error
    }
  }

  /**
   * Get data from localStorage
   */
  private static getFromStorage<T>(key: string): StorageItem<T> | null {
    if (typeof window === 'undefined') return null
    
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.warn(`Error reading from localStorage for ${key}:`, error)
      return null
    }
  }

  /**
   * Save data to localStorage with timestamp
   */
  private static saveToStorage<T>(key: string, data: T): void {
    if (typeof window === 'undefined') return
    
    try {
      const item: StorageItem<T> = {
        data,
        timestamp: Date.now(),
        ttl: this.TTL
      }
      localStorage.setItem(key, JSON.stringify(item))
      console.log(`💾 Saved to localStorage: ${key}`)
    } catch (error) {
      console.warn(`Error saving to localStorage for ${key}:`, error)
    }
  }

  /**
   * Check if stored data is still valid (not expired)
   */
  private static isValid<T>(item: StorageItem<T>): boolean {
    const now = Date.now()
    const age = now - item.timestamp
    return age < item.ttl
  }

  /**
   * Clear specific item from localStorage
   */
  private static clearItem(key: string): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(key)
    console.log(`🗑️ Cleared localStorage: ${key}`)
  }

  /**
   * Clear all configuration data from localStorage
   */
  static clearAll(): void {
    Object.values(this.KEYS).forEach(key => this.clearItem(key))
    console.log('🗑️ Cleared all configuration data from localStorage')
  }

  // =============================================================================
  // PUBLIC API METHODS (Replace React Query hooks)
  // =============================================================================

  /**
   * Get sugarcane varieties (localStorage + DB fallback)
   */
  static async getSugarcaneVarieties(): Promise<SugarcaneVariety[]> {
    return this.getOrFetch(
      this.KEYS.SUGARCANE_VARIETIES,
      () => {
        console.log('🔍 ConfigurationService:', ConfigurationService)
        console.log('🔍 ConfigurationService.getSugarcaneVarieties:', ConfigurationService?.getSugarcaneVarieties)
        if (!ConfigurationService || !ConfigurationService.getSugarcaneVarieties) {
          throw new Error('ConfigurationService or getSugarcaneVarieties method is not available')
        }
        return ConfigurationService.getSugarcaneVarieties()
      }
    )
  }

  /**
   * Get intercrop varieties (localStorage + DB fallback)
   */
  static async getIntercropVarieties(): Promise<InterCropPlant[]> {
    return this.getOrFetch(
      this.KEYS.INTERCROP_VARIETIES,
      () => ConfigurationService.getIntercropVarieties()
    )
  }

  /**
   * Get all varieties (localStorage + DB fallback)
   */
  static async getAllVarieties(): Promise<CropVariety[]> {
    const [sugarcane, intercrop] = await Promise.all([
      this.getSugarcaneVarieties(),
      this.getIntercropVarieties()
    ])
    return [...sugarcane, ...intercrop]
  }

  /**
   * Get products (localStorage + DB fallback)
   */
  static async getProducts(): Promise<Product[]> {
    return this.getOrFetch(
      this.KEYS.PRODUCTS,
      () => ConfigurationService.getProducts()
    )
  }

  /**
   * Get resources (localStorage + DB fallback)
   */
  static async getResources(): Promise<Resource[]> {
    return this.getOrFetch(
      this.KEYS.RESOURCES,
      () => ConfigurationService.getResources()
    )
  }

  /**
   * Force refresh data from database (bypass localStorage)
   */
  static async refreshData(): Promise<void> {
    console.log('🔄 Force refreshing all configuration data...')
    
    // Clear localStorage
    this.clearAll()
    
    // Fetch fresh data (will automatically save to localStorage)
    await Promise.all([
      this.getSugarcaneVarieties(),
      this.getIntercropVarieties(),
      this.getProducts(),
      this.getResources()
    ])
    
    console.log('✅ All configuration data refreshed')
  }

  /**
   * Get storage statistics for debugging
   */
  static getStorageStats(): Record<string, any> {
    const stats: Record<string, any> = {}

    Object.entries(this.KEYS).forEach(([name, key]) => {
      const item = this.getFromStorage(key)
      if (item) {
        const age = Date.now() - item.timestamp
        const ageHours = Math.round(age / (1000 * 60 * 60))
        stats[name] = {
          exists: true,
          ageHours,
          isValid: this.isValid(item),
          dataLength: Array.isArray(item.data) ? item.data.length : 'N/A'
        }
      } else {
        stats[name] = { exists: false }
      }
    })

    return stats
  }

  /**
   * Clear all cached data (useful for debugging or when database is reset)
   */
  static clearAllCache(): void {
    Object.values(this.KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
    console.log('🧹 Cleared all localStorage cache')
  }

  /**
   * Force refresh all data from database (clears cache and reloads)
   */
  static async refreshAllData(): Promise<void> {
    console.log('🔄 Force refreshing all localStorage data...')
    this.clearAllCache()

    // Reload all data from database
    await Promise.all([
      this.getSugarcaneVarieties(),
      this.getIntercropVarieties(),
      this.getProducts(),
      this.getResources()
    ])

    console.log('✅ All localStorage data refreshed from database')
  }

  /**
   * Auto-refresh cache if stale (called on app initialization)
   */
  static async autoRefreshIfStale(): Promise<void> {
    try {
      const stats = this.getStorageStats()
      let needsRefresh = false

      // Check if any cache is missing or stale (older than 1 hour)
      Object.entries(stats).forEach(([name, stat]) => {
        if (!stat.exists || !stat.isValid || stat.ageHours > 1) {
          console.log(`🔄 Cache ${name} needs refresh: exists=${stat.exists}, valid=${stat.isValid}, age=${stat.ageHours}h`)
          needsRefresh = true
        }
      })

      if (needsRefresh) {
        console.log('🔄 Auto-refreshing stale cache...')
        await this.refreshAllData()
      } else {
        console.log('✅ Cache is fresh, no auto-refresh needed')
      }
    } catch (error) {
      console.error('❌ Error during auto-refresh check:', error)
      // If there's an error, refresh anyway to be safe
      await this.refreshAllData()
    }
  }

  /**
   * Check if error indicates UUID mismatch or foreign key violation
   */
  static isUuidMismatchError(error: any): boolean {
    if (!error) return false

    // PostgreSQL error codes for foreign key violations
    const foreignKeyErrorCodes = ['23503', '23505', 'PGRST116']

    // Check error code
    if (foreignKeyErrorCodes.includes(error.code)) return true

    // Check error message for common UUID mismatch patterns
    const errorMessage = error.message?.toLowerCase() || ''
    const uuidMismatchPatterns = [
      'does not exist',
      'violates foreign key constraint',
      'invalid uuid',
      'uuid not found',
      'foreign key violation',
      'constraint violation'
    ]

    return uuidMismatchPatterns.some(pattern => errorMessage.includes(pattern))
  }

  /**
   * Auto-recovery wrapper for database operations that use cached UUIDs
   * Automatically refreshes cache and retries once if UUID mismatch is detected
   */
  static async withAutoRecovery<T>(
    operation: () => Promise<T>,
    operationName: string = 'database operation'
  ): Promise<T> {
    try {
      console.log(`🔄 Starting ${operationName}...`)
      return await operation()
    } catch (error) {
      console.log(`🚨 Error in ${operationName}:`, {
        error,
        errorMessage: error?.message,
        errorCode: error?.code,
        isUuidMismatch: this.isUuidMismatchError(error)
      })

      if (this.isUuidMismatchError(error)) {
        console.log(`🔄 UUID mismatch detected in ${operationName}, refreshing cache and retrying...`)
        console.log('🚨 Original error:', error.message)

        // Refresh cache
        await this.refreshAllData()

        // Retry operation once
        try {
          console.log(`🔁 Retrying ${operationName} after cache refresh...`)
          const result = await operation()
          console.log(`✅ ${operationName} succeeded after auto-recovery`)
          return result
        } catch (retryError) {
          console.error(`❌ ${operationName} failed even after auto-recovery:`, {
            retryError,
            originalError: error,
            operationName
          })
          throw new Error(`${operationName} failed: ${retryError.message || 'Unknown error after auto-recovery'}`)
        }
      }

      // If not a UUID mismatch error, throw original error
      console.log(`❌ ${operationName} failed with non-UUID error, not retrying`)
      throw error
    }
  }
}
