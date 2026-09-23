import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const talks = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/talks' }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
    venue: z.string().min(1),
    video: z.string().regex(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/, 'Use a YouTube watch URL with an 11-character video ID.'),
  }),
});

export const collections = { talks };
