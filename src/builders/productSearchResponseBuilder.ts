import { ProductGenerator } from '../generators/productGenerator';
import type { Product } from '../models/product';
import type {
  CategoryFacet,
  ProductSearchFacets,
  ProductSearchResponse,
} from '../models/productSearchResponse';

// The API defaults to 20, but the frontend always requests size=12.
const DEFAULT_PAGE_SIZE = 12;
const DEFAULT_PRODUCT_COUNT = 8;

/**
 * Builds a GET /api/v1/products/search response.
 *
 * `withProducts` takes every product matching the search; `build` cuts out the
 * requested page into `content` and derives totals and facets from all of them,
 * the same way the backend does.
 */
export class ProductSearchResponseBuilder {
  private products: Product[] | undefined;
  private pageNumber = 0;
  private pageSize = DEFAULT_PAGE_SIZE;

  withProducts(products: Product[]): this {
    this.products = products;
    return this;
  }

  withGeneratedProducts(
    count: number,
    overrides: Omit<Partial<Product>, 'id'> = {},
  ): this {
    this.products = new ProductGenerator().generateProducts(count, overrides);
    return this;
  }

  withPageNumber(pageNumber: number): this {
    this.pageNumber = pageNumber;
    return this;
  }

  withPageSize(pageSize: number): this {
    this.pageSize = pageSize;
    return this;
  }

  build(): ProductSearchResponse {
    const products =
      this.products ??
      new ProductGenerator().generateProducts(DEFAULT_PRODUCT_COUNT);
    const start = this.pageNumber * this.pageSize;

    return {
      content: products.slice(start, start + this.pageSize),
      pageNumber: this.pageNumber,
      pageSize: this.pageSize,
      totalElements: products.length,
      totalPages: Math.ceil(products.length / this.pageSize),
      facets: buildFacets(products),
    };
  }
}

function buildFacets(products: Product[]): ProductSearchFacets {
  const counts = new Map<CategoryFacet['value'], number>();
  for (const { category } of products) {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  // Spec: "largest first, then by value".
  const categories = [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  const prices = products.map(({ price }) => price);

  return {
    categories,
    priceRange: {
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
    },
    inStockCount: products.filter(({ stockQuantity }) => stockQuantity > 0)
      .length,
  };
}
