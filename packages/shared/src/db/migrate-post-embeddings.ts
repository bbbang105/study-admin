/**
 * 스터디 글 벡터 추천 마이그레이션
 *
 * - pgvector 확장 활성화
 * - post_embeddings 테이블 추가
 * - cosine HNSW 인덱스 추가
 *
 * Usage: pnpm --filter @blog-study/shared migrate:post-embeddings
 */

import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'node:path';

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
        CREATE TABLE IF NOT EXISTS public.post_embeddings (
          post_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE cascade,
          embedding extensions.vector(768) NOT NULL,
          embedding_text text NOT NULL,
          embedding_text_hash varchar(64) NOT NULL,
          embedding_model varchar(100) NOT NULL,
          embedded_at timestamp with time zone DEFAULT now()
        )
      `);

      await tx.unsafe(`
        ALTER TABLE public.post_embeddings ENABLE ROW LEVEL SECURITY
      `);

      await tx.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_post_embeddings_embedded_at
          ON public.post_embeddings (embedded_at)
      `);

      await tx.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_post_embeddings_embedding_hnsw
          ON public.post_embeddings
          USING hnsw (embedding extensions.vector_cosine_ops)
      `);
    });

    console.log('스터디 글 벡터 추천 마이그레이션 완료');
  } catch (error) {
    console.error('스터디 글 벡터 추천 마이그레이션 실패:', error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
