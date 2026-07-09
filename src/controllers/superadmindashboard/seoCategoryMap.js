// controllers/superadmindashboard/seoCategoryMap.js
const CATEGORY_META = {
    gmb_handling: "GMB Handling",
    gmb_report: "GMB Report",
    backlinks: "Creating Backlinks",
    search_console: "Google Search Console",
    content_optimization: "Content Optimization",
    keyword_research: "Keyword Research",
    seo_audit: "SEO Audit",
    blog_writing: "Writing Blogs / Articles",
    website_ranking: "Website Ranking",
    on_page_seo: "On-Page SEO",
    off_page_seo: "Off-Page SEO",
    technical_seo: "Technical SEO",
  };
  
  const byValue = Object.fromEntries(Object.keys(CATEGORY_META).map((k) => [k, k]));
  const byLabel = Object.fromEntries(Object.entries(CATEGORY_META).map(([v, l]) => [l, v]));
  
  module.exports = { CATEGORY_VALUES: { byValue, byLabel }, CATEGORY_META };