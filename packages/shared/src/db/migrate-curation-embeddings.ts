/**
 * 큐레이션 벡터 추천 마이그레이션
 *
 * - original_articles 테이블만 있는 운영 DB를 curation_items 이름으로 정렬
 * - pgvector 확장 활성화
 * - curation_items.embedding vector(768) 컬럼 추가
 * - member_preference_embeddings 테이블 추가
 * - cosine HNSW 인덱스 추가
 *
 * Usage: pnpm --filter @blog-study/shared migrate:curation-embeddings
 */

import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../../.env.local') });
config({ path: resolve(__dirname, '../../../../.env') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1, prepare: false });

  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(`CREATE SCHEMA IF NOT EXISTS extensions`);
      await tx.unsafe(`CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions`);

      await tx.unsafe(`
        DO $$
        BEGIN
          IF to_regclass('public.curation_items') IS NULL
             AND to_regclass('public.original_articles') IS NOT NULL THEN
            ALTER TABLE public.original_articles RENAME TO curation_items;
          END IF;
        END $$;
      `);

      await tx.unsafe(`
        ALTER TABLE public.curation_items
          ADD COLUMN IF NOT EXISTS embedding extensions.vector(768),
          ADD COLUMN IF NOT EXISTS embedding_text_hash varchar(64),
          ADD COLUMN IF NOT EXISTS embedding_model varchar(100),
          ADD COLUMN IF NOT EXISTS embedded_at timestamp with time zone
      `);

      await tx.unsafe(`
        CREATE TABLE IF NOT EXISTS public.member_preference_embeddings (
          member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE cascade,
          preference_text text NOT NULL,
          preference_text_hash varchar(64) NOT NULL,
          embedding extensions.vector(768) NOT NULL,
          embedding_model varchar(100) NOT NULL,
          refreshed_at timestamp with time zone DEFAULT now()
        )
      `);

      await tx.unsafe(`
        ALTER TABLE public.member_preference_embeddings ENABLE ROW LEVEL SECURITY
      `);

      await tx.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_curation_items_embedded_at
          ON public.curation_items (embedded_at)
      `);

      await tx.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_member_preference_embeddings_refreshed_at
          ON public.member_preference_embeddings (refreshed_at)
      `);

      await tx.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_curation_items_embedding_hnsw
          ON public.curation_items
          USING hnsw (embedding extensions.vector_cosine_ops)
          WHERE embedding IS NOT NULL
      `);

      await tx.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_member_preference_embeddings_embedding_hnsw
          ON public.member_preference_embeddings
          USING hnsw (embedding extensions.vector_cosine_ops)
      `);

      await tx.unsafe(`
        DO $$
        DECLARE
          original_articles_kind char;
        BEGIN
          SELECT relkind
            INTO original_articles_kind
            FROM pg_class
           WHERE oid = to_regclass('public.original_articles');

          IF original_articles_kind IS NULL THEN
            EXECUTE 'CREATE VIEW public.original_articles WITH (security_invoker = true) AS SELECT * FROM public.curation_items';
          ELSIF original_articles_kind = 'v' THEN
            EXECUTE 'CREATE OR REPLACE VIEW public.original_articles WITH (security_invoker = true) AS SELECT * FROM public.curation_items';
          END IF;
        END $$;
      `);
    });

    console.log('큐레이션 벡터 추천 마이그레이션 완료');
  } catch (error) {
    console.error('큐레이션 벡터 추천 마이그레이션 실패:', error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
