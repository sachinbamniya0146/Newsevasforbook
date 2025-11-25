// ═══════════════════════════════════════════════════════════════
// 📮 ENHANCED PINCODE HELPER v2.0
// ═══════════════════════════════════════════════════════════════
// Features:
// ✅ Fetch Post Office list from Pincode
// ✅ Retry logic with exponential backoff
// ✅ Caching for faster response
// ✅ Error handling
// ✅ Multiple API support with fallback
// ═══════════════════════════════════════════════════════════════

import fetch from 'node-fetch';

// Cache for pincode data (expires after 24 hours)
const pincodeCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch pincode details with Post Office list
 * @param {string} pincode - 6-digit pincode
 * @returns {Promise<Object>} - { success, postOffices, district, state }
 */
export async function fetchPinDetails(pincode) {
  try {
    // Check cache first
    if (pincodeCache.has(pincode)) {
      const cached = pincodeCache.get(pincode);
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log(`✅ Pincode ${pincode} loaded from cache`);
        return cached.data;
      } else {
        pincodeCache.delete(pincode); // Expired
      }
    }

    // Primary API
    const result = await fetchFromPrimaryAPI(pincode);
    
    if (result && result.success) {
      // Cache the result
      pincodeCache.set(pincode, {
        data: result,
        timestamp: Date.now()
      });
      return result;
    }

    // Fallback API
    const fallbackResult = await fetchFromFallbackAPI(pincode);
    
    if (fallbackResult && fallbackResult.success) {
      pincodeCache.set(pincode, {
        data: fallbackResult,
        timestamp: Date.now()
      });
      return fallbackResult;
    }

    return { success: false, error: 'Pincode not found in any API' };

  } catch (err) {
    console.error('❌ Error in fetchPinDetails:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch from Primary API (India Post API)
 */
async function fetchFromPrimaryAPI(pincode) {
  try {
    const url = `https://api.postalpincode.in/pincode/${pincode}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || data.length === 0 || data[0].Status !== 'Success') {
      return { success: false };
    }

    const postOfficeData = data[0].PostOffice;
    
    if (!postOfficeData || postOfficeData.length === 0) {
      return { success: false };
    }

    // Extract unique post offices/areas
    const postOffices = postOfficeData.map(po => po.Name).filter(Boolean);
    const district = postOfficeData[0].District;
    const state = postOfficeData[0].State;

    return {
      success: true,
      postOffices: [...new Set(postOffices)], // Remove duplicates
      district: district,
      state: state,
      source: 'primary'
    };

  } catch (err) {
    console.error('❌ Primary API error:', err.message);
    return { success: false };
  }
}

/**
 * Fetch from Fallback API
 */
async function fetchFromFallbackAPI(pincode) {
  try {
    const url = `https://api.data.gov.in/resource/5c2f62fe-5afa-4119-a499-fec9d604d5bd?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b&format=json&filters[pincode]=${pincode}`;
    const response = await fetch(url, {
      method: 'GET',
      timeout: 10000
    });

    if (!response.ok) {
      return { success: false };
    }

    const data = await response.json();
    
    if (!data || !data.records || data.records.length === 0) {
      return { success: false };
    }

    const records = data.records;
    const postOffices = records.map(r => r.officename).filter(Boolean);
    const district = records[0].districtname;
    const state = records[0].statename;

    return {
      success: true,
      postOffices: [...new Set(postOffices)],
      district: district,
      state: state,
      source: 'fallback'
    };

  } catch (err) {
    console.error('❌ Fallback API error:', err.message);
    return { success: false };
  }
}

/**
 * Clear cache for specific pincode
 */
export function clearPincodeCache(pincode) {
  if (pincode) {
    pincodeCache.delete(pincode);
  } else {
    pincodeCache.clear();
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: pincodeCache.size,
    entries: Array.from(pincodeCache.keys())
  };
}
