# 🧠 Abdi Online Shopping — Admin AI Copilot
## Comprehensive Capabilities & Question Guide for Store Administrators

---

### 🌟 Executive Overview

The **Admin AI Copilot** is an intelligent assistant built directly into the Abdi Online Shopping Store Management Portal. It acts as a 24/7 store operations manager that provides instant answers, financial breakdowns, fulfillment tracking, customer lookups, inventory alerts, and step-by-step guidance.

#### Key Superpowers:
* ⚡ **Zero-Refresh Live Sync**: Always queries live PostgreSQL data. As soon as a customer places an order or makes a payment, the AI reflects it immediately with no browser reload needed.
* 🔤 **Smart Typo Tolerance**: Handles spelling errors seamlessly (e.g., *"canclled"*, *"incom"*, *"prodct"*, *"telebir"*, *"buanbua"*).
* 🗣️ **Flexible Natural Language**: Understands questions phrased in multiple ways (e.g., *"today income ?"* vs. *"how much did make income today"* vs. *"daily sales"*).
* 🇪🇹 **Full Bilingual Support (English & Amharic)**: Ask questions in English or Amharic (ጽሁፍ ወይም በድምጽ) and receive native responses.
* 🎯 **1-Click Action Buttons**: Every response includes clickable buttons to jump straight to the relevant filtered order table, payment review screen, or product editor.

---

## 📑 Complete Question Categories & Examples

---

### 1. 💰 Today's Revenue & Daily Income
Provides a real-time financial snapshot of all business conducted today.

* **Sample English Questions**:
  * `"today income ?"`
  * `"how much did make income today"`
  * `"how much did we make today"`
  * `"today sales"`
  * `"daily revenue"`
  * `"how much we made"`
  * `"daily income"`
* **Sample Amharic Questions (አማርኛ)**:
  * `"የዛሬ ገቢ ስንት ነው?"`
  * `"የዛሬ ሽያጭ"`
  * `"ዛሬ ስንት አገኘን"`
  * `"የዛሬ ብር"`
* **What the AI Returns**:
  * Today's gross sales in ETB.
  * Number of orders placed today.
  * Breakdown: awaiting payment verification vs. confirmed vs. out for delivery vs. delivered.
  * All-time cumulative store revenue.
  * **Quick Actions**: `View Today's Orders`, `All Orders`, `View Payments`.

---

### 2. 📈 All-Time Financials & Store Revenue
Provides cumulative lifetime earnings, confirmed sales, and pipeline metrics.

* **Sample English Questions**:
  * `"total revenue"`
  * `"gross sales"`
  * `"overall revenue"`
  * `"how much total money did we make"`
  * `"store financial metrics"`
* **Sample Amharic Questions (አማርኛ)**:
  * `"ጠቅላላ ገቢ ስንት ነው?"`
  * `"አጠቃላይ ሽያጭ"`
  * `"እስካሁን ስንት ብር ተሸጠ?"`
* **What the AI Returns**:
  * Confirmed and completed sales total in ETB.
  * Gross order pipeline (including pending payments).
  * Lifetime orders count and delivered packages.
  * **Quick Actions**: `Open Orders Table`.

---

### 3. 📋 Today's Orders Status
Instantly checks whether new orders arrived today and their statuses.

* **Sample English Questions**:
  * `"today orders"`
  * `"what are today's orders"`
  * `"orders today"`
  * `"how many orders today"`
  * `"who ordered today"`
* **Sample Amharic Questions (አማርኛ)**:
  * `"የዛሬ ትዕዛዞች ምን ምን ናቸው?"`
  * `"ዛሬ ምን ያህል ታዘዘ?"`
  * `"የዛሬ ደንበኞች"`
* **What the AI Returns**:
  * Count of today's orders and total monetary value.
  * List of today's customer names, delivery addresses, amounts, and statuses.
  * Stated clearly if no new orders arrived yet today.
  * **Quick Actions**: `Filter Today's Orders`.

---

### 4. 🔍 Status-Specific Order Inquiries (With Typo Tolerance)
The admin can filter and view orders by their exact lifecycle stage. The AI handles natural typos automatically.

#### A. Cancelled Orders
* **Sample Questions**:
  * `"canclled orders"` *(typo tolerant)*
  * `"cancelled orders"` / `"canceled order"`
  * `"show cancelled orders"`
  * `"የተሰረዙ ትዕዛዞች"` / `"የተሰረዘ ትዕዛዝ"`
