const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const updates = [
  {
    id: 'e194312a-20ba-4524-a54d-2b8462a34610',
    name_en: "Original Women's Period Cramp Relief",
    name_am: 'ኦርጅናል የሴቶች ፔሬድ ህመም መቀነሺያ',
    description_am: 'በወር አበባ ወቅት የሚከሰተውን የሆድ ቁርጠት እና ህመም ለማስታገስ የሚረዳ ዘመናዊ የኤሌክትሪክ ማሞቂያ ፔድ። የሚስተካከል የሙቀት መጠን ያለው በመሆኑ የሆድ እና የወገብ አካባቢን በማሞቅ ጊዜያዊ እፎይታ ይሰጣል። አመቺ የሆነው ተጣጣፊ ማሰሪያው በወገብ ዙሪያ በሚገባ እንዲስማማ ስለሚያደርግ ተቀምጠው፣ አርፈው ወይም እየተንቀሳቀሱ ለመጠቀም ምቹ ነው።'
  },
  {
    id: 'c16dfe9a-8a74-42b4-8ac3-b42546e50d1a',
    name_en: 'WiFi Router Power Boost Cable',
    name_am: 'የዋይፋይ ራውተር ፓወር ቡስት ኬብል',
    description_am: 'የመብራት መቆራረጥ በሚያጋጥምበት ወቅት የዋይፋይ ኢንተርኔት ግንኙነትዎ ሳይቋረጥ እንዲቀጥል የሚያስችል ኬብል። ይህ የዋይፋይ ራውተር ፓወር ቡስት ኬብል ተስማሚ የሆነውን ዋይፋይ ራውተር ወይም ሞደም በቀጥታ ከፓወር ባንክ ጋር በማገናኘት የሃይል ምንጭ እንዲያገኝ ያደርጋል። ከዩኤስቢ (USB) ፓወር ባንክ የሚገኘውን ሃይል ለራውተሩ ወደሚያስፈልገው የዲሲ (DC) ሃይል በመቀየር ያለ ግድግዳ ኤሌክትሪክ ኢንተርኔት እንዲጠቀሙ ይረዳል። መጠነ-ትንሽ፣ ቀላል እና ለመጠቀም አመቺ ሲሆን የዩኤስቢውን ጫፍ ከፓወር ባንክ፣ የዲሲውን ጫፍ ደግሞ ከተስማሚው ራውተር ጋር ማገናኘት ብቻ በቂ ነው። ለመኖሪያ ቤት፣ ለቢሮ እና አስተማማኝ ኢንተርኔት ለሚያስፈልጋቸው ተቋማት ተመራጭ መፍትሄ ነው።'
  },
  {
    id: 'f489cf4b-3510-4941-8529-c9da85015e6a',
    name_en: 'Original Yemeni Honey',
    name_am: 'ኦርጅናል የየመን ማር',
    description_am: 'ከየመን የመጣ፣ በጥራት እና በተፈጥሯዊ ጣዕሙ የሚታወቅ ኦርጅናል ባህላዊ ማር። ለግል አጠቃቀም በሚመች መልኩ በጥንቃቄ የታሸገ ሲሆን፣ ለዕለታዊ ምግቦች እና መጠጦች ልዩ ጣዕም ይሰጣል። እንዲሁም ለቤተሰብ እና ለወዳጅ ዘመድ እንደ ልዩ ስጦታ ለማበርከት እጅግ ተመራጭ ነው።'
  },
  {
    id: '3b391910-2906-4f1e-a372-ef1fca47c186',
    name_en: 'F-max TD-301 30,000mAh Power Bank',
    name_am: 'F-max TD-301 30,000mAh ፓወር ባንክ',
    description_am: 'F-max TD-301 30,000mAh ፓወር ባንክ — ከኤሌክትሪክ ግድግዳ ርቀው በሚሆኑበት ወቅት ስልኮችን እና ሌሎች መሳሪያዎችን ቻርጅ ለማድረግ የተዘጋጀ ከፍተኛ አቅም ያለው ተንቀሳቃሽ ፓወር ባንክ። 30,000mAh የመያዝ አቅም እና እስከ 22.5W የሃይል ማመንጨት (output) አለው፤ እንዲሁም አብረው የተገጠሙ የአይኦኤስ (iOS)፣ ታይፕ-ሲ (Type-C) እና ማይክሮ-ዩኤስቢ (Micro-USB) ኬብሎች ስላሉት ተስማሚ መሳሪያዎችን በቀላሉ ቻርጅ ያደርጋል። መጠነ-አነስተኛ ቅርጹ ለዕለታዊ አጠቃቀም፣ ለጉዞ፣ ለስራ እና ለአስቸኳይ ጊዜ እጅግ ተስማሚ ያደርገዋል።'
  }
];

