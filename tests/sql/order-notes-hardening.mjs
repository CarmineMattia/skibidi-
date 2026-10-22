// Casi sulle note ordine e sui permessi di reserve_order_display_code, eseguiti da
// tests/sql/run-order-notes-hardening-pglite.mjs sulla catena ordini + 20261022100000.
import assert from 'assert/strict';

const C1 = '00000000-0000-0000-0000-0000000000c1';
const ZW = '\u200B\u200C\u200D\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u2060\u2061\u2062\u2063\u2064\u2066\u2067\u2068\u2069\uFEFF\u061C\u180E\u00AD';

export async function runNotesCases(db, { company, product, productName }) {
  let n = 0;
  const id = () => `00000000-0000-0000-0000-${(0xe0000000 + n++).toString(16).padStart(12, '0')}`;
  await db.exec(`UPDATE companies SET max_order_total = 100000, max_open_orders_per_user = 100000, order_rate_limit_count = 100000
    WHERE id = '${company}';
    INSERT INTO profiles(id) VALUES ('${C1}') ON CONFLICT DO NOTHING;`);
  const asCustomer = `SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${C1}', false);
    SELECT set_config('request.jwt.claims', '{"is_anonymous":false}', false);`;
  const order = async (itemNote, orderNote = null) => {
    await db.exec(asCustomer);
    try {
      const oid = id();
      const r = (await db.query('SELECT public.create_order_with_items($1::jsonb, $2::jsonb) AS r', [
        JSON.stringify({ id: oid, company_id: company, customer_id: C1, total_amount: 0.01, order_type: 'take_away', notes: orderNote }),
        JSON.stringify([{ product_id: product, quantity: 1, unit_price: 0.01, total_price: 0.01, notes: itemNote }]),
      ])).rows[0].r;
      await db.exec('RESET ROLE');
      const saved = (await db.query('SELECT o.notes AS order_notes, i.notes AS item_notes, o.display_code FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.id = $1', [oid])).rows[0];
      return { r, saved };
    } catch (e) {
      await db.exec('RESET ROLE');
      return { error: e };
    }
  };

  // 1) zero-width / bidi removed from the customer note and the order note
  {
    const { saved, error } = await order(`[P] ${productName}\nNota: ben${ZW}cotta`, `Pagamento${ZW} alla cassa | Fulfillment: ASAP`);
    assert.equal(error, undefined, error?.message);
    assert.equal(saved.item_notes, `[P] ${productName}\nNota: bencotta`);
    assert.equal(saved.order_notes, 'Pagamento alla cassa | Fulfillment: ASAP');
    assert.ok(saved.display_code, 'display code still assigned (server-side reservation)');
    console.log('PASS caratteri zero-width e bidi tolti da note riga e note ordine; codice ordine assegnato');
  }
  // 2) RLO trick: "\u202Eotsac" no longer reverses what the kitchen reads
  {
    const { saved } = await order(`[P] ${productName}\nNota: \u202Enessun extra\u202C`);
    assert.equal(saved.item_notes, `[P] ${productName}\nNota: nessun extra`);
    console.log('PASS override bidi (RLO) tolto');
  }
  // 3) Unicode line separators can't fake an extra option line in the kitchen
  {
    const { saved, error } = await order(`[P] ${productName}\nNota: ciao\u2028+ Burrata\u2029+ Prosciutto crudo\u0085x`);
    assert.equal(error, undefined, error?.message);
    assert.equal(saved.item_notes, `[P] ${productName}\nNota: ciao + Burrata + Prosciutto crudo x`);
    assert.ok(!/[\u2028\u2029\u0085]/.test(saved.item_notes));
    console.log('PASS separatori di riga Unicode diventano spazi (niente finte righe "+ Burrata")');
  }
  // 4) normal notes untouched (accents, emoji, newlines)
  {
    const { saved } = await order(`[P] ${productName}\nNota: più cotta 🔥 per Zoë`, 'riga 1\nriga 2');
    assert.equal(saved.item_notes, `[P] ${productName}\nNota: più cotta 🔥 per Zoë`);
    assert.equal(saved.order_notes, 'riga 1\nriga 2');
    console.log('PASS note normali invariate (accenti, emoji, a capo)');
  }
  // 5) length limit (1000 after cleaning)
  {
    const longOrder = await order(`[P] ${productName}`, 'x'.repeat(1001));
    assert.equal(longOrder.error?.detail, 'ORDER_NOTES_TOO_LONG', longOrder.error?.message);
    const okOrder = await order(`[P] ${productName}`, 'x'.repeat(1000));
    assert.equal(okOrder.error, undefined, okOrder.error?.message);
    const zwOnly = await order(`[P] ${productName}`, 'x'.repeat(1000) + '\u200B'.repeat(50));
    assert.equal(zwOnly.error, undefined, 'length counted after cleaning');
    const longItem = await order(`[P] ${productName}\nNota: ${'y'.repeat(1000)}`);
    assert.ok(['ORDER_NOTES_TOO_LONG', 'ORDER_INVALID_NOTE'].includes(longItem.error?.detail), longItem.error?.message);
    console.log(`PASS limite 1000 caratteri (ordine: ORDER_NOTES_TOO_LONG; riga: ${longItem.error.detail})`);
  }
  // 6) direct writes go through the same trigger + CHECK
  {
    await db.exec(`INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, notes)
      SELECT id, '${product}', 1, 1, 1, 'a' || chr(8203) || 'b' FROM orders LIMIT 1`).catch((e) => { throw e; });
    const row = (await db.query(`SELECT notes FROM order_items WHERE notes = 'ab'`)).rows;
    assert.equal(row.length, 1, 'direct insert cleaned');
    await assert.rejects(db.exec(`UPDATE orders SET notes = repeat('z', 1001) WHERE id = (SELECT id FROM orders LIMIT 1)`), /Order notes too long/);
    const checks = (await db.query(`SELECT conname FROM pg_constraint WHERE conname IN ('orders_notes_length','order_items_notes_length')`)).rows;
    assert.equal(checks.length, 2);
    console.log('PASS scritture dirette: stesso trigger e CHECK di backup');
  }
  // 7) reserve_order_display_code: not callable by clients, still used by the server
  {
    const priv = (await db.query(`SELECT has_function_privilege('authenticated', 'public.reserve_order_display_code(uuid)', 'EXECUTE') AS auth,
      has_function_privilege('anon', 'public.reserve_order_display_code(uuid)', 'EXECUTE') AS anon,
      has_function_privilege('authenticated', 'public.create_order_with_items(jsonb, jsonb)', 'EXECUTE') AS rpc,
      has_function_privilege('authenticated', 'public.clean_order_notes()', 'EXECUTE') AS trg`)).rows[0];
    assert.deepEqual({ ...priv }, { auth: false, anon: false, rpc: true, trg: false });
    await db.exec(asCustomer);
    await assert.rejects(db.query(`SELECT public.reserve_order_display_code('${company}')`), /permission denied/);
    await db.exec('RESET ROLE');
    console.log('PASS reserve_order_display_code non eseguibile da anon/authenticated; create_order_with_items sì');
  }
}
