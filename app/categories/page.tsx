import { CategoriesManager } from "@/components/categories-manager"

export default function CategoriesPage() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4 text-pretty">Manage Categories</h1>
      <CategoriesManager />
    </main>
  )
}
