import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const generated = defineCollection({
  loader: glob({
    base: "./src/content/generated",
    pattern: "**/*.json",
  }),
});

export const collections = {
  generated,
};
