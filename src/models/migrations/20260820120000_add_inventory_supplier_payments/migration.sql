ALTER TABLE "inventory_items"
  ADD COLUMN "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paid_at" TIMESTAMP(3),
  ADD COLUMN "payment_method" "PaymentMethod";
