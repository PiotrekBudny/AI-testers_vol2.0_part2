import type { ProductCategory } from '@/enums/productCategory';

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

export type ProductDetails = Omit<Product, 'averageRating' | 'reviewCount'>;
