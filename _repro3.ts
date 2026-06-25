import { generateFlexibleCimDocument } from './server/perplexity';
const transcript = `Atlas Logistics Group, Dallas TX, regional freight & last-mile delivery, 18 years, 42 trucks, contracts with 3 national retailers, $11.4M revenue, $1.8M EBITDA, 65 employees (48 drivers), founder Raymond Okafor retiring in 6-12 months. 24/7 dispatch, modern fleet avg age 3 yrs, "on-time or free" guarantee.`;
(async () => {
  try {
    const doc = await generateFlexibleCimDocument(transcript, 'Comprehensive, detailed', 'sale', 'professional', 'strategic buyers', null);
    console.log('SUCCESS. sections:', (doc as any)?.sections?.length);
  } catch (e:any) { console.log('FAILED:', e?.message); }
  process.exit(0);
})();
