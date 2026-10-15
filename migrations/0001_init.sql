CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  price_paise INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','customer')),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO categories (id, name) VALUES
('cat-anime','Anime'),
('cat-electronics','Electronics'),
('cat-fashion','Fashion'),
('cat-accessories','Accessories');

INSERT OR IGNORE INTO products
(id,name,description,category,price_paise,stock,image_url,active)
VALUES
('seed-anime-hoodie','Anime Graphic Hoodie','Everyday hoodie with an anime-inspired graphic.','Anime',79900,20,'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80',1),
('seed-earbuds','Wireless Earbuds','Compact wireless earbuds for everyday listening.','Electronics',129900,15,'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=80',1),
('seed-sneakers','Everyday Sneakers','Comfortable sneakers for daily wear.','Fashion',159900,12,'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',1),
('seed-keychain','Anime Keychain','A small collectible accessory for your bag or keys.','Accessories',19900,50,'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80',1);

INSERT OR IGNORE INTO settings (key,value) VALUES
('whatsapp','+380 676235211'),
('telegram','@Shop_nix'),
('banner_text','Your next favourite find starts here.'),
('store_name','Shopnix');
