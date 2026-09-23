import api from './api';
import { AxiosRequestConfig } from 'axios';

export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  rating: number;
  stock: number;
  category: string;
  thumbnail: string;
  images: string[];
  reviews?: {
    rating: number;
    comment: string;
    date: string;
    reviewerName: string;
  }[];
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  skip: number;
  limit: number;
}

export interface Category {
  slug: string;
  name: string;
  url: string;
}

export const authService = {
  login: async (credentials: Record<string, string>) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
};

export const productService = {
  getProducts: async (
    params: { limit: number; skip: number; sortBy?: string; order?: string },
    config?: AxiosRequestConfig
  ) => {
    const response = await api.get<ProductsResponse>('/products', {
      params,
      ...config,
    });
    return response.data;
  },

  searchProducts: async (
    query: string,
    params: { limit: number; skip: number; sortBy?: string; order?: string },
    config?: AxiosRequestConfig
  ) => {
    const response = await api.get<ProductsResponse>(`/products/search`, {
      params: { q: query, ...params },
      ...config,
    });
    return response.data;
  },

  getProductsByCategory: async (
    category: string,
    params: { limit: number; skip: number; sortBy?: string; order?: string },
    config?: AxiosRequestConfig
  ) => {
    const response = await api.get<ProductsResponse>(
      `/products/category/${category}`,
      {
        params,
        ...config,
      }
    );
    return response.data;
  },

  getProductById: async (id: number) => {
    const response = await api.get<Product>(`/products/${id}`);
    return response.data;
  },

  addProduct: async (data: Partial<Product>) => {
    const response = await api.post<Product>('/products/add', data);
    return response.data;
  },

  updateProduct: async (id: number, data: Partial<Product>) => {
    const response = await api.put<Product>(`/products/${id}`, data);
    return response.data;
  },

  deleteProduct: async (id: number) => {
    const response = await api.delete<Product>(`/products/${id}`);
    return response.data;
  },
};

export const categoryService = {
  getCategories: async () => {
    // Some versions of DummyJSON return string[], others return object[]. We'll handle it.
    const response = await api.get('/products/categories');
    return response.data;
  },
};
