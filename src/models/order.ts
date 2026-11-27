export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export type AddressField = keyof Address;

export type FieldErrors = Partial<Record<AddressField, string>>;

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  productName: string;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: number;
  username: string;
  items: OrderItem[];
  totalAmount: number;
  subtotalAmount: number;
  discountAmount: number;
  couponCode: string | null;
  status: OrderStatus;
  taxCountry: string | null;
  taxRate: number | null;
  taxAmount: number | null;
  netAmount: number | null;
  reservationExpiresAt: string | null;
  shippingAddress: Address;
  createdAt: string;
  updatedAt: string;
}

export interface TaxPreview {
  country: string;
  rate: number;
  taxAmount: number;
  netAmount: number;
  totalAmount: number;
}

export interface VatRate {
  countryCode: string;
  countryName: string;
  rate: number;
}
