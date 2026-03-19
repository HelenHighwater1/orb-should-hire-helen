/**
 * One-line product descriptions for the AI Setup tab "Random" control.
 * Each idea implies metered API usage against an AI backend (tokens, calls, seats, etc.).
 */
export const RANDOM_AI_BUSINESS_IDEAS: string[] = [
  "We sell a REST API that summarizes legal contracts using a large language model, billed per document and token tier.",
  "Developers integrate our streaming API to add real-time code completion powered by frontier models; we charge per 1K tokens.",
  "Our API turns product photos into lifestyle shots with generative AI; ecommerce teams pay per image and per API call.",
  "We provide an embeddings and reranking API for RAG pipelines—customers index docs and pay by query volume and embedding dimensions.",
  "A speech-to-text API that uses neural ASR plus LLM cleanup for medical dictation; pricing is per audio minute and API request.",
  "We offer a fine-tuned chat API for fintech support bots; customers are billed per conversation turn and monthly active seats.",
  "Our API generates SQL from natural language for BI tools; data teams pay per successful query and monthly query cap tiers.",
  "We expose a multimodal API: image in, structured JSON out for insurance claims; usage is priced per inference and batch job.",
  "Developer platform for synthetic voiceovers via neural TTS; studios integrate our API and pay per character and concurrent stream.",
  "We run a document Q&A API for HR teams—upload PDFs, ask questions; billing is per page processed and per question.",
  "Our API scores sales leads with an LLM using CRM context; RevOps pays per scored lead and monthly API volume bands.",
  "We provide translation plus tone adjustment via LLM for global apps; customers pay per word and per locale pair.",
  "An API that extracts tables from messy PDFs into CSV using vision models; accounting SaaS pays per page and per extraction job.",
  "We sell real-time meeting notes: audio webhook in, summary out; teams pay per meeting minute and summarization API call.",
  "Our code-review API comments on pull requests using static analysis plus an LLM; orgs pay per PR and per line of diff.",
  "We offer a guardrails API—classify, redact, and rewrite user prompts before they hit customer models; priced per classified request.",
  "A personalization API that rewrites marketing copy per segment using generative AI; marketers pay per variant and API batch.",
  "We provide synthetic test data generation via LLM for QA teams; billed per schema and per generated row.",
  "Our API generates API documentation and OpenAPI specs from code repos; devtools companies pay per repo sync and token.",
  "We run a moderation API combining classifiers and an LLM for nuanced policy decisions; platforms pay per moderated item.",
  "An API that turns spreadsheets into narrative dashboards with charts explained in plain language; finance teams pay per sheet and refresh.",
  "We expose a copilot API for internal wikis—answers with citations; enterprises pay per seat and per grounded retrieval call.",
];

export function pickRandomBusinessIdea(): string {
  const i = Math.floor(Math.random() * RANDOM_AI_BUSINESS_IDEAS.length);
  return RANDOM_AI_BUSINESS_IDEAS[i];
}