* **What the AI Returns**: List of all cancelled orders with Order #, customer name, phone, item breakdown, and amount in ETB (or confirms 0 cancelled orders).
* **Quick Actions**: `Filter Cancelled Orders`.

#### B. Delivered & Completed Orders
* **Sample Questions**:
  * `"delivered order"` / `"delivred orders"` *(typo tolerant)*
  * `"completed orders"`
  * `"orders delivered"`
  * `"የደረሱ ትዕዛዞች"` / `"የደረሰ ትዕዛዝ"`
* **What the AI Returns**: List of all successfully delivered customer orders or confirms zero delivered packages yet.
* **Quick Actions**: `Filter Delivered Orders`.

#### C. Out for Delivery / In Transit
* **Sample Questions**:
  * `"out of delivery order"`
  * `"out for delivery"`
  * `"in delivery"` / `"in transit"`
  * `"orders on the way"`
  * `"በማድረስ ላይ ያሉ ትዕዛዞች"` / `"በመጓጓዝ ላይ ያሉ"`
* **What the AI Returns**: Packages currently dispatched with delivery riders across Dessie and local villages.
* **Quick Actions**: `Filter In-Delivery`.

#### D. Confirmed Orders (Ready for Packaging)
* **Sample Questions**:
  * `"confirmed order"` / `"confimed orders"` *(typo tolerant)*
  * `"ready for packing"`
  * `"approved orders"`
  * `"የተረጋገጡ ትዕዛዞች"` / `"የተረጋገጠ ትዕዛዝ"`
* **What the AI Returns**: Orders where customer payment is approved and packages need to be assembled and dispatched.
* **Quick Actions**: `Filter Confirmed`.

#### E. Fulfillment Pipeline Overview
* **Sample Questions**:
  * `"order pipeline"`
  * `"fulfillment status"`
  * `"order status summary"`
  * `"unfulfilled orders"`
  * `"የትዕዛዝ ሂደት"`
* **What the AI Returns**: High-level stage-by-stage count of orders across Pending, Confirmed, Out for Delivery, Delivered, and Cancelled.

---

### 5. 📋 Recent Orders Breakdown & General History
Shows recent order activity across the entire store.

* **Sample English Questions**:
  * `"recent orders ?"`
  * `"latest orders"`
  * `"show orders"`
  * `"orders list"`
  * `"what are the orders"`
  * `"order history"`
* **Sample Amharic Questions (አማርኛ)**:
  * `"የቅርብ ጊዜ ትዕዛዞች ዝርዝር"`
  * `"ትዕዛዞች"`
  * `"የትዕዛዝ ዝርዝር አሳየኝ"`
* **What the AI Returns**:
  * Summary of the last 6 customer orders.
  * Order Number, Customer Name, Phone, Items, Date, Amount in ETB, and Status badge.
  * **Quick Actions**: `Open Orders Table`, `Today's Orders`.

---

### 6. ⚠️ Pending Telebirr Payments & Verifications
Identifies payments submitted by customers that require admin review.

* **Sample English Questions**:
  * `"pending payments"`
  * `"any payments to verify?"`
  * `"telebirr screenshots"`
  * `"unverified payments"`
  * `"payment review"`
  * `"who paid with telebirr"`
* **Sample Amharic Questions (አማርኛ)**:
  * `"ማረጋገጫ የሚጠብቁ ክፍያዎች"`
  * `"ያልተረጋገጠ ክፍያ አለ?"`
  * `"ቴሌብር ማረጋገጫ"`
  * `"የቴሌብር ስክሪንሾቶች"`
* **What the AI Returns**:
  * Number of pending payment proofs.
  * Order Number, Customer Name, Phone, Amount in ETB, and Payment Method (Telebirr).
  * Direct reminder to inspect the transaction screenshot.
  * **Quick Actions**: `Review Pending Payments`.

---

### 7. 👤 Customer & Entity Lookups (Smart Search)
Instantly looks up a specific customer or order by Name, Phone Number, or Order Number.

* **Sample English Questions**:
  * `"tell me about user mebratu melaku"`
  * `"who is mebratu"`
  * `"customer 0998766765"`
  * `"tell me about order ORD-20260908-0148"`
  * `"who placed order ORD-20260908-0148"`
* **Sample Amharic Questions (አማርኛ)**:
  * `"ስለ ደንበኛ መብራቱ መልአኩ ንገረኝ"`
  * `"መብራቱ መልአኩ ምን አዘዘ?"`
  * `"ትዕዛዝ ORD-20260908-0148 ማን አዘዘ?"`
