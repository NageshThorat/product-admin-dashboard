import { useState, useEffect, useCallback } from 'react';
import { Product } from '@/lib/services';

interface LocalModifications {
  added: Product[];
  edited: Record<number, Product>;
  deleted: number[]; // using array instead of Set for JSON serialization
}

const DEFAULT_STATE: LocalModifications = {
  added: [],
  edited: {},
  deleted: [],
};

export function useLocalModifications() {
  const [modifications, setModifications] = useState<LocalModifications>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dummyjson_mods');
      if (stored) {
        setModifications(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to parse local modifications', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage whenever it changes
  const updateModifications = useCallback((newMods: LocalModifications) => {
    setModifications(newMods);
    try {
      localStorage.setItem('dummyjson_mods', JSON.stringify(newMods));
    } catch (e) {
      console.error('Failed to save local modifications', e);
    }
  }, []);

  const addProduct = useCallback((product: Product) => {
    updateModifications({
      ...modifications,
      added: [product, ...modifications.added],
    });
  }, [modifications, updateModifications]);

  const editProduct = useCallback((id: number, updates: Partial<Product>) => {
    updateModifications({
      ...modifications,
      edited: {
        ...modifications.edited,
        [id]: { ...(modifications.edited[id] || {}), ...updates } as Product,
      },
    });
  }, [modifications, updateModifications]);

  const deleteProduct = useCallback((id: number) => {
    updateModifications({
      ...modifications,
      added: modifications.added.filter((p) => p.id !== id),
      deleted: [...modifications.deleted, id],
    });
  }, [modifications, updateModifications]);

  return {
    modifications,
    isLoaded,
    addProduct,
    editProduct,
    deleteProduct,
  };
}
