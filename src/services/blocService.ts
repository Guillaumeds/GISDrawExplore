/**
 * Bloc Service - Database operations for blocs
 * Handles CRUD operations for blocs in Supabase
 */

import { supabase } from '@/lib/supabase'
import type { Bloc } from '@/lib/supabase'

// Interface for drawn areas from the map
interface DrawnArea {
  id: string
  type: string
  coordinates: [number, number][]
  area: number
  fieldIds: string[]
}

// Interface for creating a new bloc
interface CreateBlocRequest {
  name: string
  description?: string
  coordinates: [number, number][]
  area_hectares: number
  field_id: string
}

export class BlocService {
  
  /**
   * Save a drawn area as a bloc in the database
   */
  static async saveDrawnAreaAsBloc(drawnArea: DrawnArea): Promise<Bloc> {
    try {
      // Convert coordinates from Leaflet format [lat, lng] to PostGIS WKT format
      // PostGIS WKT expects "longitude latitude" format with SRID 4326 for GPS coordinates

      // drawnArea.coordinates is in Leaflet format: [[lat, lng], [lat, lng], ...]
      // Convert to PostGIS format: "lng lat, lng lat, ..."
      const coordinatesString = drawnArea.coordinates
        .map(coord => `${coord[1]} ${coord[0]}`) // Convert [lat, lng] to "lng lat"
        .join(', ')

      // Ensure polygon is properly closed by adding the first coordinate at the end
      const firstCoord = drawnArea.coordinates[0]
      const closingCoord = `${firstCoord[1]} ${firstCoord[0]}`

      // Create WKT POLYGON string with proper SRID 4326 format
      const polygonWKT = `POLYGON((${coordinatesString}, ${closingCoord}))`

      console.log('🔧 Converting coordinates for PostGIS SRID 4326:', {
        leafletFormat: drawnArea.coordinates.slice(0, 3), // Show first 3 coords
        postgisWKT: polygonWKT.substring(0, 100) + '...',
        totalCoords: drawnArea.coordinates.length
      })
      
      // Generate a proper UUID for the bloc (let database generate it)
      const { data, error } = await supabase.rpc('insert_bloc_with_geometry', {
        bloc_name: `Bloc ${drawnArea.id}`, // Use the drawn area ID for the name
        bloc_description: `Bloc created from map drawing`,
        polygon_wkt: polygonWKT,
        bloc_area_hectares: drawnArea.area
        // Remove field assignment - will be handled by database job later
        // bloc_id will default to NULL and database will generate UUID
      })
      
      if (error) {
        console.error('Error saving bloc:', error)
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from bloc insertion')
      }

      return data[0] // RPC function returns an array, get the first item
    } catch (error) {
      console.error('Failed to save drawn area as bloc:', error)
      throw error
    }
  }
  
  /**
   * Save multiple drawn areas as blocs
   */
  static async saveMultipleDrawnAreas(drawnAreas: DrawnArea[]): Promise<Bloc[]> {
    try {
      const savedBlocs: Bloc[] = []

      for (const drawnArea of drawnAreas) {
        try {
          const bloc = await this.saveDrawnAreaAsBloc(drawnArea)
          savedBlocs.push(bloc)
        } catch (error) {
          console.error(`Failed to save bloc ${drawnArea.id}:`, error)
          // Continue with other blocs even if one fails
        }
      }

      return savedBlocs
    } catch (error) {
      console.error('Failed to save multiple drawn areas:', error)
      throw error
    }
  }
  
  /**
   * Get all blocs from database with WKT coordinates
   */
  static async getAllBlocs(): Promise<Bloc[]> {
    try {
      // Use RPC function to get blocs with WKT coordinates for easier parsing
      const { data, error } = await supabase.rpc('get_blocs_with_wkt')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Failed to fetch blocs:', error)
      return []
    }
  }
  
  /**
   * Get bloc with crop cycle data
   */
  static async getBlocWithCropCycle(blocId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('blocs')
        .select(`
          *,
          crop_cycles(
            *,
            sugarcane_varieties(name, variety_id),
            intercrop_varieties(name, variety_id)
          )
        `)
        .eq('id', blocId)
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Failed to fetch bloc with crop cycle:', error)
      throw error
    }
  }
  
  /**
   * Update bloc status
   */
  static async updateBlocStatus(blocId: string, status: 'active' | 'retired'): Promise<void> {
    try {
      const { error } = await supabase
        .from('blocs')
        .update({ 
          status, 
          updated_at: new Date().toISOString(),
          retired_date: status === 'retired' ? new Date().toISOString() : null
        })
        .eq('id', blocId)
      
      if (error) throw error
    } catch (error) {
      console.error('Failed to update bloc status:', error)
      throw error
    }
  }
  
  /**
   * Delete a bloc
   */
  static async deleteBloc(blocId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('blocs')
        .delete()
        .eq('id', blocId)
      
      if (error) throw error
    } catch (error) {
      console.error('Failed to delete bloc:', error)
      throw error
    }
  }
  
  /**
   * Convert database bloc to drawn area format for map display
   */
  static convertBlocToDrawnArea(bloc: any): DrawnArea {
    // Parse PostGIS WKT coordinates from the database
    let coordinates: [number, number][] = []

    console.log('🔍 Converting bloc to drawn area:', {
      id: bloc.id,
      coordinates_wkt: bloc.coordinates_wkt,
      area_hectares: bloc.area_hectares
    })

    if (bloc.coordinates_wkt) {
      try {
        console.log('🔍 Converting bloc WKT to coordinates:', bloc.id)
        console.log('🔍 Raw WKT:', bloc.coordinates_wkt)

        // Handle WKT format: POLYGON((lng lat,lng lat,...))
        let coordString = bloc.coordinates_wkt

        // Remove POLYGON(( and )) wrapper
        if (coordString.startsWith('POLYGON((') && coordString.endsWith('))')) {
          coordString = coordString.slice(9, -2) // Remove "POLYGON((" and "))"
        }

        console.log('🔍 Cleaned coord string:', coordString)

        // Split by comma to get individual coordinate pairs
        const coordPairs = coordString.split(',')
        console.log('🔍 Coordinate pairs:', coordPairs)

        coordinates = coordPairs
          .map((pair: string) => {
            // Each pair is "lng lat" format from PostGIS
            const cleanPair = pair.trim()
            const [lng, lat] = cleanPair.split(' ').map(Number)

            if (isNaN(lng) || isNaN(lat)) {
              console.error('❌ Invalid coordinate pair in bloc:', cleanPair)
              return null
            }

            // Return as [lng, lat] for internal use (GeoJSON format)
            return [lng, lat] as [number, number]
          })
          .filter(coord => coord !== null) as [number, number][]

        console.log('✅ Converted bloc coordinates:', coordinates.length, 'points')
        console.log('🔍 First few coordinates:', coordinates.slice(0, 3))
        console.log('🔍 All coordinates:', coordinates)

      } catch (error) {
        console.error('❌ Error parsing bloc WKT coordinates:', error)
        coordinates = []
      }
    } else {
      console.warn('⚠️ No coordinates_wkt found for bloc:', bloc.id)
    }

    return {
      id: bloc.id,
      type: 'polygon',
      coordinates: coordinates,
      area: Number(bloc.area_hectares),
      fieldIds: [bloc.field_id]
    }
  }
}
