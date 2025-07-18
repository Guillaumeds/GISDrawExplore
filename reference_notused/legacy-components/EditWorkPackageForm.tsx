'use client'

import { useState, useEffect } from 'react'
import { WorkPackageNode, WorkPackageStatus } from '@/types/operationsOverview'
import AttachmentUploader, { AttachmentFile } from './AttachmentUploader'
import { SaveButton, CancelButton } from '@/components/ui/SubmitButton'

// Status Form Toggle Component - Larger version for forms
interface StatusFormToggleProps {
  status: WorkPackageStatus;
  onChange: (status: WorkPackageStatus) => void;
}

const StatusFormToggle: React.FC<StatusFormToggleProps> = ({ status, onChange }) => {
  const getStatusConfig = (statusType: WorkPackageStatus) => {
    switch (statusType) {
      case 'not-started':
        return { icon: '○', color: 'text-gray-500', bg: 'bg-gray-100', hover: 'hover:bg-gray-200', label: 'Not Started' }
      case 'in-progress':
        return { icon: '◑', color: 'text-blue-600', bg: 'bg-blue-100', hover: 'hover:bg-blue-200', label: 'In Progress' }
      case 'complete':
        return { icon: '●', color: 'text-green-600', bg: 'bg-green-100', hover: 'hover:bg-green-200', label: 'Complete' }
    }
  }

  const config = getStatusConfig(status)
  const options: WorkPackageStatus[] = ['not-started', 'in-progress', 'complete']
  const currentIndex = options.indexOf(status)

  const nextStatus = () => {
    const nextIndex = (currentIndex + 1) % options.length
    onChange(options[nextIndex])
  }

  return (
    <div className="flex items-center space-x-3">
      <button
        type="button"
        onClick={nextStatus}
        className={`
          inline-flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200
          ${config.bg} ${config.color} ${config.hover}
          hover:scale-110 active:scale-95 focus:outline-none
        `}
        title={`Current: ${config.label} - Click to change`}
      >
        <span className="text-lg font-bold">{config.icon}</span>
      </button>
      <span className="text-sm font-medium text-gray-700">{config.label}</span>
    </div>
  )
}

interface EditWorkPackageFormProps {
  workPackage: WorkPackageNode
  blocId: string
  productId: string
  onSave: (workPackageData: WorkPackageNode) => Promise<void>
  onCancel: () => void
  blocArea: number // Add bloc area for calculations
  operationEquipment?: Array<{
    id: string
    name: string
    estimatedDuration: number
    costPerHour: number
    totalEstimatedCost: number
  }>
  operationProducts?: Array<{
    id: string
    productName: string
    rate: number
    quantity: number
    unit: string
    estimatedCost: number
  }>
}

