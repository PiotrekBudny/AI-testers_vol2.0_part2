import type { ProductCategory } from '../enums/productCategory';

/** Single product as returned in `content` of GET /api/v1/products/search. */
export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  category: ProductCategory;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  averageRating: number | null;
  reviewCount: number;
}