* **What the AI Returns**:
  * Customer Name, Phone Number, and Delivery Address.
  * Complete Order History with Order Number, Date, Purchased Items, Total ETB, and Fulfillment Status.
  * **Quick Actions**: Direct button to view that specific order in the management table.

---

### 8. 📦 Stock & Inventory Health Alerts
Monitors catalog availability and alerts when items run out of stock.

* **Sample English Questions**:
  * `"what is out of stock?"`
  * `"which products are finished?"`
  * `"low stock alerts"`
  * `"inventory status"`
  * `"restock alerts"`
  * `"unavailable products"`
* **Sample Amharic Questions (አማርኛ)**:
  * `"ያለቀ እቃ አለ?"`
  * `"ክምችት ያለቀባቸው እቃዎች"`
  * `"የክምችት ሁኔታ"`
* **What the AI Returns**:
  * Total catalog count and count of out-of-stock items.
  * Exact list of out-of-stock products with their retail price.
  * Restocking advice and immediate status-update guidance.
  * **Quick Actions**: `Go to Products / Restock`.

---

### 9. 🏷️ Product Catalog & Price Inquiries
Quickly checks prices, descriptions, and catalog availability.

* **Sample English Questions**:
  * `"price of yemeni honey"`
  * `"how much is the power bank"`
  * `"what is the price of cramp relief belt"`
  * `"router cable price"`
  * `"show all products and prices"`
* **Sample Amharic Questions (አማርኛ)**:
  * `"የየመን ማር ዋጋ ስንት ነው?"`
  * `"የፓወር ባንኩ ዋጋ"`
  * `"የዋይፋይ ኬብል ስንት ነው?"`
  * `"የእቃዎች ዝርዝር እና ዋጋ"`
* **What the AI Returns**:
  * Official retail price in ETB.
  * Stock status (`In Stock` vs `Out of Stock`).
  * Product highlights and description.
  * **Quick Actions**: `Manage Products`.

---

### 10. 🏆 Best Sellers & Product Leaderboard
Analyzes sales performance to identify top-performing items.

* **Sample English Questions**:
  * `"which item sells most?"`
  * `"top product"`
  * `"best seller"`
  * `"top selling product"`
  * `"most sold item"`
  * `"popular products"`
* **Sample Amharic Questions (አማርኛ)**:
  * `"በብዛት የተሸጠው እቃ የትኛው ነው?"`
  * `"ተወዳጅ እቃዎች"`
  * `"አንደኛ እቃ"`
* **What the AI Returns**:
  * Ranked list of best-selling items.
  * Units sold, number of orders, and revenue generated per product.
  * **Quick Actions**: `Manage Products`.

---

### 11. 🚚 Hyper-Local Village & Delivery Logistics
Breaks down orders by specific neighborhoods and villages across Dessie.

* **Sample English Questions**:
  * `"orders from buanbuha"` *(or typo "buanbua", "buabuha")*
  * `"orders from robit"`
  * `"piassa orders"`
  * `"orders in dessie"`
  * `"village delivery breakdown"`
* **Sample Amharic Questions (አማርኛ)**:
  * `"ከቦአንቧ ውሃ የታዘዙ ትዕዛዞች"`
  * `"ከሮቢት ምን ታዘዘ?"`
  * `"ደሴ ውስጥ የት ታዘዘ?"`
* **What the AI Returns**:
  * Customer orders filtered by specified delivery village/neighborhood.
  * Customer names, phone numbers, and package status.
  * **Quick Actions**: `Open Orders Table`.

---

### 12. 🛠️ Store Management & How-To Guides
Provides step-by-step operational instructions for store tasks without needing manual documentation.

#### A. How to Edit a Product (Price, Photo, Description, Stock)
* **Questions**: `"how to edit product"`, `"how do i change product price"`, `"how to change photo"`, `"እቃ እንዴት ማስተካከል ይቻላል?"`
* **AI Instructions**: Explains navigating to `/admin/products`, clicking the **Edit (✏️)** button, updating price/photo/details, and saving changes.

#### B. How to Delete a Product
* **Questions**: `"how to delete product"`, `"how to remove item"`, `"እቃ እንዴት መሰረዝ ይቻላል?"`
* **AI Instructions**: Explains clicking the **Delete (🗑️)** button, confirming the security prompt, and noting safeguards for products with order history.

#### C. How to Add a New Product
* **Questions**: `"how to add new product"`, `"how do i create a product"`, `"አዲስ እቃ እንዴት መጨመር ይቻላል?"`
* **AI Instructions**: Details clicking `+ Add Product`, filling English and Amharic titles/descriptions, setting prices, uploading photos, and setting stock availability.

