import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  createSuccessResponse,
  createErrorResponse,
  generateId,
  getHabitsByUserId,
  createHabit,
  updateHabitCheckIn,
} from '../utils/dynamodb';
import type { CreateHabitRequest, CheckInRequest } from '../types';

/**
 * Get all habits for a user
 * GET /habits?userId=<userId>
 * 
 * Query parameters:
 * - userId: The user ID (required)
 * 
 * Response:
 * {
 *   "habits": [
 *     {
 *       "habitId": "string",
 *       "title": "string",
 *       "cardHeight": number,
 *       "colors": { "primary": string, "secondary": string },
 *       "progress": number,
 *       "streakCount": number,
 *       "lastCheckIn": string | null,
 *       "createdAt": string,
 *       "updatedAt": string
 *     }
 *   ]
 * }
 */
export const getHabits: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // Extract userId from query parameters or request context
    const userId = event.queryStringParameters?.userId || 
                   event.requestContext.authorizer?.claims?.sub;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createErrorResponse(400, 'userId is required as a query parameter');
    }

    // Query all habits for the user
    const habits = await getHabitsByUserId(userId);

    // Transform items to remove DynamoDB keys
    const transformedHabits = habits.map((item: any) => ({
      habitId: item.habitId,
      title: item.title,
      cardHeight: item.cardHeight,
      colors: item.colors,
      progress: item.progress,
      streakCount: item.streakCount,
      lastCheckIn: item.lastCheckIn,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    console.log(`Retrieved ${transformedHabits.length} habits for user: ${userId}`);

    return createSuccessResponse({
      habits: transformedHabits,
      count: transformedHabits.length,
    });
  } catch (error) {
    console.error('Error in getHabits:', error);
    return createErrorResponse(500, 'Failed to retrieve habits');
  }
};

/**
 * Create a new habit for a user
 * POST /habits/create
 * 
 * Request body:
 * {
 *   "userId": "string",
 *   "title": "string",
 *   "cardHeight": number,
 *   "colors": {
 *     "primary": "string",
 *     "secondary": "string"
 *   }
 * }
 * 
 * Response:
 * {
 *   "habitId": "string",
 *   "title": "string",
 *   "cardHeight": number,
 *   "colors": {...},
 *   "progress": 0.0,
 *   "streakCount": 0,
 *   "lastCheckIn": null,
 *   "createdAt": "ISO8601",
 *   "updatedAt": "ISO8601"
 * }
 */
export const createHabit: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // Parse request body
    let body: CreateHabitRequest & { userId: string };
    try {
      body = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }

    // Extract userId from body or request context
    const userId = body.userId || event.requestContext.authorizer?.claims?.sub;
    const { title, cardHeight, colors } = body;

    // Validate required fields
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createErrorResponse(400, 'userId is required');
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return createErrorResponse(400, 'title is required and must be a non-empty string');
    }

    if (cardHeight === undefined || typeof cardHeight !== 'number' || cardHeight <= 0) {
      return createErrorResponse(400, 'cardHeight is required and must be a positive number');
    }

    if (!colors || typeof colors !== 'object') {
      return createErrorResponse(400, 'colors is required and must be an object');
    }

    if (!colors.primary || typeof colors.primary !== 'string') {
      return createErrorResponse(400, 'colors.primary is required');
    }

    if (!colors.secondary || typeof colors.secondary !== 'string') {
      return createErrorResponse(400, 'colors.secondary is required');
    }

    // Generate unique habitId
    const habitId = generateId();

    // Create habit in DynamoDB
    const habit = await createHabit(userId, habitId, title.trim(), cardHeight, {
      primary: colors.primary,
      secondary: colors.secondary,
    });

    console.log(`Habit created successfully: ${habitId} for user: ${userId}`);

    return createSuccessResponse({
      habitId: habit.habitId,
      title: habit.title,
      cardHeight: habit.cardHeight,
      colors: habit.colors,
      progress: habit.progress,
      streakCount: habit.streakCount,
      lastCheckIn: habit.lastCheckIn,
      createdAt: habit.createdAt,
      updatedAt: habit.updatedAt,
    }, 201);
  } catch (error) {
    console.error('Error in createHabit:', error);
    
    if (error instanceof Error && error.message.includes('ValidationException')) {
      return createErrorResponse(400, 'Invalid request format');
    }

    return createErrorResponse(500, 'Failed to create habit');
  }
};

/**
 * Check in to a habit (atomic operation with streak tracking)
 * POST /habits/check-in
 * 
 * Request body:
 * {
 *   "userId": "string",
 *   "habitId": "string"
 * }
 * 
 * Response:
 * {
 *   "habitId": "string",
 *   "progress": number,
 *   "streakCount": number,
 *   "lastCheckIn": "ISO8601",
 *   "completed": boolean,
 *   "updatedAt": "ISO8601"
 * }
 * 
 * Business Logic:
 * 1. Increment progress by 0.25
 * 2. If progress reaches 1.0, reset to 0.0 and increment streakCount
 * 3. If > 48 hours since last check-in, reset streakCount to 1
 * 4. Update lastCheckIn to current timestamp
 * 5. Use atomic UpdateCommand to prevent race conditions
 */
export const checkInHabit: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // Parse request body
    let body: CheckInRequest & { userId: string };
    try {
      body = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }

    // Extract userId from body or request context
    const userId = body.userId || event.requestContext.authorizer?.claims?.sub;
    const { habitId } = body;

    // Validate required fields
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createErrorResponse(400, 'userId is required');
    }

    if (!habitId || typeof habitId !== 'string' || habitId.trim().length === 0) {
      return createErrorResponse(400, 'habitId is required in request body');
    }

    // Perform atomic check-in update
    const updatedHabit = await updateHabitCheckIn(userId, habitId);

    if (!updatedHabit) {
      return createErrorResponse(404, 'Habit not found');
    }

    // Check if habit is completed (progress was reset to 0.0)
    const isCompleted = updatedHabit.progress === 0.0;

    console.log(`Check-in successful for habit: ${habitId}, user: ${userId}, streak: ${updatedHabit.streakCount}`);

    return createSuccessResponse({
      habitId: updatedHabit.habitId,
      progress: updatedHabit.progress,
      streakCount: updatedHabit.streakCount,
      lastCheckIn: updatedHabit.lastCheckIn,
      completed: isCompleted,
      updatedAt: updatedHabit.updatedAt,
    });
  } catch (error) {
    console.error('Error in checkInHabit:', error);

    if (error instanceof Error) {
      if (error.message.includes('Habit not found')) {
        return createErrorResponse(404, 'Habit not found');
      }
      if (error.message.includes('ValidationException')) {
        return createErrorResponse(400, 'Invalid request format');
      }
    }

    return createErrorResponse(500, 'Failed to check in to habit');
  }
};

/**
 * Handle CORS preflight requests
 */
export const options: APIGatewayProxyHandlerV2 = async (event) => {
  return createSuccessResponse(null);
};