async function main() {
  console.log('=== POPULATING AMHARIC PRODUCT DESCRIPTIONS IN POSTGRESQL ===\n');

  const client = await pool.connect();

  try {
    // 1. Inspect existing records before update
    console.log('[Step 1] Inspecting existing records...');
    const countBeforeRes = await client.query('SELECT COUNT(*)::int AS count FROM products');
    const countBefore = countBeforeRes.rows[0].count;
    console.log(`Total products in DB before update: ${countBefore}`);
    if (countBefore !== 4) {
      throw new Error(`Expected exactly 4 products, found ${countBefore}`);
    }

    const beforeRows = [];
    for (const item of updates) {
      const res = await client.query('SELECT * FROM products WHERE id = $1', [item.id]);
      if (res.rows.length === 0) {
        throw new Error(`Product not found by ID: ${item.id} (${item.name_en})`);
      }
      const p = res.rows[0];
      beforeRows.push(p);
      console.log(`- Found: "${p.name_en}" (ID: ${p.id})`);
      console.log(`  description_en: "${p.description_en.substring(0, 60)}..."`);
      console.log(`  description_am: ${p.description_am}`);
    }

    // 2. Perform updates inside transaction
    console.log('\n[Step 2] Updating description_am in transaction...');
    await client.query('BEGIN');

    for (const item of updates) {
      const updateQuery = `
        UPDATE products
        SET description_am = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, name_en, name_am, description_en, description_am, price, is_available;
      `;
      const updateRes = await client.query(updateQuery, [item.description_am, item.id]);
      const updatedRow = updateRes.rows[0];
      console.log(`✓ Updated "${updatedRow.name_en}"`);
      console.log(`  description_am: "${updatedRow.description_am.substring(0, 50)}..."`);
    }

    await client.query('COMMIT');
    console.log('\nTransaction committed successfully.');

    // 3. Post-update verification
    console.log('\n[Step 3] Verifying all assertions...');
    const countAfterRes = await client.query('SELECT COUNT(*)::int AS count FROM products');
    const countAfter = countAfterRes.rows[0].count;

    console.log(`\nProduct count after update: ${countAfter}`);
    if (countAfter !== 4) {
      throw new Error(`Product count changed! Expected 4, got ${countAfter}`);
    }

    for (let i = 0; i < updates.length; i++) {
      const item = updates[i];
      const before = beforeRows[i];
      const afterRes = await client.query('SELECT * FROM products WHERE id = $1', [item.id]);
      const after = afterRes.rows[0];

      console.log(`\nVerifying "${after.name_en}":`);
      // Assertions
      const checks = [
        { pass: after.id === before.id, msg: 'ID matches' },
        { pass: after.name_en === before.name_en, msg: 'name_en unchanged' },
        { pass: after.name_am === before.name_am, msg: 'name_am unchanged' },
        { pass: after.description_en === before.description_en, msg: 'description_en unchanged' },
        { pass: after.price === before.price, msg: 'price unchanged' },
        { pass: after.is_available === before.is_available, msg: 'is_available unchanged' },
        { pass: after.image_url === before.image_url, msg: 'image_url unchanged' },
        { pass: after.description_am !== null, msg: 'description_am is NOT NULL' },
        { pass: after.description_am === item.description_am, msg: 'description_am matches expected text' }
      ];

      for (const check of checks) {
        if (!check.pass) {
          throw new Error(`Assertion failed for ${after.name_en}: ${check.msg}`);
        }
        console.log(`  [PASS] ${check.msg}`);
      }
    }

    console.log('\n=== ALL 4 PRODUCTS SUCCESSFULLY UPDATED AND VERIFIED ===');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during update:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
