// PGlite runner (no hosted DB). Usage: npm i --no-save @electric-sql/pglite && node tests/sql/run-manual-approval-pglite.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const r=new URL('../../', import.meta.url).pathname;
const db=new PGlite();
const files=['tests/sql/atomic-order-schema.sql','supabase/migrations/20260610_tighten_orders_rls_tracking_rpc.sql','supabase/migrations/20260901_fix_guest_order_items_rls.sql','supabase/migrations/20261008_atomic_order_submission.sql','supabase/migrations/20261013_order_manual_approval_guard.sql','tests/sql/manual-approval-states.sql'];
for(const f of files){ const s=fs.readFileSync(r+f,'utf8').replace(/^\\set.*$/mg,''); try{ const res=await db.exec(s); const last=res.at(-1)?.rows?.[0]; console.log('OK',f,last?JSON.stringify(last):''); }catch(e){ console.log('FAIL',f,e.message); process.exit(1);} }
