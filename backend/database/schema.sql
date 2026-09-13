-- =====================================================================
-- Abdi Online Order System - PostgreSQL Schema Migration
-- Database: Neon PostgreSQL
-- =====================================================================

-- 1. EXTENSIONS
-- Enable pgcrypto extension for gen_random_uuid() if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. REUSABLE TRIGGER FUNCTION FOR updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. ADMINS TABLE
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_admins_updated_at ON admins;
CREATE TRIGGER update_admins_updated_at
    BEFORE UPDATE ON admins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en VARCHAR(255) NOT NULL,
    name_am VARCHAR(255) NOT NULL,
    description_en TEXT,
    description_am TEXT,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_products_is_available ON products(is_available);

-- 4b. PRODUCT_MEDIA TABLE (Multiple images and videos per product)
CREATE TABLE IF NOT EXISTS product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
    mime_type VARCHAR(100) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    file_data BYTEA NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_media_product_id ON product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_sort_order ON product_media(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_media_is_primary ON product_media(product_id, is_primary);

-- 5. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customers_phone_unique UNIQUE (phone)
);

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sequence for human-friendly, concurrency-safe order numbers (e.g. ORD-YYYYMMDD-0001)
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1;

-- 6. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'payment_review', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled', 'rejected')
    ),
    customer_note TEXT,
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- 7. ORDER_ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- 8. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method VARCHAR(30) NOT NULL CHECK (method IN ('telebirr', 'cash')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    payment_proof_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'verified', 'rejected')
    ),
    admin_note TEXT,
    customer_message TEXT,
    verified_by UUID REFERENCES admins(id),
    verified_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES admins(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 8b. PAYMENT_PROOF_FILES TABLE (Persistent Object Storage for Telebirr Proofs)
CREATE TABLE IF NOT EXISTS payment_proof_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_proof_files_order_id ON payment_proof_files(order_id);

-- 9. ADMIN_SETTINGS TABLE
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    updated_by UUID REFERENCES admins(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_admin_settings_updated_at ON admin_settings;
CREATE TRIGGER update_admin_settings_updated_at
    BEFORE UPDATE ON admin_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- 10. INITIAL PRODUCT SEEDING
-- =====================================================================

INSERT INTO products (name_en, name_am, description_en, description_am, price, image_url, is_available)
SELECT 
    'Original Yemeni Honey',
    'ኦርጅናል የየመን ማር',
    'Pure traditional honey imported from Yemen, known for its rich natural flavor and quality. Carefully packaged for convenient individual use, it is a delicious addition to everyday meals and drinks and can also make a thoughtful gift for family and friends.',
    'ከየመን የመጣ፣ በጥራት እና በተፈጥሯዊ ጣዕሙ የሚታወቅ ኦርጅናል ባህላዊ ማር። ለግል አጠቃቀም በሚመች መልኩ በጥንቃቄ የታሸገ ሲሆን፣ ለዕለታዊ ምግቦች እና መጠጦች ልዩ ጣዕም ይሰጣል። እንዲሁም ለቤተሰብ እና ለወዳጅ ዘመድ እንደ ልዩ ስጦታ ለማበርከት እጅግ ተመራጭ ነው።',
    3000.00,
    NULL,
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE name_en = 'Original Yemeni Honey'
);

INSERT INTO products (name_en, name_am, description_en, description_am, price, image_url, is_available)
SELECT 
    'Original Women''s Period Cramp Relief',
    'ኦርጅናል የሴቶች ፔሬድ ህመም መቀነሺያ',
    'A wearable electric heating pad designed to provide soothing warmth during menstrual periods. Adjustable heat helps relax the abdominal area and can provide temporary relief from period cramps. The flexible strap provides a snug and comfortable fit around the waist or lower back, allowing you to use it while sitting, resting, or moving around.',
    'በወር አበባ ወቅት የሚከሰተውን የሆድ ቁርጠት እና ህመም ለማስታገስ የሚረዳ ዘመናዊ የኤሌክትሪክ ማሞቂያ ፔድ። የሚስተካከል የሙቀት መጠን ያለው በመሆኑ የሆድ እና የወገብ አካባቢን በማሞቅ ጊዜያዊ እፎይታ ይሰጣል። አመቺ የሆነው ተጣጣፊ ማሰሪያው በወገብ ዙሪያ በሚገባ እንዲስማማ ስለሚያደርግ ተቀምጠው፣ አርፈው ወይም እየተንቀሳቀሱ ለመጠቀም ምቹ ነው።',
    2500.00,
    NULL,
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE name_en = 'Original Women''s Period Cramp Relief'
);

