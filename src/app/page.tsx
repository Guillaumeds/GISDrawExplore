import dynamic from 'next/dynamic'

// Dynamically import the layout component to avoid SSR issues with Leaflet
const FarmGISLayout = dynamic(() => import('@/components/FarmGISLayout'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading Farm GIS...</p>
      </div>
    </div>
  )
})

export default function Home() {
  return (
    <main className="h-screen w-full">
      <FarmGISLayout />
    </main>
  )
}
