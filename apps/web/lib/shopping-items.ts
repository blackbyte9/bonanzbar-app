import { z } from "zod";

export const shoppingItemInputSchema = z.object({
  itemId: z.string().cuid().optional(),
  name: z.string().trim().min(2).max(100),
  quantity: z.coerce.number().int().min(1).max(10000),
  quantityMode: z.enum(["UNIT", "PACKAGE"]).default("UNIT"),
});

export type ShoppingItemInput = z.infer<typeof shoppingItemInputSchema>;

export function shoppingItemQuantity(item: Pick<ShoppingItemInput, "quantity" | "quantityMode">, packageSize?: number): number {
  if (item.quantityMode === "UNIT") return item.quantity;
  if (!packageSize) throw new RangeError("Gebinde benötigen eine gültige Gebindegröße.");
  return item.quantity * packageSize;
}