INSERT INTO products (name_en, name_am, description_en, description_am, price, image_url, is_available)
SELECT 
    'WiFi Router Power Boost Cable',
    'የዋይፋይ ራውተር ፓወር ቡስት ኬብል',
    'Keep your WiFi connected even when the electricity goes out. This WiFi Router Power Boost Cable allows you to power a compatible WiFi router or modem directly from a power bank, providing a convenient backup power solution during power outages. It converts power from a USB power bank to the required DC output for compatible routers, helping you stay connected without needing electricity from the wall. Compact, practical, and easy to use — simply connect the USB end to your power bank and the DC connector to your compatible router. Perfect for homes, offices, and businesses that need reliable internet during power cuts.',
    'የመብራት መቆራረጥ በሚያጋጥምበት ወቅት የዋይፋይ ኢንተርኔት ግንኙነትዎ ሳይቋረጥ እንዲቀጥል የሚያስችል ኬብል። ይህ የዋይፋይ ራውተር ፓወር ቡስት ኬብል ተስማሚ የሆነውን ዋይፋይ ራውተር ወይም ሞደም በቀጥታ ከፓወር ባንክ ጋር በማገናኘት የሃይል ምንጭ እንዲያገኝ ያደርጋል። ከዩኤስቢ (USB) ፓወር ባንክ የሚገኘውን ሃይል ለራውተሩ ወደሚያስፈልገው የዲሲ (DC) ሃይል በመቀየር ያለ ግድግዳ ኤሌክትሪክ ኢንተርኔት እንዲጠቀሙ ይረዳል። መጠነ-ትንሽ፣ ቀላል እና ለመጠቀም አመቺ ሲሆን የዩኤስቢውን ጫፍ ከፓወር ባንክ፣ የዲሲውን ጫፍ ደግሞ ከተስማሚው ራውተር ጋር ማገናኘት ብቻ በቂ ነው። ለመኖሪያ ቤት፣ ለቢሮ እና አስተማማኝ ኢንተርኔት ለሚያስፈልጋቸው ተቋማት ተመራጭ መፍትሄ ነው።',
    1300.00,
    NULL,
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE name_en IN ('WiFi Router Power Boost Cable', 'Original iPhone Cable Charger')
);

INSERT INTO products (name_en, name_am, description_en, description_am, price, image_url, is_available)
SELECT 
    'F-max TD-301 30,000mAh Power Bank',
    'F-max TD-301 30,000mAh ፓወር ባንክ',
    'F-max TD-301 30,000mAh Power Bank — A high-capacity portable power bank designed to keep your devices charged while you''re away from a wall outlet. It features a 30,000mAh rated capacity and up to 22.5W output, with built-in iOS, Type-C, and Micro-USB cables for convenient charging of compatible devices. Its compact design makes it suitable for everyday use, travel, work, and emergencies.',
    'F-max TD-301 30,000mAh ፓወር ባንክ — ከኤሌክትሪክ ግድግዳ ርቀው በሚሆኑበት ወቅት ስልኮችን እና ሌሎች መሳሪያዎችን ቻርጅ ለማድረግ የተዘጋጀ ከፍተኛ አቅም ያለው ተንቀሳቃሽ ፓወር ባንክ። 30,000mAh የመያዝ አቅም እና እስከ 22.5W የሃይል ማመንጨት (output) አለው፤ እንዲሁም አብረው የተገጠሙ የአይኦኤስ (iOS)፣ ታይፕ-ሲ (Type-C) እና ማይክሮ-ዩኤስቢ (Micro-USB) ኬብሎች ስላሉት ተስማሚ መሳሪያዎችን በቀላሉ ቻርጅ ያደርጋል። መጠነ-አነስተኛ ቅርጹ ለዕለታዊ አጠቃቀም፣ ለጉዞ፣ ለስራ እና ለአስቸኳይ ጊዜ እጅግ ተስማሚ ያደርገዋል።',
    4500.00,
    NULL,
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE name_en = 'F-max TD-301 30,000mAh Power Bank'
);

-- =====================================================================
-- 11. ADMIN SETTINGS SEED (TELEBIRR PAYMENT CONFIGURATION)
-- =====================================================================

INSERT INTO admin_settings (setting_key, setting_value)
VALUES 
    ('telebirr_account_number', NULL),
    ('telebirr_account_name', NULL)
ON CONFLICT (setting_key) DO NOTHING;

