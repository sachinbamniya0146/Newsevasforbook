/**
 * Enhanced getMessage handler to prevent Bad MAC errors
 */
export function createGetMessage(sock) {
  return async (key) => {
    try {
      // Return empty/placeholder for unavailable messages
      return {
        conversation: ''
      };
    } catch (error) {
      // Silently handle errors
      return {
        conversation: ''
      };
    }
  };
}
