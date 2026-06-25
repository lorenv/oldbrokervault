import { generateFlexibleCimDocument } from './server/perplexity';
const transcript = `Atlas Logistics Group, Dallas TX, regional freight & last-mile delivery, 18 years, 42 trucks, contracts with 3 national retailers, $11.4M revenue, $1.8M EBITDA, 65 employees (48 drivers), founder Raymond Okafor retiring in 6-12 months. 24/7 dispatch, modern fleet avg age 3 yrs, "on-time or free" guarantee.`;
// Large website data to push total output past the 8000-token cap
const websiteData = ('Atlas Logistics operates 6 regional hubs across Texas, Oklahoma, Arkansas and Louisiana. ' +
  'Services: dedicated contract carriage, last-mile e-commerce delivery, white-glove installation, reverse logistics, warehousing, cross-docking. ' +
  'Leadership team: 8 executives with detailed bios. Safety record: 2M+ miles without major incident. Technology: proprietary routing platform, real-time tracking, EDI integration. ').repeat(12);
(async () => {
  try {
    const doc = await generateFlexibleCimDocument(transcript, 'Comprehensive, richly detailed, long-form sections', 'sale', 'professional', 'strategic buyers', null, websiteData);
    console.log('SUCCESS. sections:', (doc as any)?.sections?.length);
  } catch (e:any) {
    console.log('REPRO FAILED WITH:', e?.message);
  }
  process.exit(0);
})();
