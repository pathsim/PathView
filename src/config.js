// API configuration for development and production
const API_CONFIG = {
  development: {
    baseUrl: 'http://localhost:8000'
  },
  production: {
    baseUrl: '' // Use relative URLs in production (same domain)
  }
};

// Get the current environment
const getCurrentEnvironment = () => {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
};

// Get the API base URL for the current environment
export const getApiUrl = () => {
  const env = getCurrentEnvironment();
  return API_CONFIG[env].baseUrl;
};

// Helper function to construct full API endpoint URLs
export const getApiEndpoint = (endpoint) => {
  const baseUrl = getApiUrl();
  return `${baseUrl}${endpoint}`;
};

export default API_CONFIG;
