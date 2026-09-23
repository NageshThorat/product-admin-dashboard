'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { productService, categoryService, Product, Category } from '@/lib/services';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/Pagination';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { ProductFormModal } from '@/components/ProductFormModal';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { Plus, Search, Edit2, Trash2, Eye } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';



// Fake state helper to keep track of local changes
let localModifications: {
  added: Product[];
  edited: Record<number, Product>;
  deleted: Set<number>;
} = {
  added: [],
  edited: {},
  deleted: new Set(),
};

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL State
  const pageParam = parseInt(searchParams.get('page') || '1');
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const limitParam = parseInt(searchParams.get('limit') || '10');
  const limit = [10, 20, 50].includes(limitParam) ? limitParam : 10;
  const searchParam = searchParams.get('search') || '';
  const categoryParam = searchParams.get('category') || '';
  const sortParam = searchParams.get('sortBy') || '';

  // Local State for Search Input (to avoid lag while typing)
  const [searchInput, setSearchInput] = useState(searchParam);
  const debouncedSearch = useDebounce(searchInput, 500);
  const isFirstRender = useRef(true);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Update URL function
  const updateUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      router.push(`/products?${params.toString()}`);
    },
    [searchParams, router]
  );

  // Effect for debounced search
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // When search changes, reset page to 1 and clear category
    if (debouncedSearch !== searchParam) {
      updateUrl({
        search: debouncedSearch,
        category: null,
        page: '1',
      });
    }
  }, [debouncedSearch, searchParam, updateUrl]);

  // Fetch Categories
  useEffect(() => {
    categoryService.getCategories().then((data) => {
      setCategories(data);
    }).catch(console.error);
  }, []);

  // Fetch Products
  const fetchProducts = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const skip = (page - 1) * limit;
      const sortBy = sortParam ? sortParam.split('-')[0] : undefined;
      const order = sortParam ? sortParam.split('-')[1] : undefined;

      let data;
      if (searchParam) {
        data = await productService.searchProducts(
          searchParam,
          { limit, skip, sortBy, order },
          { signal: abortControllerRef.current.signal }
        );
      } else if (categoryParam) {
        data = await productService.getProductsByCategory(
          categoryParam,
          { limit, skip, sortBy, order },
          { signal: abortControllerRef.current.signal }
        );
      } else {
        data = await productService.getProducts(
          { limit, skip, sortBy, order },
          { signal: abortControllerRef.current.signal }
        );
      }

      // Apply local modifications
      let updatedProducts = [...data.products];

      // Remove deleted
      updatedProducts = updatedProducts.filter((p) => !localModifications.deleted.has(p.id));

      // Apply edits
      updatedProducts = updatedProducts.map((p) =>
        localModifications.edited[p.id] ? { ...p, ...localModifications.edited[p.id] } : p
      );

      // Add newly added items to the first page (simplified logic)
      if (page === 1 && !searchParam && !categoryParam) {
         updatedProducts = [...localModifications.added, ...updatedProducts].slice(0, limit);
      }

      setProducts(updatedProducts);
      setTotal(data.total + localModifications.added.length);
    } catch (err: any) {
      if (err.name !== 'CanceledError') {
        setError('Failed to fetch products. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchParam, categoryParam, sortParam]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSearchInput('');
    updateUrl({
      category: val,
      search: null,
      page: '1',
    });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateUrl({
      sortBy: e.target.value,
      page: '1', // Reset to page 1 on sort change usually makes sense
    });
  };

  const handleSaveProduct = async (formData: Partial<Product>) => {
    setIsSaving(true);
    try {
      if (selectedProduct) {
        // Edit
        const res = await productService.updateProduct(selectedProduct.id, formData);
        localModifications.edited[selectedProduct.id] = { ...selectedProduct, ...formData } as Product;
      } else {
        // Add
        const res = await productService.addProduct(formData);
        const newProduct = { ...res, id: Date.now() }; // Fake ID since dummyjson returns id: 281 for all additions
        localModifications.added.unshift(newProduct);
      }
      setIsFormOpen(false);
      fetchProducts(); // Re-fetch or just re-apply local mods
    } catch (err) {
      console.error(err);
      alert('Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    setIsSaving(true);
    try {
      await productService.deleteProduct(selectedProduct.id);
      localModifications.deleted.add(selectedProduct.id);
      setIsDeleteOpen(false);
      fetchProducts();
    } catch (err) {
      console.error(err);
      alert('Failed to delete product');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h1>
        <button
          onClick={() => {
            setSelectedProduct(null);
            setIsFormOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative col-span-1 sm:col-span-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search products..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <select
              value={categoryParam}
              onChange={handleCategoryChange}
              className="block w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Categories</option>
              {categories.map((cat: any) => (
                <option key={cat.slug || cat} value={cat.slug || cat}>
                  {cat.name || cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={sortParam}
              onChange={handleSortChange}
              className="block w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Sort By...</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating-desc">Rating: Highest</option>
              <option value="title-asc">Title: A to Z</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading products..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchProducts} />
      ) : products.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No products found.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rating</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                          {product.thumbnail && (
                            <Image src={product.thumbnail} alt={product.title} fill className="object-cover" sizes="40px" />
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{product.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                      ${product.price?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {product.rating} ⭐
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {product.stock}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Link href={`/products/${product.id}`} className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1 inline-block">
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => { setSelectedProduct(product); setIsFormOpen(true); }}
                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1 inline-block"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setSelectedProduct(product); setIsDeleteOpen(true); }}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 inline-block"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {products.map((product) => (
              <div key={product.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 h-16 w-16 relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                    {product.thumbnail && (
                      <Image src={product.thumbnail} alt={product.title} fill className="object-cover" sizes="64px" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">${product.price?.toFixed(2)}</p>
                    <div className="mt-2 flex items-center justify-between">
                       <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {product.category}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">★ {product.rating}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                  <Link href={`/products/${product.id}`} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    View
                  </Link>
                  <button
                    onClick={() => { setSelectedProduct(product); setIsFormOpen(true); }}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { setSelectedProduct(product); setIsDeleteOpen(true); }}
                    className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={page}
            limit={limit}
            totalItems={total}
            totalPages={Math.ceil(total / limit)}
            onPageChange={(p) => updateUrl({ page: p.toString() })}
            onLimitChange={(l) => updateUrl({ limit: l.toString(), page: '1' })}
          />
        </>
      )}

      <ProductFormModal
        isOpen={isFormOpen}
        isSaving={isSaving}
        product={selectedProduct}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveProduct}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteOpen}
        isDeleting={isSaving}
        productName={selectedProduct?.title || ''}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteProduct}
      />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading dashboard..." />}>
      <ProductsContent />
    </Suspense>
  );
}
