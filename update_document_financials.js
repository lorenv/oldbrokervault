
const { Pool } = require('pg');

async function updateDocumentFinancials() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // First, find the document by share slug
    const docQuery = `
      SELECT id, user_id, title, "financialsEnabled", revenue, ebitda 
      FROM cim_documents 
      WHERE share_slug = 'cim-wwkz3j' OR custom_slug = 'cim-wwkz3j'
    `;
    
    const docResult = await pool.query(docQuery);
    
    if (docResult.rows.length === 0) {
      console.log('Document not found with slug: cim-wwkz3j');
      return;
    }
    
    const document = docResult.rows[0];
    console.log('Found document:', {
      id: document.id,
      user_id: document.user_id,
      title: document.title,
      current_revenue: document.revenue,
      current_ebitda: document.ebitda
    });
    
    // Get the user email
    const userQuery = `SELECT email FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [document.user_id]);
    
    if (userResult.rows.length > 0) {
      console.log('Document owner email:', userResult.rows[0].email);
    }
    
    // Update the financial data
    const updateQuery = `
      UPDATE cim_documents 
      SET 
        revenue = $1,
        ebitda = $2,
        "revenueIncluded" = true,
        "ebitdaIncluded" = true,
        "financialsEnabled" = true
      WHERE id = $3
    `;
    
    const updateResult = await pool.query(updateQuery, ['$8,500,000', '$1,400,000', document.id]);
    
    console.log('Update completed successfully');
    console.log('Updated revenue to: $8,500,000');
    console.log('Updated EBITDA to: $1,400,000');
    
    // Verify the update
    const verifyQuery = `
      SELECT revenue, ebitda, "revenueIncluded", "ebitdaIncluded", "financialsEnabled"
      FROM cim_documents 
      WHERE id = $1
    `;
    
    const verifyResult = await pool.query(verifyQuery, [document.id]);
    console.log('Verified updated values:', verifyResult.rows[0]);
    
  } catch (error) {
    console.error('Error updating document financials:', error);
  } finally {
    await pool.end();
  }
}

updateDocumentFinancials();
