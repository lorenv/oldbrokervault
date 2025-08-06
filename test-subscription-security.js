// Test to verify the subscription security loophole fix
import fetch from 'node-fetch';

async function testSubscriptionBypassFix() {
  console.log('🔐 Testing subscription security bypass fix...\n');
  
  const baseUrl = 'http://localhost:5000';
  
  // Test with a session cookie (replace with actual session)
  const sessionCookie = 'connect.sid=s%3A3fQQsITAczE5K0wzESkrLJ8aQplPNJW8.iKzydaqFNW2pXezww4BWFgdiMatzrJi%2BaRRqFAh6iNE';
  
  try {
    // Step 1: Check current user status
    console.log('📊 Step 1: Checking current user subscription status...');
    const userResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Cookie': sessionCookie }
    });
    
    if (!userResponse.ok) {
      console.log('❌ Authentication failed. Please ensure session is valid.');
      return;
    }
    
    const user = await userResponse.json();
    console.log(`✅ User: ${user.email}`);
    console.log(`📋 Subscription: ${user.subscriptionStatus}`);
    console.log(`📈 Monthly Documents Created: ${user.monthlyDocumentsCreated}`);
    console.log(`📄 Document limit based on plan:`, getSubscriptionLimit(user.subscriptionStatus));
    console.log('');
    
    // Step 2: Attempt to create a document
    console.log('📝 Step 2: Attempting to create a test document...');
    const createResponse = await fetch(`${baseUrl}/api/cim/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        title: 'Security Test Document',
        transcript: 'Test transcript for security validation',
        directions: 'Create a basic CIM for security testing',
        financials: { enabled: false }
      })
    });
    
    console.log(`📊 Create attempt status: ${createResponse.status}`);
    
    if (createResponse.status === 429 || createResponse.status === 403) {
      console.log('✅ SECURITY FIX WORKING: Document creation blocked due to limit');
      const errorData = await createResponse.text();
      console.log('📋 Error message:', errorData);
      console.log('');
      
      // Test the loophole scenario
      console.log('🔍 Step 3: Testing loophole scenario - attempting to bypass via deletion...');
      
      // Get user's documents
      const docsResponse = await fetch(`${baseUrl}/api/cim`, {
        headers: { 'Cookie': sessionCookie }
      });
      
      if (docsResponse.ok) {
        const docs = await docsResponse.json();
        console.log(`📄 User has ${docs.length} documents`);
        
        if (docs.length > 0) {
          // Delete the first document
          const docToDelete = docs[0];
          console.log(`🗑️ Attempting to delete document: ${docToDelete.title} (ID: ${docToDelete.id})`);
          
          const deleteResponse = await fetch(`${baseUrl}/api/cim/${docToDelete.id}`, {
            method: 'DELETE',
            headers: { 'Cookie': sessionCookie }
          });
          
          console.log(`📊 Delete status: ${deleteResponse.status}`);
          
          if (deleteResponse.ok) {
            console.log('✅ Document deleted successfully');
            
            // Now try to create a new document (this should still fail)
            console.log('🔄 Attempting to create new document after deletion (should fail)...');
            const bypassResponse = await fetch(`${baseUrl}/api/cim/generate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': sessionCookie
              },
              body: JSON.stringify({
                title: 'Bypass Attempt Document',
                transcript: 'Testing subscription bypass after deletion',
                directions: 'This should fail if the fix works',
                financials: { enabled: false }
              })
            });
            
            console.log(`📊 Bypass attempt status: ${bypassResponse.status}`);
            
            if (bypassResponse.status === 429 || bypassResponse.status === 403) {
              console.log('🎉 SUCCESS: Subscription bypass prevented!');
              console.log('✅ The security fix is working correctly');
              const bypassError = await bypassResponse.text();
              console.log('📋 Error message:', bypassError);
            } else {
              console.log('❌ SECURITY ISSUE: Bypass attempt succeeded');
              console.log('🚨 The loophole still exists!');
            }
          }
        } else {
          console.log('📄 No documents found to test deletion scenario');
        }
      }
    } else if (createResponse.ok) {
      const newDoc = await createResponse.json();
      console.log('✅ Document created successfully:', newDoc.title);
      console.log('📋 This means the user is still within their limits');
    } else {
      console.log('❌ Unexpected error during document creation');
      const errorText = await createResponse.text();
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function getSubscriptionLimit(subscriptionStatus) {
  const limits = {
    free: 1,
    paid: 20,
    admin: Infinity
  };
  return limits[subscriptionStatus] || 1;
}

testSubscriptionBypassFix().then(() => {
  console.log('\n🏁 Subscription security test completed');
});