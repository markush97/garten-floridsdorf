import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './functions/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
})
