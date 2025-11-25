import fetch from 'node-fetch';

export async function fetchPinDetails(pincode) {
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();
    
    if (!data || !data[0] || data[0].Status !== 'Success') {
      return { success: false, postOffices: [] };
    }
    
    const postOffices = data[0].PostOffice || [];
    if (!postOffices.length) {
      return { success: false, postOffices: [] };
    }
    
    // Get district and state from first post office
    const district = postOffices[0].District || '';
    const state = postOffices[0].State || '';
    
    // Group all locations by post office name
    const postOfficeMap = new Map();
    
    postOffices.forEach(office => {
      const poName = office.Name || '';
      if (!poName) return;
      
      if (!postOfficeMap.has(poName)) {
        postOfficeMap.set(poName, {
          name: poName,
          villages: new Set()
        });
      }
      
      // Add the post office location itself
      postOfficeMap.get(poName).villages.add(office.Name);
      
      // Add Block if different from Name
      if (office.Block && office.Block !== office.Name) {
        postOfficeMap.get(poName).villages.add(office.Block);
      }
      
      // Add Division if different
      if (office.Division && office.Division !== office.Name && office.Division !== office.Block) {
        postOfficeMap.get(poName).villages.add(office.Division);
      }
      
      // Add Region if different
      if (office.Region && office.Region !== office.Name && office.Region !== office.Block && office.Region !== office.Division) {
        postOfficeMap.get(poName).villages.add(office.Region);
      }
    });
    
    // Convert to array format with A-Z sorted villages
    const postOfficeList = Array.from(postOfficeMap.values()).map(po => ({
      name: po.name,
      villages: Array.from(po.villages).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    })).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
    
    return {
      success: true,
      postOffices: postOfficeList,
      district: district,
      state: state
    };
    
  } catch (error) {
    console.error('Pincode API error:', error);
    return { success: false, postOffices: [] };
  }
}
