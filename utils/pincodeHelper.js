// Enhanced Pincode Helper - Maximum Details Extraction
export async function fetchPinDetails(pincode) {
  try {
    console.log(`🔍 Fetching pincode details for: ${pincode}`);
    
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WhatsApp-Book-Bot/1.0'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ API Response Error: ${response.status}`);
      return { success: false, error: 'API request failed' };
    }
    
    const data = await response.json();
    
    // Check if data is valid
    if (!data || !Array.isArray(data) || !data[0]) {
      console.error('❌ Invalid API response structure');
      return { success: false, error: 'Invalid response' };
    }
    
    const result = data[0];
    
    // Check API status
    if (result.Status !== 'Success') {
      console.error(`❌ API Status: ${result.Status} - ${result.Message || 'No data found'}`);
      return { 
        success: false, 
        error: result.Message || 'Pincode not found',
        status: result.Status 
      };
    }
    
    const postOffices = result.PostOffice || [];
    
    if (!postOffices.length) {
      console.error('❌ No post offices found for this pincode');
      return { success: false, error: 'No post offices found' };
    }
    
    console.log(`✅ Found ${postOffices.length} post office(s)`);
    
    // Extract all unique values
    const districts = new Set();
    const states = new Set();
    const blocks = new Set();
    const regions = new Set();
    const divisions = new Set();
    const circles = new Set();
    const taluks = new Set();
    const deliveryStatus = new Set();
    
    // Collect all data
    postOffices.forEach(po => {
      if (po.District) districts.add(po.District);
      if (po.State) states.add(po.State);
      if (po.Block) blocks.add(po.Block);
      if (po.Region) regions.add(po.Region);
      if (po.Division) divisions.add(po.Division);
      if (po.Circle) circles.add(po.Circle);
      if (po.Taluk) taluks.add(po.Taluk);
      if (po.DeliveryStatus) deliveryStatus.add(po.DeliveryStatus);
    });
    
    // Get primary values (first post office)
    const primary = postOffices[0];
    
    // Build detailed response
    const details = {
      success: true,
      pincode: pincode,
      
      // Primary Information
      district: primary.District || '',
      state: primary.State || '',
      block: primary.Block || '',
      region: primary.Region || '',
      division: primary.Division || '',
      circle: primary.Circle || '',
      taluk: primary.Taluk || '',
      
      // Additional Info
      country: primary.Country || 'India',
      deliveryStatus: primary.DeliveryStatus || '',
      
      // All Unique Values (for reference)
      allDistricts: Array.from(districts),
      allStates: Array.from(states),
      allBlocks: Array.from(blocks),
      allRegions: Array.from(regions),
      allDivisions: Array.from(divisions),
      allCircles: Array.from(circles),
      allTaluks: Array.from(taluks),
      allDeliveryStatus: Array.from(deliveryStatus),
      
      // Count
      postOfficeCount: postOffices.length,
      
      // Full post office data (for advanced use)
      postOffices: postOffices.map(po => ({
        name: po.Name || '',
        branchType: po.BranchType || '',
        deliveryStatus: po.DeliveryStatus || '',
        district: po.District || '',
        state: po.State || '',
        block: po.Block || '',
        region: po.Region || '',
        division: po.Division || '',
        circle: po.Circle || '',
        taluk: po.Taluk || ''
      }))
    };
    
    console.log('✅ Pincode details extracted successfully:');
    console.log(`   District: ${details.district}`);
    console.log(`   State: ${details.state}`);
    console.log(`   Block: ${details.block}`);
    console.log(`   Region: ${details.region}`);
    console.log(`   Division: ${details.division}`);
    console.log(`   Post Offices: ${details.postOfficeCount}`);
    
    return details;
    
  } catch (error) {
    console.error('❌ Pincode API error:', error.message);
    return { 
      success: false, 
      error: error.message || 'Failed to fetch pincode details'
    };
  }
}

// Helper function to get formatted address components
export function getAddressComponents(pincodeDetails) {
  if (!pincodeDetails || !pincodeDetails.success) {
    return null;
  }
  
  const components = [];
  
  if (pincodeDetails.block) components.push(`Block: ${pincodeDetails.block}`);
  if (pincodeDetails.taluk) components.push(`Taluk: ${pincodeDetails.taluk}`);
  if (pincodeDetails.district) components.push(`District: ${pincodeDetails.district}`);
  if (pincodeDetails.division) components.push(`Division: ${pincodeDetails.division}`);
  if (pincodeDetails.region) components.push(`Region: ${pincodeDetails.region}`);
  if (pincodeDetails.state) components.push(`State: ${pincodeDetails.state}`);
  if (pincodeDetails.circle) components.push(`Circle: ${pincodeDetails.circle}`);
  
  return components;
}

// Helper function to get complete address string
export function getFullAddressString(pincodeDetails) {
  if (!pincodeDetails || !pincodeDetails.success) {
    return '';
  }
  
  const parts = [];
  
  if (pincodeDetails.block) parts.push(pincodeDetails.block);
  if (pincodeDetails.taluk && pincodeDetails.taluk !== pincodeDetails.block) {
    parts.push(pincodeDetails.taluk);
  }
  if (pincodeDetails.district) parts.push(pincodeDetails.district);
  if (pincodeDetails.state) parts.push(pincodeDetails.state);
  if (pincodeDetails.pincode) parts.push(pincodeDetails.pincode);
  
  return parts.join(', ');
}
