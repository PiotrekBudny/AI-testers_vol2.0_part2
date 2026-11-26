import type { ProductCategory } from '@/enums/productCategory';
import type { Product } from './product';

export interface CategoryFacet {
  value: ProductCategory;
  count: number;
}

export interface PriceRange {
  min: number | null;
  max: number | null;
}

export interface ProductSearchFacets {
  categories: CategoryFacet[];
  priceRange: PriceRange;
  inStockCount: number;
}

export interface ProductSearchResponse {
  content: Product[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  facets: ProductSearchFacets;
}
