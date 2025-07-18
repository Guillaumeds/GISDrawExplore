'use client'

import { DrawnArea } from '@/types/drawnArea'

interface DrawnAreasListProps {
  drawnAreas: DrawnArea[]
  selectedAreaId?: string | null
  onAreaSelect?: (areaId: string) => void
  onAreaDelete?: (areaId: string) => void
  onAreaHover?: (areaId: string | null) => void
  onSaveAll?: () => void
  onCancelAll?: () => void
}

export default function DrawnAreasList({
  drawnAreas,
  selectedAreaId,
  onAreaSelect,
  onAreaDelete,
  onAreaHover,
  onSaveAll,
  onCancelAll
}: DrawnAreasListProps) {
  if (drawnAreas.length === 0) {
    return null
  }

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg z-[1000] p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800">Drawn Areas</h3>
        <span className="text-sm text-gray-500">{drawnAreas.length} areas</span>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {drawnAreas.map((area, index) => {
          const areaId = area.uuid || area.localId
          return (
          <div
            key={areaId}
            className={`border rounded-lg p-3 transition-colors cursor-pointer relative ${
              selectedAreaId === areaId
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
            onClick={() => onAreaSelect?.(areaId)}
            onMouseEnter={() => onAreaHover?.(areaId)}
            onMouseLeave={() => onAreaHover?.(null)}
          >
            {/* Selection indicator */}
            {selectedAreaId === areaId && (
              <div className="absolute top-2 right-2 w-3 h-3 bg-orange-500 rounded-full"></div>
            )}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-lg">
                  {area.type === 'polygon' ? '⬟' : '▭'}
                </span>
                <span className="font-medium text-sm">
                  {area.type === 'polygon' ? 'Cultivation Area' : 'Rectangle Area'} #{index + 1}
                </span>
              </div>
              
              {onAreaDelete && (
                <button
                  onClick={() => onAreaDelete(areaId)}
                  className="text-red-500 hover:text-red-700 text-sm"
                  title="Delete area"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Area:</span>
                <span className="font-medium">{area.area.toFixed(2)} ha</span>
              </div>
              
              <div className="flex justify-between">
                <span>Points:</span>
                <span className="font-medium">{area.coordinates.length}</span>
              </div>

              {/* Field overlap display removed - blocs are now independent of fields */}
            </div>


          </div>
        )})}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
        <div className="text-xs text-gray-500">
          Total area: {drawnAreas.reduce((sum, area) => sum + area.area, 0).toFixed(2)} ha
        </div>

        {/* Save/Cancel Actions */}
        {drawnAreas.length > 0 && (
          <div className="flex space-x-2">
            <button
              onClick={onSaveAll}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm py-2 px-3 rounded transition-colors"
            >
              💾 Save All
            </button>
            <button
              onClick={onCancelAll}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm py-2 px-3 rounded transition-colors"
            >
              ✕ Cancel All
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
