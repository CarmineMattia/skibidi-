-- ============================================
-- SKIBIDI ORDERS - Fiscal Audit & Retry Queue Tables
-- Date: 2026-02-10
-- Purpose: Add fiscal audit logging and retry queue for Italian compliance
-- ============================================

-- ============================================
-- SECTION 1: Fiscal Audit Log Table
-- ============================================

CREATE TABLE IF NOT EXISTS fiscal_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'emit', 'void', 'retry', 'cancel'
    provider VARCHAR(50) NOT NULL, -- 'mock', 'acube', 'fatture-in-cloud', 'epson'
    external_id TEXT, -- Provider's receipt ID
    request_data JSONB, -- Sanitized request (no sensitive data)
    response_data JSONB, -- Provider response
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'error'
    error_message TEXT,
    error_code VARCHAR(100),
    attempt_count INTEGER NOT NULL DEFAULT 1,
    processing_time_ms INTEGER, -- Time taken for API call
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fiscal_audit_log
CREATE INDEX IF NOT EXISTS idx_fiscal_audit_order ON fiscal_audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_audit_status ON fiscal_audit_log(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_audit_created ON fiscal_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_fiscal_audit_provider ON fiscal_audit_log(provider);

-- ============================================
-- SECTION 2: Fiscal Retry Queue Table
-- ============================================

CREATE TABLE IF NOT EXISTS fiscal_retry_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'mock',
    priority INTEGER NOT NULL DEFAULT 0, -- Higher = more urgent (failed recently)
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT,
    last_error_code VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'manual'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fiscal_retry_queue
CREATE INDEX IF NOT EXISTS idx_fiscal_retry_status ON fiscal_retry_queue(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_retry_next_retry ON fiscal_retry_queue(next_retry_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_fiscal_retry_order ON fiscal_retry_queue(order_id);

-- ============================================
-- SECTION 3: Function to Log Fiscal Events
-- ============================================

CREATE OR REPLACE FUNCTION log_fiscal_event(
    p_order_id UUID,
    p_action VARCHAR,
    p_provider VARCHAR,
    p_external_id TEXT,
    p_request_data JSONB,
    p_response_data JSONB,
    p_status VARCHAR,
    p_error_message TEXT,
    p_error_code VARCHAR,
    p_processing_time_ms INTEGER
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO fiscal_audit_log (
        order_id, action, provider, external_id,
        request_data, response_data, status,
        error_message, error_code, processing_time_ms
    ) VALUES (
        p_order_id, p_action, p_provider, p_external_id,
        p_request_data, p_response_data, p_status,
        p_error_message, p_error_code, p_processing_time_ms
    ) RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ============================================
-- SECTION 4: Function to Add to Retry Queue
-- ============================================

CREATE OR REPLACE FUNCTION add_to_fiscal_retry_queue(
    p_order_id UUID,
    p_provider VARCHAR DEFAULT 'mock',
    p_error_message TEXT,
    p_error_code VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO fiscal_retry_queue (
        order_id, provider, priority, attempt_count,
        max_attempts, next_retry_at, last_error, last_error_code, status
    ) VALUES (
        p_order_id, p_provider, 0, 1,
        5, NOW() + INTERVAL '1 minute', p_error_message, p_error_code, 'pending'
    ) RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ============================================
-- SECTION 5: Function to Process Retry Queue
-- ============================================

CREATE OR REPLACE FUNCTION process_fiscal_retry_queue(
    p_batch_size INTEGER DEFAULT 10
) RETURNS INTEGER AS $$
DECLARE
    v_processed INTEGER := 0;
    v_retry_order RECORD;
    v_orders_cursor CURSOR FOR
        SELECT id, order_id, provider, attempt_count
        FROM fiscal_retry_queue
        WHERE status = 'pending'
        AND next_retry_at <= NOW()
        ORDER BY priority DESC, next_retry_at ASC
        LIMIT p_batch_size;
BEGIN
    OPEN v_orders_cursor;

    LOOP
        FETCH v_orders_cursor INTO v_retry_order;
        EXIT WHEN NOT FOUND;
        EXIT WHEN v_processed >= p_batch_size;

        -- Update status to processing
        UPDATE fiscal_retry_queue
        SET status = 'processing', updated_at = NOW()
        WHERE id = v_retry_order.id;

        -- The actual retry logic is handled by the Edge Function
        -- This function just marks items as ready for processing
        v_processed := v_processed + 1;
    END LOOP;

    CLOSE v_orders_cursor;

    RETURN v_processed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ============================================
-- SECTION 6: Trigger for Updated At
-- ============================================

CREATE OR REPLACE FUNCTION update_fiscal_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fiscal_audit_log_updated_at
    BEFORE UPDATE ON fiscal_audit_log
    FOR EACH ROW EXECUTE FUNCTION update_fiscal_tables_updated_at();

CREATE TRIGGER update_fiscal_retry_queue_updated_at
    BEFORE UPDATE ON fiscal_retry_queue
    FOR EACH ROW EXECUTE FUNCTION update_fiscal_tables_updated_at();

-- ============================================
-- SECTION 7: RLS for Fiscal Tables (Admin Only)
-- ============================================

ALTER TABLE fiscal_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_retry_queue ENABLE ROW LEVEL SECURITY;

-- Only admins can access fiscal audit log
CREATE POLICY "Admins can view fiscal audit log" ON fiscal_audit_log
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage fiscal audit log" ON fiscal_audit_log
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Only admins can access retry queue
CREATE POLICY "Admins can view retry queue" ON fiscal_retry_queue
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage retry queue" ON fiscal_retry_queue
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- SECTION 8: Comments for Documentation
-- ============================================

COMMENT ON TABLE fiscal_audit_log IS 'Complete audit trail for all fiscal operations (Italian compliance requirement)';
COMMENT ON TABLE fiscal_retry_queue IS 'Queue for failed fiscal operations that need retry';
COMMENT ON COLUMN fiscal_audit_log.request_data IS 'Contains sanitized request (no PII, no API keys)';
COMMENT ON COLUMN fiscal_audit_log.processing_time_ms IS 'Time in milliseconds for the fiscal provider API call';