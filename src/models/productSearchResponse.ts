import type { ProductCategory } from '../enums/productCategory';
import type { Product } from './product';

export interface CategoryFacet {
  value: ProductCategory;
  count: number;
}

/** Both values are null when no product matches. */
export interface PriceRange {
  min: number | null;
  max: number | null;
}

export interface ProductSearchFacets {
  categories: CategoryFacet[];
  priceRange: PriceRange;
  inStockCount: number;
}

/** Response body of GET /api/v1/products/search. */
export interface ProductSearchResponse {
  content: Product[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  facets: ProductSearchFacets;
}
