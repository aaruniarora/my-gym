import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { ExerciseSchema, NiggleMobilitySchema, SkillTreeSchema, TestBatterySchema } from '../content/schema'

// Most content files are arrays of items, so those JSON Schemas describe arrays.
export const jsonSchemas = {
  'exercise.schema.json': zodToJsonSchema(z.array(ExerciseSchema), { name: 'Exercises', $refStrategy: 'none' }),
  'skill-tree.schema.json': zodToJsonSchema(z.array(SkillTreeSchema), { name: 'SkillTrees', $refStrategy: 'none' }),
  'test-battery.schema.json': zodToJsonSchema(z.array(TestBatterySchema), { name: 'TestBattery', $refStrategy: 'none' }),
  'niggle-mobility.schema.json': zodToJsonSchema(NiggleMobilitySchema, { name: 'NiggleMobility', $refStrategy: 'none' }),
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const [file, schema] of Object.entries(jsonSchemas)) {
    writeFileSync(join(import.meta.dirname, '..', 'content', 'schema', file), JSON.stringify(schema, null, 2) + '\n')
  }
  console.log(`wrote ${Object.keys(jsonSchemas).length} schemas to content/schema/`)
}
