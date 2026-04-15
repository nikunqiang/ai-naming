// src/mastra/index.ts
import { Mastra } from '@mastra/core'
import { namingAgent } from './agent'
import { queryCharacterTool, queryCharacterByWuxingTool } from './tools/query-character'
import { searchClassicTool, searchClassicByKeywordTool } from './tools/search-classic'
import { generateNamesTool } from './tools/generate-names'
import { analyzeNameTool } from './tools/analyze-name'

export const mastra = new Mastra({
  agents: [namingAgent],
  tools: [
    queryCharacterTool,
    queryCharacterByWuxingTool,
    searchClassicTool,
    searchClassicByKeywordTool,
    generateNamesTool,
    analyzeNameTool,
  ],
})

export { namingAgent }
