/**
 * @fileoverview Network utilities for the Aideon SDK.
 * Provides HTTP request, WebSocket, and other network-related functions.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const http = require('http');
const https = require('https');
const url = require('url');
const { ApiError } = require('./errorHandling');

/**
 * Makes an HTTP request.
 * @param {Object} options - Request options
 * @param {string} options.url - The request URL
 * @param {string} [options.method='GET'] - The request method
 * @param {Object} [options.headers={}] - The request headers
 * @param {Object|string} [options.body] - The request body
 * @param {number} [options.timeout=30000] - The request timeout in milliseconds
 * @param {boolean} [options.json=false] - Whether to parse the response as JSON
 * @returns {Promise<Object>} The response
 */
function request(options) {
  return new Promise((resolve, reject) => {
    try {
      const {
        url: requestUrl,
        method = 'GET',
        headers = {},
        body,
        timeout = 30000,
        json = false
      } = options;
      
      // Parse URL
      const parsedUrl = url.parse(requestUrl);
      
      // Determine protocol
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      // Set up request options
      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.path,
        method: method.toUpperCase(),
        headers: { ...headers }
      };
      
      // Add content type for JSON
      if (json && body && !headers['Content-Type']) {
        requestOptions.headers['Content-Type'] = 'application/json';
      }
      
      // Create request
      const req = protocol.request(requestOptions, (res) => {
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString();
          
          // Parse JSON if needed
          let parsedBody;
          
          if (json) {
            try {
              parsedBody = JSON.parse(responseBody);
            } catch (error) {
              parsedBody = responseBody;
            }
          } else {
            parsedBody = responseBody;
          }
          
          // Create response object
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedBody
          };
          
          resolve(response);
        });
      });
      
      // Handle errors
      req.on('error', (error) => {
        reject(new ApiError(`Request failed: ${error.message}`, 'REQUEST_ERROR', error));
      });
      
      // Set timeout
      req.setTimeout(timeout, () => {
        req.abort();
        reject(new ApiError(`Request timeout after ${timeout}ms`, 'REQUEST_TIMEOUT'));
      });
      
      // Send body if provided
      if (body) {
        const bodyData = typeof body === 'string' ? body : JSON.stringify(body);
        req.write(bodyData);
      }
      
      // End request
      req.end();
    } catch (error) {
      reject(new ApiError(`Request failed: ${error.message}`, 'REQUEST_ERROR', error));
    }
  });
}

/**
 * Makes a GET request.
 * @param {string} url - The request URL
 * @param {Object} [options={}] - Request options
 * @returns {Promise<Object>} The response
 */
function get(url, options = {}) {
  return request({
    url,
    method: 'GET',
    ...options
  });
}

/**
 * Makes a POST request.
 * @param {string} url - The request URL
 * @param {Object|string} [body] - The request body
 * @param {Object} [options={}] - Request options
 * @returns {Promise<Object>} The response
 */
function post(url, body, options = {}) {
  return request({
    url,
    method: 'POST',
    body,
    ...options
  });
}

/**
 * Makes a PUT request.
 * @param {string} url - The request URL
 * @param {Object|string} [body] - The request body
 * @param {Object} [options={}] - Request options
 * @returns {Promise<Object>} The response
 */
function put(url, body, options = {}) {
  return request({
    url,
    method: 'PUT',
    body,
    ...options
  });
}

/**
 * Makes a DELETE request.
 * @param {string} url - The request URL
 * @param {Object} [options={}] - Request options
 * @returns {Promise<Object>} The response
 */
function del(url, options = {}) {
  return request({
    url,
    method: 'DELETE',
    ...options
  });
}

/**
 * Makes a PATCH request.
 * @param {string} url - The request URL
 * @param {Object|string} [body] - The request body
 * @param {Object} [options={}] - Request options
 * @returns {Promise<Object>} The response
 */
function patch(url, body, options = {}) {
  return request({
    url,
    method: 'PATCH',
    body,
    ...options
  });
}

/**
 * Makes a JSON request.
 * @param {Object} options - Request options
 * @returns {Promise<Object>} The response
 */
function jsonRequest(options) {
  return request({
    ...options,
    json: true
  });
}

/**
 * Creates a request client with default options.
 * @param {Object} [defaultOptions={}] - Default request options
 * @returns {Object} The request client
 */
function createClient(defaultOptions = {}) {
  return {
    request: (options) => request({ ...defaultOptions, ...options }),
    get: (url, options = {}) => get(url, { ...defaultOptions, ...options }),
    post: (url, body, options = {}) => post(url, body, { ...defaultOptions, ...options }),
    put: (url, body, options = {}) => put(url, body, { ...defaultOptions, ...options }),
    delete: (url, options = {}) => del(url, { ...defaultOptions, ...options }),
    patch: (url, body, options = {}) => patch(url, body, { ...defaultOptions, ...options }),
    json: (options) => jsonRequest({ ...defaultOptions, ...options })
  };
}

// Export network utilities
module.exports = {
  request,
  get,
  post,
  put,
  delete: del,
  patch,
  jsonRequest,
  createClient
};
