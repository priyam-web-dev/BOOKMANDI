CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  genre TEXT NOT NULL DEFAULT 'Other',
  price NUMERIC(10,2) NOT NULL CHECK (price > 0),
  cod_price NUMERIC(10,2) NOT NULL CHECK (cod_price >= price),
  mrp NUMERIC(10,2) NOT NULL CHECK (mrp >= price),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image TEXT NOT NULL DEFAULT '📚',
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  customer_city TEXT NOT NULL,
  customer_pincode TEXT NOT NULL,

  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('ONLINE', 'COD')),

  status TEXT NOT NULL,

  total NUMERIC(10,2) NOT NULL
    CHECK (total > 0),

  currency TEXT NOT NULL DEFAULT 'INR',

  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,

  paid_at TIMESTAMPTZ,
  stock_restored_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,

  order_id TEXT NOT NULL
    REFERENCES orders(id)
    ON DELETE CASCADE,

  product_id TEXT NOT NULL
    REFERENCES products(id),

  title TEXT NOT NULL,

  qty INTEGER NOT NULL
    CHECK (qty > 0),

  unit_price NUMERIC(10,2) NOT NULL
    CHECK (unit_price > 0)
);

CREATE INDEX IF NOT EXISTS idx_products_active
ON products(active);

CREATE INDEX IF NOT EXISTS idx_products_genre
ON products(genre);

CREATE INDEX IF NOT EXISTS idx_orders_status
ON orders(status);

CREATE INDEX IF NOT EXISTS idx_orders_phone
ON orders(customer_phone);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
ON order_items(order_id);