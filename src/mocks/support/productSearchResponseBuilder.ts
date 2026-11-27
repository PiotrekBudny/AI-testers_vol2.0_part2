import type { Product } from '@/models/product';
import type {
  CategoryFacet,
  ProductSearchFacets,
  ProductSearchResponse,
} from '@/models/productSearchResponse';
import { pageOf } from './paging';

const DEFAULT_PAGE_SIZE = 12;

export class ProductSearchResponseBuilder {
  private products: Product[] = [];
  private pageNumber = 0;
  private pageSize = DEFAULT_PAGE_SIZE;

  withProducts(products: Product[]): this {
    this.products = products;
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
    return {
      ...pageOf(this.products, this.pageNumber, this.pageSize),
      facets: buildFacets(this.products),
    };
  }
}

function buildFacets(products: Product[]): ProductSearchFacets {
  const counts = new Map<CategoryFacet['value'], number>();
  for (const { category } of products) {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

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
