import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  createSuccessResponse,
  createErrorResponse,
  generateUserId,
  getUserByUsername,
  createUser,
} from '../utils/dynamodb';
import type { RegisterUserRequest } from '../types';

/**
 * Register a new user
 * POST /auth/register
 * 
 * Request body:
 * {
 *   "username": "string",
 *   "email": "string"
 * }
 * 
 * Response:
 * {
 *   "userId": "string",
 *   "username": "string",
 *   "email": "string",
 *   "createdAt": "ISO8601"
 * }
 */
export const registerUser: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // Parse request body
    let body: RegisterUserRequest;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }

    // Validate required fields
    const { username, email } = body;
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return createErrorResponse(400, 'username is required and must be a non-empty string');
    }

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return createErrorResponse(400, 'email is required and must be a valid email address');
    }

    // Check if username already exists
    const existingUser = await getUserByUsername(username.toLowerCase());
    if (existingUser) {
      return createErrorResponse(409, 'Username already exists');
    }

    // Generate unique userId
    const userId = generateUserId();

    // Create user in DynamoDB
    const user = await createUser(userId, username.toLowerCase(), email.toLowerCase());

    console.log(`User registered successfully: ${userId} (${username})`);

    return createSuccessResponse({
      userId: user.userId,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    }, 201);
  } catch (error) {
    console.error('Error in registerUser:', error);
    
    // Check if it's a validation error
    if (error instanceof Error && error.message.includes('ValidationException')) {
      return createErrorResponse(400, 'Invalid request format');
    }

    // Generic server error
    return createErrorResponse(500, 'Failed to register user. Please try again later.');
  }
};

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Handle CORS preflight requests
 */
export const options: APIGatewayProxyHandlerV2 = async (_event) => {
  return createSuccessResponse(null);
};
