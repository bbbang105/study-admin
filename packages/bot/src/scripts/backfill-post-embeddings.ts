import { config } from 'dotenv';
import { resolve } from 'node:path';
import { closeDb } from '@blog-study/shared/db';
import { getEmbeddingService } from '../services/embedding.service';

config({ path: resolve(process.cwd(), '../../.env.local') });
config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  const limit = Number(process.argv[2] ?? 50);
  const updated = await getEmbeddingService().backfillMissingPosts(limit);
  console.log(`Updated ${updated} post embeddings`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