export default function EditWorkPackageForm({
  workPackage,
  blocId,
  productId,
  onSave,
  onCancel,
  blocArea,
  operationEquipment = [],
  operationProducts = []
}: EditWorkPackageFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState(() => {
    console.log('🎯 Initializing work package form with:', workPackage?.id)
    
    return {
      id: workPackage?.id || '',
      date: workPackage?.date || new Date().toISOString().split('T')[0],
      area: workPackage?.area || 0,
      quantity: workPackage?.quantity || 0,
      rate: workPackage?.rate || 0,
      status: workPackage?.status || 'not-started' as WorkPackageStatus,
      notes: workPackage?.notes || ''
    }
  })

  const [attachmentFiles, setAttachmentFiles] = useState<AttachmentFile[]>([])

  // Tab state - no yield tab for work packages
  const [activeTab, setActiveTab] = useState<'general' | 'resources' | 'notes' | 'attachments'>('general')

  // Fixed resource list with predefined rates (will be from DB later)
  const RESOURCE_TYPES = [
    { name: 'Supervisor', ratePerHour: 500 },
    { name: 'Permanent Male', ratePerHour: 300 },
    { name: 'Permanent Female', ratePerHour: 250 },
    { name: 'Contract Male', ratePerHour: 350 },
    { name: 'Contract Female', ratePerHour: 280 }
  ]

  const [actualResourcesData, setActualResourcesData] = useState<Array<{
    resource: string
    actualEffort: number
    actualCost: number
    ratePerHour: number
  }>>(
    RESOURCE_TYPES.map(type => ({
      resource: type.name,
      actualEffort: 0,
      actualCost: 0,
      ratePerHour: type.ratePerHour
    }))
  )

  const [notesData, setNotesData] = useState<string[]>([''])

  // Equipment data state - editable actual duration and cost
  const [equipmentData, setEquipmentData] = useState<Array<{
    id: string
    name: string
    costPerHour: number
    actualDuration: number
    actualCost: number
  }>>(() => {
    // Initialize from operation equipment or use mock data
    if (operationEquipment.length > 0) {
      return operationEquipment.map(eq => ({
        id: eq.id,
        name: eq.name,
        costPerHour: eq.costPerHour,
        actualDuration: eq.estimatedDuration, // Start with estimated as default
        actualCost: eq.totalEstimatedCost // Start with estimated as default
      }))
    }
    // Fallback mock data for testing
    return [
      { id: 'eq1', name: 'Tractor', costPerHour: 800, actualDuration: 2.5, actualCost: 2000 },
      { id: 'eq2', name: 'Sprayer', costPerHour: 400, actualDuration: 1.0, actualCost: 400 }
    ]
  })

  // Products data state - editable actual quantities, rates and costs (using bloc area)
  const [productsData, setProductsData] = useState<Array<{
    id: string
    productName: string
    unit: string
    actualQuantity: number
    actualRate: number
    actualCost: number
  }>>(() => {
    // Initialize from operation products
    if (operationProducts.length > 0) {
      return operationProducts.map(prod => ({
        id: prod.id,
        productName: prod.productName,
        unit: prod.unit,
        actualQuantity: prod.quantity, // Start with estimated as default
        actualRate: prod.rate, // Start with estimated as default
        actualCost: prod.estimatedCost // Start with estimated as default
      }))
    }
    return []
  })

  // Debug equipment and products data
  useEffect(() => {
    console.log('🔧 Equipment data initialized:', equipmentData)
    console.log('🔧 Operation equipment prop:', operationEquipment)
    console.log('🧪 Products data initialized:', productsData)
    console.log('🧪 Operation products prop:', operationProducts)
  }, [equipmentData, operationEquipment, productsData, operationProducts])

  // Update equipment actual duration and recalculate cost
  const updateEquipmentDuration = (equipmentId: string, duration: number) => {
    setEquipmentData(prev => prev.map(eq =>
      eq.id === equipmentId
        ? { ...eq, actualDuration: duration, actualCost: duration * eq.costPerHour }
        : eq
    ))
  }

  // Update product actual quantity and recalculate cost
  const updateProductQuantity = (productId: string, quantity: number) => {
    setProductsData(prev => prev.map(prod =>
      prod.id === productId
        ? {
            ...prod,
            actualQuantity: quantity,
            actualCost: quantity * (prod.actualRate || 0)
          }
        : prod
    ))
  }

  // Update product actual rate and recalculate quantity and cost using bloc area
  const updateProductRate = (productId: string, rate: number) => {
    setProductsData(prev => prev.map(prod =>
      prod.id === productId
        ? {
            ...prod,
            actualRate: rate,
            actualQuantity: rate * blocArea, // Use bloc area for calculation
            actualCost: (rate * blocArea) * rate
          }
        : prod
    ))
  }

  // Update actual cost when effort changes
  const updateActualResourceEffort = (index: number, effort: number) => {
    const updatedResources = [...actualResourcesData]
    updatedResources[index].actualEffort = effort
    updatedResources[index].actualCost = effort * updatedResources[index].ratePerHour
    setActualResourcesData(updatedResources)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.date) {
      alert('Please select a date')
      return
    }

    setIsSubmitting(true)

    // Create work package data structure
    const workPackageData: WorkPackageNode = {
      id: formData.id,
      days_after_planting: workPackage.days_after_planting, // Keep original value
      date: formData.date,
      area: formData.area,
      quantity: formData.quantity,
      rate: formData.rate,
      status: formData.status,
      notes: notesData.filter(note => note.trim() !== '').join('\n')
    }

    try {
      await onSave(workPackageData)
    } catch (error) {
      console.error('❌ Error saving work package:', error)
      alert('Failed to save work package. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900">Edit Daily Work Package</h2>
            <p className="text-sm text-gray-600 mt-1">
              Update work package details and actual resource usage
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'general', name: 'General', icon: '⚙️' },
                { id: 'resources', name: 'Resources', icon: '👥' },
                { id: 'notes', name: 'Notes', icon: '📝' },
                { id: 'attachments', name: 'Attachments', icon: '📎' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>

                  {/* Area */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Area (hectares)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* Rate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rate
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.rate}
                      onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <StatusFormToggle
                    status={formData.status}
                    onChange={(status) => setFormData({ ...formData, status })}
                  />
                </div>

                {/* Products Section */}
                {productsData.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Actual Product Usage</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Record the actual quantities, rates, areas, and costs for products used in this work package.
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-blue-300">
                            <th className="text-left py-2 px-3 font-medium text-gray-700">Product</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-700">Actual Quantity</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-700">Actual Rate</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-700">Actual Cost (Rs)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productsData.map((product) => (
                            <tr key={product.id} className="border-b border-blue-200">
                              <td className="py-2 px-3 font-medium text-gray-900">
                                {product.productName}
                                <div className="text-xs text-gray-500">Unit: {product.unit}</div>
                                <div className="text-xs text-gray-500">Area: {blocArea} ha</div>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={product.actualQuantity || ''}
                                  onChange={(e) => updateProductQuantity(product.id, parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  title={`Enter actual quantity in ${product.unit}`}
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={product.actualRate || ''}
                                  onChange={(e) => updateProductRate(product.id, parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  title={`Enter actual rate in ${product.unit}/ha`}
                                />
                              </td>
                              <td className="py-2 px-3 font-medium text-blue-600">
                                Rs {product.actualCost.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 pt-4 border-t border-blue-300">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">Total Product Cost:</span>
                        <span className="text-lg font-bold text-blue-600">
                          Rs {productsData.reduce((sum, prod) => sum + prod.actualCost, 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resources Tab */}
            {activeTab === 'resources' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Actual Resource Usage</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Record the actual hours worked and costs for each resource type.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-blue-300">
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Resource</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Actual Effort (hours)</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Rate/Hour</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Actual Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actualResourcesData.map((resource, index) => (
                          <tr key={resource.resource} className="border-b border-blue-200">
                            <td className="py-2 px-3 font-medium text-gray-900">{resource.resource}</td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={resource.actualEffort || ''}
                                onChange={(e) => updateActualResourceEffort(index, parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                title="Enter actual effort in hours"
                              />
                            </td>
                            <td className="py-2 px-3 text-gray-600">Rs {resource.ratePerHour}</td>
                            <td className="py-2 px-3 font-medium text-green-600">
                              Rs {resource.actualCost.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 pt-4 border-t border-blue-300">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">Total Actual Cost:</span>
                      <span className="text-lg font-bold text-green-600">
                        Rs {actualResourcesData.reduce((sum, r) => sum + r.actualCost, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Equipment Section */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Actual Equipment Usage</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Record the actual duration and costs for equipment used in this work package.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-green-300">
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Equipment</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Actual Duration (hours)</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Rate/Hour</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Actual Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equipmentData.map((equipment) => (
                          <tr key={equipment.id} className="border-b border-green-200">
                            <td className="py-2 px-3 font-medium text-gray-900">{equipment.name}</td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={equipment.actualDuration || ''}
                                onChange={(e) => updateEquipmentDuration(equipment.id, parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                title="Enter actual duration in hours"
                              />
                            </td>
                            <td className="py-2 px-3 text-gray-600">Rs {equipment.costPerHour}</td>
                            <td className="py-2 px-3 font-medium text-green-600">
                              Rs {equipment.actualCost.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 pt-4 border-t border-green-300">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">Total Equipment Cost:</span>
                      <span className="text-lg font-bold text-green-600">
                        Rs {equipmentData.reduce((sum, eq) => sum + eq.actualCost, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Work Package Notes</h3>
                {notesData.map((note, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Note {index + 1}
                      </label>
                      {notesData.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNotesData(notesData.filter((_, i) => i !== index))}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <textarea
                      value={note}
                      onChange={(e) => {
                        const newNotes = [...notesData]
                        newNotes[index] = e.target.value
                        setNotesData(newNotes)
                      }}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Enter your notes here..."
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setNotesData([...notesData, ''])}
                  className="px-4 py-2 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg border border-dashed border-green-300 hover:border-green-400 transition-colors"
                >
                  + Add Another Note
                </button>
              </div>
            )}

            {/* Attachments Tab */}
            {activeTab === 'attachments' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Work Package Attachments</h3>
                <AttachmentUploader
                  files={attachmentFiles}
                  onFilesChange={setAttachmentFiles}
                  maxFiles={10}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
            <CancelButton onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </CancelButton>
            <SaveButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Work Package'}
            </SaveButton>
          </div>
        </form>
      </div>
    </div>
  )
}
