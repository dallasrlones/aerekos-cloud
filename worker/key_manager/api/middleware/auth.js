const axios = require('axios');

async function validateServiceToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      error: { message: 'Service token required', status: 401 }
    });
  }
  
  if (!process.env.CONDUCTOR_URL) {
    console.error('[auth] CONDUCTOR_URL not configured - cannot validate service token');
    return res.status(503).json({
      error: { message: 'Service authentication unavailable', status: 503 }
    });
  }
  
  try {
    // Validate token with conductor
    const response = await axios.post(
      `${process.env.CONDUCTOR_URL}/api/services/validate-token`,
      { token },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      }
    );
    
    req.service = response.data.service; // Attach service info
    next();
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('[auth] Invalid service token');
      return res.status(401).json({
        error: { message: 'Invalid service token', status: 401 }
      });
    }
    
    if (error.response?.status === 404) {
      console.error('[auth] Token validation endpoint not found in conductor');
      return res.status(503).json({
        error: { message: 'Service authentication unavailable', status: 503 }
      });
    }
    
    console.error('[auth] Token validation failed:', error.message);
    return res.status(503).json({
      error: { message: 'Service authentication unavailable', status: 503 }
    });
  }
}

module.exports = validateServiceToken;
