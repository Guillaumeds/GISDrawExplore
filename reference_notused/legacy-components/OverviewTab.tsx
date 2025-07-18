'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { ChevronRightIcon, ChevronDownIcon, PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'
import { useCropCycleInfo } from '@/contexts/CropCycleContext'
import { DrawnArea } from '@/types/drawnArea'
import { BlocOverviewNode, ProductNode, WorkPackageNode, WorkPackageStatus } from '@/types/operationsOverview'
import ProductSelector from '@/components/ProductSelector'
import OperationsForm from '@/components/OperationsForm'
import EditWorkPackageForm from '@/components/EditWorkPackageForm'
import ContentSwitcher from '@/components/ui/ContentSwitcher'
import { Product } from '@/types/products'

// Status Badge Component
interface StatusBadgeProps {
  status: WorkPackageStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusConfig = (status: WorkPackageStatus) => {
    switch (status) {
      case 'not-started':
        return {
          label: 'Not Started',
          className: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: '○'
        };
      case 'in-progress':
        return {
          label: 'In Progress',
          className: 'bg-blue-100 text-blue-700 border-blue-200',
          icon: '◐'
        };
      case 'complete':
        return {
          label: 'Complete',
          className: 'bg-green-100 text-green-700 border-green-200',
          icon: '●'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${config.className}`}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
};

// Compact Toggle Component - Perfect for table cells
interface StatusCompactToggleProps {
  status: WorkPackageStatus;
  onChange: (status: WorkPackageStatus) => void;
}

const StatusCompactToggle: React.FC<StatusCompactToggleProps> = ({ status, onChange }) => {
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
  )
};

const DEFAULT_COLORS = {
  bloc: {
    background: 'bg-blue-50',
    border: 'border-blue-200',
    hover: '', // No hover effect for node 1
    header: 'bg-blue-100', // Darker blue than table background (bg-blue-50)
    titleBox: 'bg-blue-100'
  },
  product: {
    background: 'bg-green-50',
    border: 'border-green-200',
    hover: '', // No hover effect for node 2
    header: 'bg-green-100', // Same as title box
    titleBox: 'bg-green-100'
  },
  workPackage: {
    background: 'bg-gray-50',
    border: 'border-gray-200',
    hover: 'hover:bg-gray-100', // Keep hover effect for node 3
    header: 'bg-gray-100', // Same as title box
    titleBox: 'bg-gray-100'
  }
}

interface OverviewTabProps {
  bloc: DrawnArea
  readOnly?: boolean
}

export default function OverviewTab({ bloc, readOnly = false }: OverviewTabProps) {
  const [data, setData] = useState<BlocOverviewNode[]>([])
  const [expandedBlocs, setExpandedBlocs] = useState<Set<string>>(new Set())
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

  // Data migration function to populate operationName in work packages
  const migrateWorkPackageOperationNames = (data: BlocOverviewNode[]): BlocOverviewNode[] => {
    return data.map(bloc => ({
      ...bloc,
      products: bloc.products?.map(product => ({
        ...product,
        work_packages: product.work_packages?.map(wp => ({
          ...wp,
          operationName: wp.operationName || product.product_name // Set operation name if not already set
        }))
      }))
    }))
  }

  // Apply migration whenever data changes to ensure operationName is populated
  useEffect(() => {
    setData(prevData => {
      const migratedData = migrateWorkPackageOperationNames(prevData)
      // Only update if there were actual changes to avoid infinite loops
      const hasChanges = JSON.stringify(migratedData) !== JSON.stringify(prevData)
      return hasChanges ? migratedData : prevData
    })
  }, []) // Empty dependency array - only run once on mount

  // Auto-expand logic for empty nodes (only expand, never auto-collapse)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const newExpandedBlocs = new Set(expandedBlocs) // Start with current state
    const newExpandedProducts = new Set(expandedProducts) // Start with current state

    data.forEach(bloc => {
      // If bloc has no products (node 2 is empty), auto-expand bloc (node 1)
      if (!bloc.products || bloc.products.length === 0) {
        newExpandedBlocs.add(bloc.id)
      } else {
        // Check if any products have no work packages (node 3 is empty)
        bloc.products.forEach(product => {
          if (!product.work_packages || product.work_packages.length === 0) {
            newExpandedBlocs.add(bloc.id) // Expand bloc to show product
            newExpandedProducts.add(product.id) // Expand product to show add work package button
          }
        })
      }
    })

    // Only update if there are new expansions (never auto-collapse)
    if (Array.from(newExpandedBlocs).some(id => !expandedBlocs.has(id))) {
      setExpandedBlocs(newExpandedBlocs)
    }

    if (Array.from(newExpandedProducts).some(id => !expandedProducts.has(id))) {
      setExpandedProducts(newExpandedProducts)
    }
  }, [data]) // Only depend on data, not expansion state to avoid loops

  // Selection modal states
  const [showOperationSelector, setShowOperationSelector] = useState(false)
  const [showMethodSelector, setShowMethodSelector] = useState(false)
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  // Operations form state
  const [showOperationsForm, setShowOperationsForm] = useState(false)
  const [editingOperation, setEditingOperation] = useState<ProductNode | null>(null)

  // Work package form state
  const [showWorkPackageForm, setShowWorkPackageForm] = useState(false)
  const [editingWorkPackage, setEditingWorkPackage] = useState<{
    workPackage: WorkPackageNode
    blocId: string
    productId: string
  } | null>(null)

  // View switcher state
  type TableView = 'operations' | 'resources' | 'financial'
  const [currentView, setCurrentView] = useState<TableView>('operations')

  // Resource types for consistent data structure
  const RESOURCE_TYPES = [
    { name: 'Supervisor', ratePerHour: 500 },
    { name: 'Permanent Male', ratePerHour: 300 },
    { name: 'Permanent Female', ratePerHour: 250 },
    { name: 'Contract Male', ratePerHour: 350 },
    { name: 'Contract Female', ratePerHour: 280 }
  ]

  // Column definitions for each view
  const columnViews = {
    operations: {
      node2: [
        { key: 'operation', label: 'Operation', width: 'w-32' },
        { key: 'method', label: 'Method', width: 'w-24' },
        { key: 'product', label: 'Product', width: 'w-28' },
        { key: 'start_date', label: 'Start Date', width: 'w-28' },
        { key: 'end_date', label: 'End Date', width: 'w-28' }
      ],
      node3: [
        { key: 'date', label: 'Date', width: 'w-28' },
        { key: 'area', label: 'Area (ha)', width: 'w-24' },
        { key: 'quantity', label: 'Quantity', width: 'w-24' },
        { key: 'rate', label: 'Rate', width: 'w-20' },
        { key: 'status', label: 'Status', width: 'w-16' }
      ]
    },
    resources: {
      node2: [
        { key: 'operation', label: 'Operation', width: 'w-32' },
        ...RESOURCE_TYPES.map(type => ({
          key: type.name.toLowerCase().replace(' ', '_'),
          label: `${type.name} (hrs)`,
          width: 'w-24'
        })),
        { key: 'est_equipment_duration', label: 'Est Equipment Duration (hrs)', width: 'w-32' }
      ],
      node3: [
        { key: 'date', label: 'Date', width: 'w-28' },
        ...RESOURCE_TYPES.map(type => ({
          key: type.name.toLowerCase().replace(' ', '_'),
          label: `${type.name} (hrs)`,
          width: 'w-24'
        })),
        { key: 'act_equipment_duration', label: 'Act Equipment Duration (hrs)', width: 'w-32' }
      ]
    },
    financial: {
      node2: [
        { key: 'operation', label: 'Operation', width: 'w-32' },
        { key: 'est_product_cost', label: 'Estimate Product Cost (Rs)', width: 'w-32' },
        { key: 'est_labour_cost', label: 'Estimate Labour Cost (Rs)', width: 'w-32' },
        { key: 'est_equipment_cost', label: 'Estimate Equipment Cost (Rs)', width: 'w-32' },
        { key: 'actual_revenue', label: 'Actual Revenue (Rs)', width: 'w-28' }
      ],
      node3: [
        { key: 'date', label: 'Date', width: 'w-28' },
        { key: 'act_product_cost', label: 'Act Product Cost (Rs)', width: 'w-28' },
        { key: 'act_labour_cost', label: 'Actual Labour Cost (Rs)', width: 'w-28' },
        { key: 'act_equipment_cost', label: 'Actual Equipment Cost (Rs)', width: 'w-32' }
      ]
    }
  }

  // Get crop cycle information
  const { activeCycle, getActiveCycleInfo } = useCropCycleInfo()
  const activeCycleInfo = getActiveCycleInfo()

  // Calculate months from planting date
  const calculateMonthsFromPlanting = (plantingDate: string | undefined): string => {
    if (!plantingDate) return '0'
    const planting = new Date(plantingDate)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - planting.getTime())
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)) // Average days per month
    return diffMonths.toString()
  }

  // Format date to "3 Jan 2025" format
  const formatDate = (dateString: string): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  // Smart date parser - converts various formats to ISO date
  const parseSmartDate = (input: string): string => {
    if (!input.trim()) return ''

    // Try various date formats
    const formats = [
      // DD/MM/YYYY or DD/MM/YY
      /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,
      // DD-MM-YYYY or DD-MM-YY
      /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/,
      // DD MMM YYYY (e.g., "4 Jan 2025")
      /^(\d{1,2})\s+(\w{3,})\s+(\d{4})$/,
      // MMM DD YYYY (e.g., "Jan 4 2025")
      /^(\w{3,})\s+(\d{1,2})\s+(\d{4})$/
    ]

    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                       'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

    // Try to parse the input
    let parsedDate: Date | null = null

    // Try direct Date parsing first
    parsedDate = new Date(input)
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0]
    }

    // Try manual parsing for specific formats
    for (const format of formats) {
      const match = input.toLowerCase().match(format)
      if (match) {
        if (format.source.includes('MMM')) {
          // Handle month name formats
          if (match[2] && match[1] && match[3]) { // MMM DD YYYY
            const monthIndex = monthNames.findIndex(m => match[1].startsWith(m))
            if (monthIndex !== -1) {
              parsedDate = new Date(parseInt(match[3]), monthIndex, parseInt(match[2]))
            }
          } else if (match[1] && match[2] && match[3]) { // DD MMM YYYY
            const monthIndex = monthNames.findIndex(m => match[2].startsWith(m))
            if (monthIndex !== -1) {
              parsedDate = new Date(parseInt(match[3]), monthIndex, parseInt(match[1]))
            }
          }
        } else {
          // Handle numeric formats (DD/MM/YYYY)
          const day = parseInt(match[1])
          const month = parseInt(match[2]) - 1 // Month is 0-indexed
          let year = parseInt(match[3])
          if (year < 100) year += 2000 // Convert 2-digit year
          parsedDate = new Date(year, month, day)
        }
        break
      }
    }

    if (parsedDate && !isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0]
    }

    return input // Return original if parsing fails
  }

  // Mock data for selections
  const mockOperations = [
    'Land Preparation', 'Planting', 'Fertilizer Application', 'Irrigation',
    'Pest Control', 'Weed Control', 'Harvesting', 'Transportation'
  ]

  const mockMethods = [
    'Manual', 'Mechanical', 'Aerial', 'Drip', 'Sprinkler', 'Broadcast'
  ]

  const mockProducts = [
    'NPK Fertilizer', 'Urea', 'Pesticide A', 'Herbicide B', 'Seeds', 'Water'
  ]

  // Status helper functions
  const getWorkPackageStatus = (workPackage: WorkPackageNode): WorkPackageStatus => {
    // If new status field exists, use it
    if (workPackage.status) {
      return workPackage.status;
    }
    // Fallback to completed field for backward compatibility
    if (workPackage.completed) {
      return 'complete';
    }
    // Default logic: if has date/area/quantity, it's in progress, otherwise not started
    if (workPackage.date || workPackage.area > 0 || workPackage.quantity > 0) {
      return 'in-progress';
    }
    return 'not-started';
  };

  const updateWorkPackageStatus = (blocId: string, productId: string, workPackageId: string, newStatus: WorkPackageStatus) => {
    setData(prev => prev.map(bloc =>
      bloc.id === blocId
        ? {
            ...bloc,
            products: bloc.products?.map(product =>
              product.id === productId
                ? {
                    ...product,
                    work_packages: product.work_packages?.map(wp =>
                      wp.id === workPackageId
                        ? {
                            ...wp,
                            status: newStatus,
                            completed: newStatus === 'complete' // Keep backward compatibility
                          }
                        : wp
                    )
                  }
                : product
            )
          }
        : bloc
    ));
  };

  // Handle real product selection from ProductSelector
  const handleRealProductSelect = (product: Product, quantity: number, rate: number, actualCost?: number) => {
    if (selectedProductId) {
      setData(prev => prev.map(bloc => ({
        ...bloc,
        products: bloc.products?.map(p =>
          p.id === selectedProductId ? {
            ...p,
            product_name: product.name,
            planned_rate: rate
          } : p
        )
      })))
    }
    setShowProductSelector(false)
    setSelectedProductId(null)
  };

  // Calculate progress based on completed work package areas
  const calculateProductProgress = (product: ProductNode, blocArea: number) => {
    if (!product.work_packages || product.work_packages.length === 0) {
      return 0
    }

    // Sum up areas from completed work packages only
    const completedArea = product.work_packages
      .filter(wp => getWorkPackageStatus(wp) === 'complete')
      .reduce((sum, wp) => sum + (wp.area || 0), 0)

    // Calculate percentage based on bloc area (assuming product covers full bloc)
    const progressPercentage = blocArea > 0 ? Math.min((completedArea / blocArea) * 100, 100) : 0
    return Math.round(progressPercentage)
  }

  // Handle operations form
  const handleEditOperation = (operation: ProductNode) => {
    console.log('✏️ Editing operation:', operation.id, operation.product_name)
    setEditingOperation(operation)
    setShowOperationsForm(true)
  };

  const handleOperationSave = async (operationData: any) => {
    console.log('💾 Saving operation:', operationData)

    // Update the operation in the data
    if (editingOperation) {
      setData(prev => prev.map(bloc => ({
        ...bloc,
        products: bloc.products?.map(p =>
          p.id === editingOperation.id ? {
            ...p,
            product_name: operationData.product_name,
            planned_start_date: operationData.planned_start_date,
            planned_end_date: operationData.planned_end_date,
            planned_rate: operationData.planned_rate,
            method: operationData.method,
            status: operationData.status,
            // Save the products data and equipment data from the form
            productsData: operationData.productsData || [],
            equipmentData: operationData.equipmentData || [],
            // Update operation name in all work packages
            work_packages: p.work_packages?.map(wp => ({
              ...wp,
              operationName: operationData.product_name
            }))
          } : p
        )
      })))
    }

    setShowOperationsForm(false)
    setEditingOperation(null)
  };

  // Handle work package editing
  const handleEditWorkPackage = (workPackage: WorkPackageNode, blocId: string, productId: string) => {
    console.log('✏️ Editing work package:', workPackage.id, 'for bloc:', blocId, 'product:', productId)
    setEditingWorkPackage({ workPackage, blocId, productId })
    setShowWorkPackageForm(true)
  };

  const handleWorkPackageSave = async (workPackageData: WorkPackageNode) => {
    console.log('💾 Saving work package:', workPackageData)

    // Update the work package in the data
    if (editingWorkPackage) {
      setData(prev => prev.map(bloc =>
        bloc.id === editingWorkPackage.blocId ? {
          ...bloc,
          products: bloc.products?.map(product =>
            product.id === editingWorkPackage.productId ? {
              ...product,
              work_packages: product.work_packages?.map(wp =>
                wp.id === workPackageData.id ? workPackageData : wp
              )
            } : product
          )
        } : bloc
      ))
    }

    setShowWorkPackageForm(false)
    setEditingWorkPackage(null)
  };

  // Handle view switching
  const handleViewChange = (viewId: string) => {
    setCurrentView(viewId as TableView)
  }

  // Content switcher options
  const viewOptions = [
    { id: 'operations', label: 'Operations', icon: '⚙️' },
    { id: 'resources', label: 'Resources', icon: '👥' },
    { id: 'financial', label: 'Financial', icon: '💰' }
  ]

  // Helper functions to extract data for different views
  const getResourceData = (product: ProductNode, isEstimate: boolean = true) => {
    // Extract resource data from product (this would come from the forms)
    // For now, return mock data structure that matches the forms
    const resourceData: { [key: string]: number } = {}
    RESOURCE_TYPES.forEach(type => {
      const key = type.name.toLowerCase().replace(' ', '_')
      resourceData[key] = isEstimate ? 0 : 0 // Will be populated from actual data
    })
    return resourceData
  }

  const getFinancialData = (product: ProductNode, isActual: boolean = false) => {
    // Calculate estimated product cost from Operations form products data
    const estProductCost = product.productsData?.reduce((total, prod) => {
      return total + (prod.estimatedCost || 0)
    }, 0) || product.est_product_cost || 0

    // Calculate estimated labour cost from resource data (from Operations form)
    const estLabourCost = RESOURCE_TYPES.reduce((total, type) => {
      // This would come from the Operations form resource data
      // For now, using mock calculation
      return total + 0 // TODO: Get from actual Operations form data
    }, 0)

    // Calculate estimated equipment cost from equipment data (from Operations form)
    const estEquipmentCost = product.equipmentData?.reduce((total, eq) => {
      return total + (eq.totalEstimatedCost || 0)
    }, 0) || 0

    // Calculate actual revenue from harvest/sales data
    const actualRevenue = 0 // TODO: Calculate from actual sales/harvest data

    return {
      product_qty: product.planned_rate || 0,
      rate: product.planned_rate || 0,
      total_cost: estProductCost,
      est_resource_cost: product.est_resource_cost || 0,
      actual_qty: product.planned_rate || 0,
      actual_rate: product.planned_rate || 0,
      actual_cost: product.act_product_cost || 0,
      act_resource_cost: product.act_resource_cost || 0,
      // Financial fields with proper calculations
      est_product_cost: estProductCost,
      est_labour_cost: estLabourCost,
      est_equipment_cost: estEquipmentCost,
      actual_revenue: actualRevenue
    }
  }

  const getWorkPackageResourceData = (workPackage: WorkPackageNode, isActual: boolean = false) => {
    // Extract resource data from work package
    const resourceData: { [key: string]: number } = {}
    RESOURCE_TYPES.forEach(type => {
      const key = type.name.toLowerCase().replace(' ', '_')
      resourceData[key] = 0 // Will be populated from actual work package data
    })
    return resourceData
  }

  const getWorkPackageFinancialData = (workPackage: WorkPackageNode, operation?: ProductNode) => {
    // Calculate actual product cost from DWP products form data
    // This should come from the products table in the DWP form
    const productCost = operation?.productsData?.reduce((total, prod) => {
      // In a real implementation, this would get the actual cost from the DWP form
      // For now, using estimated cost as placeholder
      return total + (prod.estimatedCost || 0)
    }, 0) || (workPackage.quantity || 0) * (workPackage.rate || 0)

    // Calculate actual labour cost from DWP resource form data
    const labourCost = RESOURCE_TYPES.reduce((total, type) => {
      // This would come from the DWP form actualResourcesData
      // For now, using mock calculation - in real implementation,
      // this should sum up the actualCost from the DWP resource form
      return total + 0 // TODO: Get from actual DWP form resource data
    }, 0)

    // Calculate actual equipment cost from DWP equipment form data
    const equipmentCost = operation?.equipmentData?.reduce((total, eq) => {
      // In a real implementation, this would get the actual cost from the DWP form
      // For now, using estimated cost as placeholder
      return total + (eq.totalEstimatedCost || 0)
    }, 0) || 0

    return {
      actual_qty: workPackage.quantity || 0,
      actual_rate: workPackage.rate || 0,
      actual_cost: productCost,
      act_resource_cost: labourCost + equipmentCost,
      act_product_cost: productCost,
      act_labour_cost: labourCost,
      act_equipment_cost: equipmentCost
    }
  }

  // Dynamic column rendering functions
  const renderDynamicHeaders = (level: 'node2' | 'node3', colorClass: string) => {
    const columns = columnViews[currentView][level]
    return columns.map((column) => (
      <th
        key={column.key}
        className={`px-2 py-2 text-left text-xs font-medium ${colorClass} uppercase tracking-wider ${column.width}`}
      >
        {column.label}
      </th>
    ))
  }

  const renderDynamicProductCells = (product: ProductNode, blocId: string) => {
    const columns = columnViews[currentView].node2

    return columns.map((column) => {
      switch (currentView) {
        case 'operations':
          return renderOperationCell(product, column.key, blocId)
        case 'resources':
          return renderResourceCell(product, column.key, true, blocId) // true for estimate
        case 'financial':
          return renderFinancialCell(product, column.key, false, blocId) // false for estimate
        default:
          return <td key={column.key} className="px-2 py-2">-</td>
      }
    })
  }

  const renderDynamicWorkPackageCells = (workPackage: WorkPackageNode, blocId: string, productId: string) => {
    const columns = columnViews[currentView].node3

    // Find the operation (product) for financial calculations
    const operation = data.find(bloc => bloc.id === blocId)?.products?.find(product => product.id === productId)

    return columns.map((column) => {
      switch (currentView) {
        case 'operations':
          return renderWorkPackageOperationCell(workPackage, column.key, blocId, productId)
        case 'resources':
          return renderResourceCell(workPackage, column.key, false, blocId, productId) // false for actual
        case 'financial':
          return renderWorkPackageFinancialCell(workPackage, column.key, operation)
        default:
          return <td key={column.key} className="px-2 py-2">-</td>
      }
    })
  }

  // Individual cell rendering functions
  const renderOperationCell = (product: ProductNode, key: string, blocId?: string) => {
    switch (key) {
      case 'operation':
        return (
          <td key={key} className="px-2 py-2 w-32">
            <div className="flex items-center">
              {readOnly ? (
                <span className="text-sm font-medium text-green-800">
                  {product.product_name || 'Not set'}
                </span>
              ) : (
                <div
                  className="cursor-pointer hover:bg-green-100 px-1 py-1 rounded border border-transparent hover:border-green-300 min-h-[24px] flex items-center w-full"
                  onClick={() => {
                    setSelectedProductId(product.id)
                    setShowOperationSelector(true)
                  }}
                  title="Select Operation"
                >
                  <span className="text-green-800 text-xs truncate">
                    {product.product_name || 'Select operation...'}
                  </span>
                </div>
              )}
            </div>
          </td>
        )
      case 'method':
        return (
          <td key={key} className="px-2 py-2 w-20 text-center">
            {readOnly ? (
              <span className="text-sm text-green-800">{product.method || '-'}</span>
            ) : (
              <div
                className="cursor-pointer hover:bg-green-100 px-1 py-1 rounded border border-transparent hover:border-green-300 min-h-[24px] flex items-center justify-center w-full"
                onClick={() => {
                  setSelectedProductId(product.id)
                  setShowMethodSelector(true)
                }}
                title="Select Method"
              >
                <span className="text-green-800 text-center text-xs">
                  {product.method || 'Method...'}
                </span>
              </div>
            )}
          </td>
        )
      case 'product':
        return (
          <td key={key} className="px-2 py-2 w-28 text-center">
            <span className="text-sm text-green-800">
              {product.productsData && product.productsData.length > 0
                ? product.productsData[0].productName
                : '-'}
            </span>
          </td>
        )

      case 'start_date':
        return (
          <td key={key} className="px-2 py-2 w-24">
            {readOnly ? (
              <span className="text-sm text-green-800">
                {product.planned_start_date ? formatDate(product.planned_start_date) : 'Not set'}
              </span>
            ) : (
              <input
                type="date"
                value={product.planned_start_date || ''}
                onChange={(e) => updateProductField(blocId || '', product.id, 'planned_start_date', e.target.value)}
                className="w-full text-green-800 bg-transparent border-none focus:bg-green-50 focus:outline-none focus:ring-1 focus:ring-green-300 rounded px-1 py-1 text-xs text-center"
                title="Select planned start date"
              />
            )}
          </td>
        )
      case 'end_date':
        return (
          <td key={key} className="px-2 py-2 w-24">
            {readOnly ? (
              <span className="text-sm text-green-800">
                {product.planned_end_date ? formatDate(product.planned_end_date) : 'Not set'}
              </span>
            ) : (
              <input
                type="date"
                value={product.planned_end_date || ''}
                onChange={(e) => updateProductField(blocId || '', product.id, 'planned_end_date', e.target.value)}
                className="w-full text-green-800 bg-transparent border-none focus:bg-green-50 focus:outline-none focus:ring-1 focus:ring-green-300 rounded px-1 py-1 text-xs text-center"
                title="Select planned end date"
              />
            )}
          </td>
        )

      default:
        return <td key={key} className="px-2 py-2">-</td>
    }
  }

  const renderResourceCell = (item: ProductNode | WorkPackageNode, key: string, isEstimate: boolean, blocId?: string, productId?: string) => {
    // Handle operation column for resources view
    if (key === 'operation') {
      if ('product_name' in item) {
        return renderOperationCell(item as ProductNode, key, blocId)
      } else {
        // For work packages, show the operation name from the parent product
        return (
          <td key={key} className="px-2 py-2 w-32">
            <span className="text-sm text-gray-900">{(item as WorkPackageNode).operationName || 'N/A'}</span>
          </td>
        )
      }
    }

    // Handle date column for work packages (node 3) - only editable in operations view
    if (key === 'date' && 'date' in item) {
      const workPackage = item as WorkPackageNode
      return (
        <td key={key} className="px-3 py-2 w-32">
          {readOnly || currentView !== 'operations' ? (
            <span className="text-sm text-gray-900">{workPackage.date ? formatDate(workPackage.date) : 'Not set'}</span>
          ) : (
            <input
              type="date"
              value={workPackage.date || ''}
              onChange={(e) => updateWorkPackageField(blocId || '', productId || '', workPackage.id, 'date', e.target.value)}
              className="w-full text-gray-800 bg-transparent border-none focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300 rounded px-2 py-1 text-sm"
              title="Select work package date"
            />
          )}
        </td>
      )
    }

    // Handle equipment duration columns
    if (key === 'est_equipment_duration') {
      const product = item as ProductNode
      const totalEstDuration = product.equipmentData?.reduce((total, eq) => total + eq.estimatedDuration, 0) || 0
      return (
        <td key={key} className="px-2 py-2 w-32 text-center">
          <span className="text-sm text-gray-900">{totalEstDuration.toFixed(1)}</span>
        </td>
      )
    }

    if (key === 'act_equipment_duration') {
      // For work packages, get actual equipment duration from DWP form data
      const workPackage = item as WorkPackageNode
      const totalActDuration = 0 // TODO: Get from DWP equipment data
      return (
        <td key={key} className="px-2 py-2 w-32 text-center">
          <span className="text-sm text-gray-900">{totalActDuration.toFixed(1)}</span>
        </td>
      )
    }

    const resourceData = 'product_name' in item
      ? getResourceData(item as ProductNode, isEstimate)
      : getWorkPackageResourceData(item as WorkPackageNode, !isEstimate)

    const value = resourceData[key] || 0

    return (
      <td key={key} className="px-2 py-2 w-24 text-center">
        {readOnly ? (
          <span className="text-sm text-gray-900">{value}</span>
        ) : (
          <input
            type="number"
            step="0.5"
            min="0"
            value={value || ''}
            onChange={(e) => {
              // Handle resource update
              console.log(`Update ${key}:`, e.target.value)
            }}
            className="w-full text-center text-gray-800 bg-transparent border-none focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300 rounded px-1 py-1 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            title={`Enter ${key.replace('_', ' ')} hours`}
          />
        )}
      </td>
    )
  }

  const renderFinancialCell = (product: ProductNode, key: string, isActual: boolean, blocId?: string) => {
    // Handle operation column for financial view
    if (key === 'operation') {
      return renderOperationCell(product, key, blocId)
    }

    const financialData = getFinancialData(product, isActual)

    switch (key) {
      case 'est_product_cost':
        return (
          <td key={key} className="px-2 py-2 w-32 text-right">
            <span className="text-sm text-blue-600">Rs {financialData.est_product_cost.toLocaleString()}</span>
          </td>
        )
      case 'est_labour_cost':
        return (
          <td key={key} className="px-2 py-2 w-32 text-right">
            <span className="text-sm text-blue-600">Rs {financialData.est_labour_cost.toLocaleString()}</span>
          </td>
        )
      case 'est_equipment_cost':
        return (
          <td key={key} className="px-2 py-2 w-32 text-right">
            <span className="text-sm text-blue-600">Rs {financialData.est_equipment_cost.toLocaleString()}</span>
          </td>
        )
      case 'actual_revenue':
        return (
          <td key={key} className="px-2 py-2 w-28 text-right">
            <span className="text-sm text-green-600">Rs {financialData.actual_revenue.toLocaleString()}</span>
          </td>
        )
      default:
        return <td key={key} className="px-2 py-2">-</td>
    }
  }

  // Helper function to determine if operation is harvest-related
  const isHarvestOperation = (operationName: string): boolean => {
    if (!operationName) return false
    return operationName.toLowerCase().includes('harvest')
  }

  const renderWorkPackageOperationCell = (workPackage: WorkPackageNode, key: string, blocId?: string, productId?: string) => {
    // Check if this is a harvest operation
    const isHarvest = isHarvestOperation(workPackage.operationName || '')

    switch (key) {
      case 'date':
        return (
          <td key={key} className="px-3 py-2 w-32">
            {readOnly || currentView !== 'operations' ? (
              <span className="text-sm text-gray-900">{workPackage.date ? formatDate(workPackage.date) : 'Not set'}</span>
            ) : (
              <input
                type="date"
                value={workPackage.date || ''}
                onChange={(e) => updateWorkPackageField(blocId || '', productId || '', workPackage.id, 'date', e.target.value)}
                className="w-full text-gray-800 bg-transparent border-none focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300 rounded px-2 py-1 text-sm"
                title="Select work package date"
              />
            )}
          </td>
        )
      case 'area':
        return (
          <td key={key} className="px-3 py-2 w-24 text-center">
            {readOnly || isHarvest ? (
              <span className={`text-sm ${isHarvest ? 'text-gray-400' : 'text-gray-900'}`}>
                {isHarvest ? 'n/a' : (workPackage.area > 0 ? `${workPackage.area}` : '-')}
              </span>
            ) : (
              <input
                type="number"
                value={workPackage.area > 0 ? workPackage.area : ''}
                onChange={(e) => updateWorkPackageField(blocId || '', productId || '', workPackage.id, 'area', parseFloat(e.target.value) || 0)}
                placeholder="Area"
                className="w-full text-center text-gray-800 bg-transparent border-none focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300 rounded px-2 py-1 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Enter area in hectares"
              />
            )}
          </td>
        )
      case 'quantity':
        return (
          <td key={key} className="px-3 py-2 w-24 text-center">
            {readOnly || isHarvest ? (
              <span className={`text-sm ${isHarvest ? 'text-gray-400' : 'text-gray-900'}`}>
                {isHarvest ? 'n/a' : (workPackage.quantity > 0 ? workPackage.quantity : '-')}
              </span>
            ) : (
              <input
                type="number"
                value={workPackage.quantity > 0 ? workPackage.quantity : ''}
                onChange={(e) => updateWorkPackageField(blocId || '', productId || '', workPackage.id, 'quantity', parseFloat(e.target.value) || 0)}
                placeholder="Qty"
                className="w-full text-center text-gray-800 bg-transparent border-none focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300 rounded px-2 py-1 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Enter quantity"
              />
            )}
          </td>
        )
      case 'rate':
        return (
          <td key={key} className="px-3 py-2 w-20 text-center">
            {readOnly ? (
              <span className="text-sm text-gray-900">{workPackage.rate > 0 ? workPackage.rate : '-'}</span>
            ) : (
              <input
                type="number"
                value={workPackage.rate > 0 ? workPackage.rate : ''}
                onChange={(e) => updateWorkPackageField(blocId || '', productId || '', workPackage.id, 'rate', parseFloat(e.target.value) || 0)}
                placeholder="Rate"
                className="w-full text-center text-gray-800 bg-transparent border-none focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300 rounded px-2 py-1 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Enter rate"
              />
            )}
          </td>
        )
      case 'status':
        return (
          <td key={key} className="px-3 py-2 w-16 text-center">
            {readOnly ? (
              <StatusBadge status={workPackage.status || 'not-started'} />
            ) : (
              <StatusCompactToggle
                status={workPackage.status || 'not-started'}
                onChange={(newStatus) => updateWorkPackageStatus(blocId || '', productId || '', workPackage.id, newStatus)}
              />
            )}
          </td>
        )
      default:
        return <td key={key} className="px-3 py-2">-</td>
    }
  }

  const renderWorkPackageFinancialCell = (workPackage: WorkPackageNode, key: string, operation?: ProductNode) => {
    const financialData = getWorkPackageFinancialData(workPackage, operation)
    const formatCurrency = (value: number) => `Rs ${value.toLocaleString()}`

    switch (key) {
      case 'operation':
        return (
          <td key={key} className="px-3 py-2 w-32">
            <span className="text-sm text-gray-900">{workPackage.operationName || 'N/A'}</span>
          </td>
        )
      case 'date':
        return (
          <td key={key} className="px-3 py-2 w-28 text-center">
            <span className="text-sm text-gray-900">{workPackage.date ? formatDate(workPackage.date) : 'Not set'}</span>
          </td>
        )
      case 'act_product_cost':
        return (
          <td key={key} className="px-3 py-2 w-28 text-right">
            <span className="text-sm text-gray-900">{formatCurrency(financialData.act_product_cost)}</span>
          </td>
        )
      case 'act_labour_cost':
        return (
          <td key={key} className="px-3 py-2 w-28 text-right">
            <span className="text-sm text-gray-900">{formatCurrency(financialData.act_labour_cost)}</span>
          </td>
        )
      case 'act_equipment_cost':
        return (
          <td key={key} className="px-3 py-2 w-32 text-right">
            <span className="text-sm text-gray-900">{formatCurrency(financialData.act_equipment_cost)}</span>
          </td>
        )
      default:
        return <td key={key} className="px-3 py-2">-</td>
    }
  }

  // Create bloc data from real bloc information
  useEffect(() => {
    if (bloc) {
      const blocOverviewData: BlocOverviewNode = {
        id: bloc.uuid || bloc.localId,
        name: bloc.name || `Bloc ${bloc.localId}`,
        area_hectares: bloc.area,
        cycle_number: activeCycle ? [activeCycle.cycleNumber] : [1],
        variety_name: activeCycle?.sugarcaneVarietyName || 'Not set',
        planned_harvest_date: activeCycle?.plannedHarvestDate || '',
        expected_yield_tons_ha: activeCycle?.expectedYield || 0,
        growth_stage: activeCycle ? calculateMonthsFromPlanting(activeCycle.plantingDate || activeCycle.ratoonPlantingDate).toString() : '0',
        progress: 0, // Will be calculated from activities
        total_est_product_cost: 0,
        total_est_resource_cost: 0,
        total_act_product_cost: 0,
        total_act_resource_cost: 0,
        cycle_type: activeCycle?.type || 'plantation',
        planting_date: activeCycle?.plantingDate || activeCycle?.ratoonPlantingDate || '',
        products: [] // Will be populated from activities
      }

      setData([blocOverviewData])
    }
  }, [bloc, activeCycle])

  const toggleBlocExpansion = (blocId: string) => {
    setExpandedBlocs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(blocId)) {
        newSet.delete(blocId)
      } else {
        newSet.add(blocId)
      }
      return newSet
    })
  }

  const toggleProductExpansion = (productId: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }

  // Update bloc field
  const updateBlocField = (blocId: string, field: keyof BlocOverviewNode, value: any) => {
    setData(prev => prev.map(bloc =>
      bloc.id === blocId ? { ...bloc, [field]: value } : bloc
    ))
  }

  // Update product field
  const updateProductField = (blocId: string, productId: string, field: keyof ProductNode, value: any) => {
    setData(prev => prev.map(bloc =>
      bloc.id === blocId
        ? {
            ...bloc,
            products: bloc.products?.map(product =>
              product.id === productId ? { ...product, [field]: value } : product
            )
          }
        : bloc
    ))
  }

  // Update work package field
  const updateWorkPackageField = (blocId: string, productId: string, workPackageId: string, field: keyof WorkPackageNode, value: any) => {
    setData(prev => prev.map(bloc =>
      bloc.id === blocId
        ? {
            ...bloc,
            products: bloc.products?.map(product =>
              product.id === productId
                ? {
                    ...product,
                    work_packages: product.work_packages?.map(wp =>
                      wp.id === workPackageId ? { ...wp, [field]: value } : wp
                    )
                  }
                : product
            )
          }
        : bloc
    ))
  }

  const addBloc = () => {
    const newBloc: BlocOverviewNode = {
      id: `bloc_${Date.now()}`,
      name: `New Bloc ${data.length + 1}`,
      area_hectares: 10.0,
      cycle_number: [1],
      variety_name: 'NCo 376',
      planned_harvest_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expected_yield_tons_ha: 80.0,
      growth_stage: 'germination',
      progress: 0,
      total_est_product_cost: 0,
      total_est_resource_cost: 0,
      total_act_product_cost: 0,
      total_act_resource_cost: 0,
      cycle_type: 'plantation',
      planting_date: new Date().toISOString().split('T')[0],
      products: []
    }
    setData(prev => [...prev, newBloc])
  }

  const addProduct = (blocId: string) => {
    const newProduct: ProductNode = {
      id: `product_${Date.now()}`,
      product_name: '', // Empty
      days_after_planting: 0, // Keep for data structure but won't display
      planned_start_date: '', // Empty
      planned_end_date: '', // Empty
      planned_rate: 0, // Empty
      method: '', // Empty
      progress: 0,
      est_product_cost: 1000,
      est_resource_cost: 500,
      act_product_cost: 0,
      act_resource_cost: 0,
      status: 'planned',
      work_packages: []
    }

    setData(prev => prev.map(bloc =>
      bloc.id === blocId
        ? { ...bloc, products: [...(bloc.products || []), newProduct] }
        : bloc
    ))

    // Auto-expand the bloc to show the new product
    setExpandedBlocs(prev => new Set(Array.from(prev).concat(blocId)))
  }

  const addWorkPackage = (blocId: string, productId: string) => {
    // Find the product to get its operation name
    const product = data
      .find(bloc => bloc.id === blocId)
      ?.products?.find(p => p.id === productId)

    const newWorkPackage: WorkPackageNode = {
      id: `wp_${Date.now()}`,
      days_after_planting: 0, // Keep for data structure but won't display
      date: '', // Empty
      area: 0, // Empty
      rate: 0, // Empty
      quantity: 0, // Empty
      notes: '', // Empty
      completed: false,
      status: 'not-started', // Initialize with not-started status
      operationName: product?.product_name || '' // Set operation name from parent product
    }

    setData(prev => prev.map(bloc =>
      bloc.id === blocId
        ? {
            ...bloc,
            products: bloc.products?.map(product =>
              product.id === productId
                ? { ...product, work_packages: [...(product.work_packages || []), newWorkPackage] }
                : product
            )
          }
        : bloc
    ))

    // Auto-expand both bloc and product to show the new work package
    setExpandedBlocs(prev => new Set(Array.from(prev).concat(blocId)))
    setExpandedProducts(prev => new Set(Array.from(prev).concat(productId)))
  }

  const deleteBloc = (blocId: string) => {
    if (window.confirm('Are you sure you want to delete this bloc? This action cannot be undone.')) {
      setData(prev => prev.filter(bloc => bloc.id !== blocId))
      // Also remove from expanded sets
      setExpandedBlocs(prev => {
        const newSet = new Set(prev)
        newSet.delete(blocId)
        return newSet
      })
    }
  }

  const deleteProduct = (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      setData(prev => prev.map(bloc => ({
        ...bloc,
        products: bloc.products?.filter(product => product.id !== productId)
      })))
      // Also remove from expanded sets
      setExpandedProducts(prev => {
        const newSet = new Set(prev)
        newSet.delete(productId)
        return newSet
      })
    }
  }

  const deleteWorkPackage = (workPackageId: string) => {
    if (window.confirm('Are you sure you want to delete this work package? This action cannot be undone.')) {
      setData(prev => prev.map(bloc => ({
        ...bloc,
        products: bloc.products?.map(product => ({
          ...product,
          work_packages: product.work_packages?.filter(wp => wp.id !== workPackageId)
        }))
      })))
    }
  }

  // Render Level 1 (Bloc) Table
  const renderBlocTable = () => {
    return (
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className={`${DEFAULT_COLORS.bloc.header} border-b-2 ${DEFAULT_COLORS.bloc.border}`}>
              <tr>
                <th className="px-2 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider w-32">
                  Bloc Name
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider w-24">
                  Crop Cycle
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider w-20">
                  Area
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider w-24">
                  Variety
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider w-32">
                  Planned Harvest Date
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider w-24">
                  Planned Yield
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider w-28">
                  Growth Stage (Months)
                </th>
                {!readOnly && (
                  <th className="w-8 px-1"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((bloc) => (
                <React.Fragment key={bloc.id}>
                  {/* Bloc Row */}
                  <tr className={`${DEFAULT_COLORS.bloc.background} ${DEFAULT_COLORS.bloc.hover} group`}>
                    <td className="px-2 py-3 w-32">
                      <div className="flex items-center">
                        {bloc.products && bloc.products.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleBlocExpansion(bloc.id)}
                            className="mr-1 p-1 hover:bg-blue-200 rounded flex-shrink-0"
                          >
                            {expandedBlocs.has(bloc.id) ? (
                              <ChevronDownIcon className="h-3 w-3 text-blue-700" />
                            ) : (
                              <ChevronRightIcon className="h-3 w-3 text-blue-700" />
                            )}
                          </button>
                        )}
                        <span className="text-blue-800 truncate text-sm">{bloc.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-blue-800 w-24 text-sm">
                      {bloc.cycle_type === 'plantation' ? 'Plantation' : `Ratoon ${bloc.cycle_number[0] - 1}`}
                    </td>
                    <td className="px-2 py-3 text-blue-800 w-20 text-sm">{bloc.area_hectares.toFixed(1)} ha</td>
                    <td className="px-2 py-3 text-blue-800 w-24 truncate text-sm">{bloc.variety_name}</td>
                    <td className="px-2 py-3 w-32">
                      <span className="text-blue-800 text-sm">
                        {bloc.planned_harvest_date ? formatDate(bloc.planned_harvest_date) : 'Not set'}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-blue-800 w-24 text-sm">{bloc.expected_yield_tons_ha.toFixed(1)} t/ha</td>
                    <td className="px-2 py-3 w-28">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        {bloc.growth_stage} months
                      </span>
                    </td>
                    {!readOnly && (
                      <td className="w-8 px-1">
                        <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            title="Edit Crop Cycle"
                            className="p-1 hover:bg-blue-200 rounded text-blue-600"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>

                  {/* Nested Products Table */}
                  {expandedBlocs.has(bloc.id) && (
                    <tr>
                      <td colSpan={readOnly ? 8 : 9} className="p-0">
                        <div className="bg-green-25 border-l-4 border-green-300 ml-8">
                          {/* Field Operations Title - Only show if products exist */}
                          {bloc.products && bloc.products.length > 0 && (
                            <div className="bg-green-100 border-b border-green-300 px-4 py-2 ml-4 mr-4 mt-4 rounded-t-lg flex justify-between items-center">
                              <h3 className="text-sm font-semibold text-green-900">Field Operations</h3>
                              {!readOnly && (
                                <button
                                  type="button"
                                  title="Add Field Operation"
                                  onClick={() => addProduct(bloc.id)}
                                  className="p-1 hover:bg-green-200 rounded text-green-700"
                                >
                                  <PlusIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          )}
                          {renderProductTable(bloc)}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Show empty state when bloc is not expanded but has no products */}
                  {!expandedBlocs.has(bloc.id) && (!bloc.products || bloc.products.length === 0) && (
                    <tr>
                      <td colSpan={readOnly ? 8 : 9} className="p-0">
                        <div className="bg-green-25 border-l-4 border-green-300 ml-8">
                          <div className="p-4 border-2 border-dashed border-green-300 bg-green-50 rounded-lg m-4">
                            <div className="text-center">
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => addProduct(bloc.id)}
                                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                                >
                                  <PlusIcon className="h-4 w-4 mr-2" />
                                  Add First Field Operation
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Render Level 2 (Product) Table
  const renderProductTable = (bloc: BlocOverviewNode) => {
    if (!bloc.products || bloc.products.length === 0) {
      return (
        <div className="p-4 m-4">
          <div className="text-center text-gray-500">
            No field operations added yet
          </div>
        </div>
      )
    }

    return (
      <div className="m-4 bg-white shadow-sm border border-green-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className={`${DEFAULT_COLORS.product.header} border-b-2 ${DEFAULT_COLORS.product.border}`}>
              <tr>
                {renderDynamicHeaders('node2', 'text-green-900')}
                {currentView === 'operations' && (
                  <th className="px-2 py-2 text-center text-xs font-medium text-green-900 uppercase tracking-wider w-28">
                    Progress
                  </th>
                )}
                {!readOnly && (
                  <th className="w-16"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bloc.products.map((product) => (
                <React.Fragment key={product.id}>
                  {/* Product Row */}
                  <tr className={`${DEFAULT_COLORS.product.background} ${DEFAULT_COLORS.product.hover} group`}>
                    {/* First column always has expand/collapse button */}
                    <td className="px-2 py-2 w-32">
                      <div className="flex items-center">
                        {/* Always show expand/collapse button */}
                        <button
                          type="button"
                          onClick={() => toggleProductExpansion(product.id)}
                          className="mr-1 p-1 hover:bg-green-200 rounded flex-shrink-0"
                        >
                          {expandedProducts.has(product.id) ? (
                            <ChevronDownIcon className="h-3 w-3 text-green-700" />
                          ) : (
                            <ChevronRightIcon className="h-3 w-3 text-green-700" />
                          )}
                        </button>
                        {currentView === 'operations' ? (
                          <div
                            className="cursor-pointer hover:bg-green-100 px-1 py-1 rounded border border-transparent hover:border-green-300 min-h-[24px] flex items-center"
                            onClick={() => {
                              setSelectedProductId(product.id)
                              setShowOperationSelector(true)
                            }}
                            title="Select Operation"
                          >
                            <span className="text-green-800 text-xs truncate">
                              {product.product_name || 'Select operation...'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-green-800 text-xs truncate">
                            {currentView === 'resources' ? 'Resources' : 'Financial'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Dynamic columns based on current view */}
                    {renderDynamicProductCells(product, bloc.id).slice(1)} {/* Skip first column as it's handled above */}

                    {/* Progress Column - only show in operations view */}
                    {currentView === 'operations' && (
                      <td className="px-2 py-2 w-28">
                        <div className="flex items-center justify-center">
                          {(() => {
                            const progress = calculateProductProgress(product, bloc.area_hectares)
                            return (
                              <div className="w-full">
                                <div className="flex items-center justify-between text-xs text-green-700 mb-1">
                                  <span>Progress</span>
                                  <span className="font-medium">{progress}%</span>
                                </div>
                                <div className="w-full bg-green-200 rounded-full h-2">
                                  <div
                                    className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300 ease-in-out"
                                    style={{ width: `${progress}%` }}
                                  ></div>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      </td>
                    )}

                    {/* Actions Column */}
                    {!readOnly && (
                      <td className="px-1 py-2 w-16">
                        <div className="flex justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            title="Edit Field Operation"
                            onClick={() => handleEditOperation(product)}
                            className="p-1 hover:bg-green-200 rounded text-green-600"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Delete Field Operation"
                            onClick={() => deleteProduct(product.id)}
                            className="p-1 hover:bg-green-200 rounded text-red-600"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>

                  {/* Nested Work Packages Table */}
                  {expandedProducts.has(product.id) && (
                    <tr>
                      <td colSpan={readOnly ? 7 : 8} className="p-0">
                        <div className="bg-gray-25 border-l-4 border-gray-300 ml-8">
                          {/* Daily Work Packages Title - Always show */}
                          <div className="bg-gray-100 border-b border-gray-300 px-3 py-2 ml-3 mr-3 mt-3 rounded-t-lg flex justify-between items-center">
                            <h4 className="text-sm font-semibold text-gray-900">Daily Work Packages</h4>
                            {!readOnly && (
                              <button
                                type="button"
                                title="Add Work Package"
                                onClick={() => addWorkPackage(bloc.id, product.id)}
                                className="p-1 hover:bg-gray-200 rounded text-gray-700"
                              >
                                <PlusIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          {renderWorkPackageTable(bloc, product)}
                        </div>
                      </td>
                    </tr>
                  )}


                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>


      </div>
    )
  }

  // Render Level 3 (Work Package) Table
  const renderWorkPackageTable = (bloc: BlocOverviewNode, product: ProductNode) => {
    if (!product.work_packages || product.work_packages.length === 0) {
      return null // Don't render anything when no work packages exist
    }

    return (
      <div className="m-3 bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className={`${DEFAULT_COLORS.workPackage.header} border-b-2 ${DEFAULT_COLORS.workPackage.border}`}>
              <tr>
                {renderDynamicHeaders('node3', 'text-gray-900')}
                {!readOnly && (
                  <th className="w-16"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {product.work_packages.map((workPackage) => (
                <tr key={workPackage.id} className={`${DEFAULT_COLORS.workPackage.background} ${DEFAULT_COLORS.workPackage.hover} group`}>
                  {/* Dynamic columns based on current view */}
                  {renderDynamicWorkPackageCells(workPackage, bloc.id, product.id)}

                  {/* Actions Column */}
                  {!readOnly && (
                    <td className="px-1 py-2 w-16">
                      <div className="flex justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          title="Edit Work Package"
                          onClick={() => handleEditWorkPackage(workPackage, bloc.id, product.id)}
                          className="p-1 hover:bg-gray-200 rounded text-gray-600"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete Work Package"
                          onClick={() => deleteWorkPackage(workPackage.id)}
                          className="p-1 hover:bg-gray-200 rounded text-red-600"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Work Package Footer - Only show in financial view */}
        {currentView === 'financial' && (
          <div className="bg-white border-t border-black px-3 py-2">
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div className="text-center">
                <div className="text-black font-medium">Total Act. Product</div>
                <div className="text-black font-bold">
                  Rs {(() => {
                    const total = product.work_packages?.reduce((acc, dwp) => {
                      const dwpData = getWorkPackageFinancialData(dwp, product)
                      return acc + dwpData.act_product_cost
                    }, 0) || 0
                    return total.toLocaleString()
                  })()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-black font-medium">Total Act. Labour</div>
                <div className="text-black font-bold">
                  Rs {(() => {
                    const total = product.work_packages?.reduce((acc, dwp) => {
                      const dwpData = getWorkPackageFinancialData(dwp, product)
                      return acc + dwpData.act_labour_cost
                    }, 0) || 0
                    return total.toLocaleString()
                  })()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-black font-medium">Total Act. Equipment</div>
                <div className="text-black font-bold">
                  Rs {(() => {
                    const total = product.work_packages?.reduce((acc, dwp) => {
                      const dwpData = getWorkPackageFinancialData(dwp, product)
                      return acc + dwpData.act_equipment_cost
                    }, 0) || 0
                    return total.toLocaleString()
                  })()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-black font-medium">Total Act. Cost</div>
                <div className="text-black font-bold">
                  Rs {(() => {
                    const total = product.work_packages?.reduce((acc, dwp) => {
                      const dwpData = getWorkPackageFinancialData(dwp, product)
                      return acc + dwpData.act_product_cost + dwpData.act_labour_cost + dwpData.act_equipment_cost
                    }, 0) || 0
                    return total.toLocaleString()
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const expandAll = () => {
    const allBlocIds = new Set(data.map(bloc => bloc.id))
    const allProductIds = new Set(
      data.flatMap(bloc => bloc.products?.map(product => product.id) || [])
    )
    setExpandedBlocs(allBlocIds)
    setExpandedProducts(allProductIds)
  }

  const collapseAll = () => {
    setExpandedBlocs(new Set())
    setExpandedProducts(new Set())
  }

  // Render footer summary for simplified structure
  const renderFooterSummary = (bloc: BlocOverviewNode) => {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
        <div className="grid grid-cols-5 gap-3 text-sm">
          <div className="text-center">
            <div className="text-black font-medium">Total Act. Product</div>
            <div className="text-black font-bold">
              Rs {(() => {
                const total = bloc.products?.reduce((acc, product) => {
                  const dwpTotal = product.work_packages?.reduce((dwpAcc, dwp) => {
                    const dwpData = getWorkPackageFinancialData(dwp, product)
                    return dwpAcc + dwpData.act_product_cost
                  }, 0) || 0
                  return acc + dwpTotal
                }, 0) || 0
                return total.toLocaleString()
              })()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-black font-medium">Total Act. Labour</div>
            <div className="text-black font-bold">
              Rs {(() => {
                const total = bloc.products?.reduce((acc, product) => {
                  const dwpTotal = product.work_packages?.reduce((dwpAcc, dwp) => {
                    const dwpData = getWorkPackageFinancialData(dwp, product)
                    return dwpAcc + dwpData.act_labour_cost
                  }, 0) || 0
                  return acc + dwpTotal
                }, 0) || 0
                return total.toLocaleString()
              })()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-black font-medium">Total Act. Equipment</div>
            <div className="text-black font-bold">
              Rs {(() => {
                const total = bloc.products?.reduce((acc, product) => {
                  const dwpTotal = product.work_packages?.reduce((dwpAcc, dwp) => {
                    const dwpData = getWorkPackageFinancialData(dwp, product)
                    return dwpAcc + dwpData.act_equipment_cost
                  }, 0) || 0
                  return acc + dwpTotal
                }, 0) || 0
                return total.toLocaleString()
              })()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-black font-medium">Total Act. Cost</div>
            <div className="text-black font-bold">
              Rs {(() => {
                const total = bloc.products?.reduce((acc, product) => {
                  const dwpTotal = product.work_packages?.reduce((dwpAcc, dwp) => {
                    const dwpData = getWorkPackageFinancialData(dwp, product)
                    return dwpAcc + dwpData.act_product_cost + dwpData.act_labour_cost + dwpData.act_equipment_cost
                  }, 0) || 0
                  return acc + dwpTotal
                }, 0) || 0
                return total.toLocaleString()
              })()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-black font-medium">Total Act. Revenue</div>
            <div className="text-black font-bold">
              Rs {(() => {
                const total = bloc.products?.reduce((acc, product) => {
                  const financialData = getFinancialData(product, false)
                  return acc + financialData.actual_revenue
                }, 0) || 0
                return total.toLocaleString()
              })()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render simplified structure without node 1 (bloc level) - only show node 2 and node 3
  const renderSimplifiedStructure = () => {
    // Get the first bloc (since we're hiding node 1, we'll work with the first bloc)
    const bloc = data[0]
    if (!bloc) return null

    return (
      <div className="space-y-4">
        {/* Field Operations Section (Node 2) */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          {/* Field Operations Title Header - Always show */}
          <div className="bg-green-100 border-b border-green-300 px-4 py-3 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-green-900">Field Operations</h3>
            {!readOnly && (
              <button
                type="button"
                title="Add Field Operation"
                onClick={() => addProduct(bloc.id)}
                className="p-2 hover:bg-green-200 rounded text-green-700"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Field Operations Content */}
          {renderProductTable(bloc)}
        </div>

        {/* Footer with Financial Summary */}
        {renderFooterSummary(bloc)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* View Switcher */}
      <div className="flex justify-between items-center">
        <ContentSwitcher
          options={viewOptions}
          selectedId={currentView}
          onChange={handleViewChange}
        />
        <div className="text-sm text-gray-500">
          Viewing: <span className="font-medium capitalize">{currentView}</span> data
        </div>
      </div>

      {/* Main Simplified Structure - Hide Node 1, Show Only Node 2 and Node 3 */}
      {renderSimplifiedStructure()}

      {/* Operation Selector Modal */}
      {showOperationSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Select Operation</h3>
            <div className="space-y-2">
              {mockOperations.map((operation) => (
                <button
                  key={operation}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded"
                  onClick={() => {
                    if (selectedProductId) {
                      setData(prev => prev.map(bloc => ({
                        ...bloc,
                        products: bloc.products?.map(p =>
                          p.id === selectedProductId ? {
                            ...p,
                            product_name: operation,
                            // Update operation name in all work packages
                            work_packages: p.work_packages?.map(wp => ({
                              ...wp,
                              operationName: operation
                            }))
                          } : p
                        )
                      })))
                    }
                    setShowOperationSelector(false)
                    setSelectedProductId(null)
                  }}
                >
                  {operation}
                </button>
              ))}
            </div>
            <button
              className="mt-4 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              onClick={() => {
                setShowOperationSelector(false)
                setSelectedProductId(null)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Method Selector Modal */}
      {showMethodSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Select Method</h3>
            <div className="space-y-2">
              {mockMethods.map((method) => (
                <button
                  key={method}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded"
                  onClick={() => {
                    if (selectedProductId) {
                      setData(prev => prev.map(bloc => ({
                        ...bloc,
                        products: bloc.products?.map(p =>
                          p.id === selectedProductId ? { ...p, method: method } : p
                        )
                      })))
                    }
                    setShowMethodSelector(false)
                    setSelectedProductId(null)
                  }}
                >
                  {method}
                </button>
              ))}
            </div>
            <button
              className="mt-4 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              onClick={() => {
                setShowMethodSelector(false)
                setSelectedProductId(null)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Real Product Selector Modal */}
      {showProductSelector && (
        <ProductSelector
          onSelect={handleRealProductSelect}
          onClose={() => {
            setShowProductSelector(false)
            setSelectedProductId(null)
          }}
          blocArea={data.find(b => b.products?.some(p => p.id === selectedProductId))?.area_hectares || 1}
        />
      )}

      {/* Operations Form Modal */}
      {showOperationsForm && editingOperation && (
        <OperationsForm
          operation={editingOperation}
          blocArea={data.find(b => b.products?.some(p => p.id === editingOperation.id))?.area_hectares || 1}
          activeCycleInfo={activeCycleInfo}
          onSave={handleOperationSave}
          onCancel={() => {
            setShowOperationsForm(false)
            setEditingOperation(null)
          }}
        />
      )}

      {/* Edit Work Package Form Modal */}
      {showWorkPackageForm && editingWorkPackage && (() => {
        // Find the operation (product) that contains this work package to get its equipment and products data
        const bloc = data.find(bloc => bloc.id === editingWorkPackage.blocId)
        const operation = bloc?.products?.find(product => product.id === editingWorkPackage.productId)

        return (
          <EditWorkPackageForm
            workPackage={editingWorkPackage.workPackage}
            blocId={editingWorkPackage.blocId}
            productId={editingWorkPackage.productId}
            blocArea={bloc?.area_hectares || 1}
            operationEquipment={operation?.equipmentData || []}
            operationProducts={operation?.productsData || []}
            onSave={handleWorkPackageSave}
            onCancel={() => {
              setShowWorkPackageForm(false)
              setEditingWorkPackage(null)
            }}
          />
        )
      })()}

    </div>
  )
}
