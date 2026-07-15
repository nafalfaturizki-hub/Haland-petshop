export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sellPrice: number;
  stock: number;
  categoryName: string | null;
  imageUrl: string | null;
};

export type CartItem = {
  productId: string;
  name: string;
  qty: number;
  price: number;
  stock: number;
};

export type CustomerOption = { id: string; name: string };

export type CategoryChip = { id: string; name: string; activeProductCount: number };

export function getPosCartCount(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

export function getPosCartSubtotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.qty * item.price, 0);
}
