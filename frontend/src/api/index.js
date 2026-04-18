export { authAPI } from './auth.js'
export { statsAPI } from './stats.js'
export { uploadAPI } from './upload.js'
export { articlesAPI } from './articles.js'
export { screeningAPI } from './screening.js'
export { evidenceExtractionAPI } from './evidenceExtraction.js'
export { openalexAPI } from './openalex.js'
export { collectionsAPI } from './collections.js'
export { aiAssistantAPI } from './aiAssistant.js'
export { collectionSynthesisAPI } from './collectionSynthesis.js'
export { clusteringAPI } from './clustering.js'
export { papersAPI } from './papers.js'

import { authAPI } from './auth.js'
import { statsAPI } from './stats.js'
import { uploadAPI } from './upload.js'
import { articlesAPI } from './articles.js'
import { evidenceExtractionAPI } from './evidenceExtraction.js'
import { openalexAPI } from './openalex.js'
import { collectionsAPI } from './collections.js'
import { aiAssistantAPI } from './aiAssistant.js'
import { collectionSynthesisAPI } from './collectionSynthesis.js'
import { clusteringAPI } from './clustering.js'
import { papersAPI } from './papers.js'

export default {
  auth: authAPI,
  stats: statsAPI,
  upload: uploadAPI,
  articles: articlesAPI,
  openalex: openalexAPI,
  collections: collectionsAPI,
  aiAssistant: aiAssistantAPI,
  evidenceExtraction: evidenceExtractionAPI,
  collectionSynthesis: collectionSynthesisAPI,
  clustering: clusteringAPI,
  papers: papersAPI,
}
