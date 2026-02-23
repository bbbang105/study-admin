-- ============================================
-- Row Level Security (RLS) Policies
-- Supabase Production Configuration
-- ============================================

-- Enable RLS on all tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE curation_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE curation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Service Role Policies (Full Access)
-- Bot and Server-side operations
-- ============================================

-- Members: Service role has full access
CREATE POLICY "service_role_members_all" ON members
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users: Service role has full access
CREATE POLICY "service_role_users_all" ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Sessions: Service role has full access
CREATE POLICY "service_role_sessions_all" ON sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Rounds: Service role has full access
CREATE POLICY "service_role_rounds_all" ON rounds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Posts: Service role has full access
CREATE POLICY "service_role_posts_all" ON posts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Attendance: Service role has full access
CREATE POLICY "service_role_attendance_all" ON attendance
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fines: Service role has full access
CREATE POLICY "service_role_fines_all" ON fines
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Keywords: Service role has full access
CREATE POLICY "service_role_keywords_all" ON keywords
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Curation Sources: Service role has full access
CREATE POLICY "service_role_curation_sources_all" ON curation_sources
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Curation Items: Service role has full access
CREATE POLICY "service_role_curation_items_all" ON curation_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Config: Service role has full access
CREATE POLICY "service_role_config_all" ON config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Anon/Authenticated Role Policies (Read-Only Public Data)
-- Web client operations
-- ============================================

-- Members: Public can read active members only
CREATE POLICY "anon_members_select" ON members
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active' OR status = 'dormant');

-- Rounds: Public can read all rounds
CREATE POLICY "anon_rounds_select" ON rounds
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Posts: Public can read all posts
CREATE POLICY "anon_posts_select" ON posts
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Attendance: Public can read all attendance
CREATE POLICY "anon_attendance_select" ON attendance
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Fines: Public can read all fines (amounts are not sensitive)
CREATE POLICY "anon_fines_select" ON fines
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Keywords: Public can read all keywords
CREATE POLICY "anon_keywords_select" ON keywords
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Curation Sources: Public can read active sources
CREATE POLICY "anon_curation_sources_select" ON curation_sources
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Curation Items: Public can read shared items
CREATE POLICY "anon_curation_items_select" ON curation_items
  FOR SELECT
  TO anon, authenticated
  USING (is_shared = true);

-- Config: Public can read non-sensitive config
CREATE POLICY "anon_config_select" ON config
  FOR SELECT
  TO anon, authenticated
  USING (key NOT LIKE '%secret%' AND key NOT LIKE '%token%' AND key NOT LIKE '%key%');

-- ============================================
-- Additional Performance Indexes
-- ============================================

-- Members: Frequently queried fields
CREATE INDEX IF NOT EXISTS idx_members_discord_username ON members(discord_username);
CREATE INDEX IF NOT EXISTS idx_members_joined_at ON members(joined_at DESC);

-- Users: Email lookup and member linking
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_member_id ON users(member_id);

-- Sessions: Token lookup and expiry cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Rounds: Current round lookup
CREATE INDEX IF NOT EXISTS idx_rounds_is_current ON rounds(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_rounds_dates ON rounds(start_date, end_date);

-- Posts: Date-based queries
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_collected_at ON posts(collected_at DESC);

-- Attendance: Status filtering
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_member_status ON attendance(member_id, status);

-- Fines: Member lookup for unpaid fines
CREATE INDEX IF NOT EXISTS idx_fines_member_status ON fines(member_id, status);

-- Keywords: Frequency ranking
CREATE INDEX IF NOT EXISTS idx_keywords_frequency ON keywords(frequency DESC);

-- Curation Items: Relevance sorting
CREATE INDEX IF NOT EXISTS idx_curation_items_relevance ON curation_items(relevance_score DESC) WHERE is_shared = false;
CREATE INDEX IF NOT EXISTS idx_curation_items_collected_at ON curation_items(collected_at DESC);

-- ============================================
-- Cleanup Functions
-- ============================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired email verification tokens
CREATE OR REPLACE FUNCTION cleanup_expired_email_tokens()
RETURNS void AS $$
BEGIN
  UPDATE users 
  SET email_verify_token = NULL, email_verify_expires = NULL
  WHERE email_verify_expires < NOW() AND email_verified = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
