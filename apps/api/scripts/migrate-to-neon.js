require('dotenv').config({
  path: require('node:path').resolve(__dirname, '../.env')
});

const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing from apps/api/.env');
  }

  const sqlite = new DatabaseSync(
    require('node:path').resolve(__dirname, '../data/arthurs-mall.db'),
    { readOnly: true }
  );

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
  });

  const client = await pool.connect();

  try {
    const products = sqlite.prepare(
      'SELECT * FROM products ORDER BY id'
    ).all();

    const orders = sqlite.prepare(
      'SELECT * FROM orders ORDER BY id'
    ).all();

    console.log(`SQLite source: ${products.length} products, ${orders.length} orders`);

    await client.query('BEGIN');

    for (const p of products) {
      await client.query(`
        INSERT INTO products
          (id, name, brand, model, description, specifications,
           price, category, image_url, stock, active, created_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO NOTHING
      `, [
        p.id, p.name, p.brand, p.model, p.description,
        p.specifications, p.price, p.category, p.image_url,
        p.stock, p.active, p.created_at
      ]);
    }

    for (const o of orders) {
      await client.query(`
        INSERT INTO orders
          (id, customer_name, customer_phone, delivery_address,
           product_id, quantity, unit_price, total_price,
           payment_method, status, created_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO NOTHING
      `, [
        o.id, o.customer_name, o.customer_phone, o.delivery_address,
        o.product_id, o.quantity, o.unit_price, o.total_price,
        o.payment_method, o.status, o.created_at
      ]);
    }

    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('public.products', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM products), 1), 1),
        EXISTS (SELECT 1 FROM products)
      )
    `);

    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('public.orders', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM orders), 1), 1),
        EXISTS (SELECT 1 FROM orders)
      )
    `);

    const productCount = await client.query(
      'SELECT COUNT(*)::int AS count FROM products'
    );
    const orderCount = await client.query(
      'SELECT COUNT(*)::int AS count FROM orders'
    );

    await client.query('COMMIT');

    console.log('Migration transaction committed.');
    console.log('Neon products:', productCount.rows[0].count);
    console.log('Neon orders:', orderCount.rows[0].count);
    console.log('Migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    sqlite.close();
    await pool.end();
  }
}

main().catch(error => {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
});