#### D. How to Verify Telebirr Payments
* **Questions**: `"how to verify telebirr payments"`, `"how to approve payment"`, `"የቴሌብር ክፍያ እንዴት ማረጋገጥ ይቻላል?"`
* **AI Instructions**: Outlines opening `/admin/payments`, comparing customer screenshot and transaction ID with merchant SMS, and clicking **Verify Payment** or **Reject**.

#### E. How to Manage and Advance Orders
* **Questions**: `"how to manage orders"`, `"how to confirm order"`, `"how to deliver order"`, `"ትዕዛዞችን እንዴት ማስተዳደር ይቻላል?"`
* **AI Instructions**: Step-by-step guidance on advancing orders from `Pending` $\to$ `Confirmed` $\to$ `Out for Delivery` $\to$ `Delivered`.

#### F. How to Change Admin Password & Login Email
* **Questions**: `"how to change password"`, `"how do i change email"`, `"how to chnage passwored"`, `"change login credentials"`, `"የይለፍ ቃል እንዴት መቀየር እችላለሁ?"`, `"ኢሜል መቀየር"`
* **AI Instructions**: Clear step-by-step guidance:
  1. Click **Account & Security** in the sidebar (or top header bar next to Logout).
  2. Enter your **Current Admin Password** to confirm your identity.
  3. Enter your **New Admin Email Address** (leave unchanged if keeping the same email).
  4. Enter your **New Password** and confirm it (use the eye icon 👁️ to double check typing).
  5. Click **Save Changes** — the new password is encrypted with 12-round bcrypt hash in the database, ensuring 100% privacy (nobody else, not even developers, can see your password).

---

## 📊 Summary Reference Card for Clients

| Category | Typical Admin Question (English) | Typical Admin Question (Amharic) | AI Action Provided |
| :--- | :--- | :--- | :--- |
| **Today's Revenue** | *"today income ?"*, *"how much did make income today"* | *"የዛሬ ገቢ ስንት ነው?"* | Live ETB amount, order counts, link to Today's Orders |
| **All-Time Revenue** | *"total revenue"*, *"gross sales"* | *"አጠቃላይ ሽያጭ"* | Gross & confirmed lifetime earnings |
| **Today's Orders** | *"today orders"*, *"who ordered today"* | *"የዛሬ ትዕዛዞች"* | List of today's customer orders & values |
| **Status Orders** | *"canclled orders"*, *"delivered order"*, *"confirmed order"* | *"የተሰረዙ ትዕዛዞች"*, *"የደረሱ ትዕዛዞች"* | Filtered order cards with 1-click status filters |
| **Telebirr Payments**| *"any payments to verify?"*, *"pending payments"* | *"ቴሌብር ማረጋገጫ"*, *"ያልተረጋገጠ ክፍያ"* | Proof list & direct button to review screenshots |
| **Customer Lookup** | *"tell me about user mebratu melaku"*, *"customer 0998766765"*| *"ስለ ደንበኛ መብራቱ መልአኩ"* | Customer purchase history & direct order link |
| **Stock Alerts** | *"what is out of stock?"*, *"inventory alerts"* | *"ያለቀ እቃ አለ?"* | Out-of-stock list & restock navigation button |
| **Price Inquiries** | *"price of yemen honey"*, *"power bank price"* | *"የማር ዋጋ ስንት ነው?"* | Exact ETB prices & product specs |
| **Best Sellers** | *"which item sells most?"*, *"top product"* | *"በብዛት የተሸጠው እቃ"* | Sales leaderboard ranked by units & revenue |
| **Village Logistics**| *"orders from buanbuha"*, *"robit orders"* | *"ከቦአንቧ ውሃ ምን ታዘዘ?"* | Local delivery orders grouped by neighborhood |
| **Store Guides** | *"how to edit product"*, *"how to verify telebirr"* | *"እቃ እንዴት ማስተካከል ይቻላል?"* | Clear, numbered operational steps |
| **Admin Security** | *"how to change password"*, *"update email"* | *"የይለፍ ቃል እንዴት መቀየር እችላለሁ?"* | 5-step credential update guide & privacy reassurance |

---

### 💡 Tips for Store Admins:
1. **Voice Dictation**: On mobile or Chrome browsers, click the microphone button in the Admin AI chat to speak questions naturally in English or Amharic!
2. **Flexible Words**: You don't need exact commands. Type naturally as if speaking to a live assistant.
3. **Always Fresh**: No need to refresh the page — the AI automatically retrieves the latest database state on every message.
