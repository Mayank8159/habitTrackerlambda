import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  createSuccessResponse,
  createErrorResponse,
  generateId,
  getHabitsByUserId,
  createHabit as createHabitInDb,
  updateHabitCheckIn,
  deleteHabit as deleteHabitFromDb,
  updateHabit as updateHabitInDb,
} from '../utils/dynamodb';
import type { CreateHabitRequest, CheckInRequest } from '../types';

/**
 * Get all habits for a user
 * GET /habits?userId=<userId>
 */
export const getHabits: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId || 
                   (event as any).requestContext?.authorizer?.claims?.sub;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createErrorResponse(400, 'userId is required as a query parameter');
    }

    const habits = await getHabitsByUserId(userId);

    const transformedHabits = habits.map((item: any) => ({
      habitId: item.habitId,
      title: item.title,
      cardHeight: item.cardHeight,
      colors: item.colors,
      progress: item.progress ?? 0.0,
      streakCount: item.streakCount ?? 0,
      lastCheckIn: item.lastCheckIn ?? null,
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
 */
export const createHabit: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    let body: CreateHabitRequest & { userId: string };
    try {
      body = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }

    const userId = body.userId || (event as any).requestContext?.authorizer?.claims?.sub;
    const { title, cardHeight, colors } = body;

    // Payload Validations
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

    const habitId = generateId();

    // Call DB utility layer
    const habit = await createHabitInDb(userId, habitId, title.trim(), cardHeight, {
      primary: colors.primary,
      secondary: colors.secondary,
    });

    console.log(`DB layer completed item configuration for habitId: ${habitId}`);

    // CRITICAL DEPLOYED RECOVERY PATTERN: If the DB utility pipeline drops the returned values,
    // construct an explicit structural item from initial arguments to guarantee payload delivery.
    const reliableResponse = {
      habitId: habit?.habitId || habitId,
      title: habit?.title || title.trim(),
      cardHeight: habit?.cardHeight || cardHeight,
      colors: habit?.colors || { primary: colors.primary, secondary: colors.secondary },
      progress: habit?.progress ?? 0.0,
      streakCount: habit?.streakCount ?? 0,
      lastCheckIn: habit?.lastCheckIn ?? null,
      createdAt: habit?.createdAt || new Date().toISOString(),
      updatedAt: habit?.updatedAt || new Date().toISOString(),
    };

    console.log(`Habit created successfully: ${reliableResponse.habitId} for user: ${userId}`);

    return createSuccessResponse(reliableResponse, 201);
  } catch (error) {
    console.error('Fatal execution exception inside createHabit handler:', error);
    
    if (error instanceof Error && error.message.includes('ValidationException')) {
      return createErrorResponse(400, 'Invalid request format matching database limits');
    }

    return createErrorResponse(500, `Failed to create habit: ${(error as Error).message}`);
  }
};

/**
 * Check in to a habit (atomic operation with streak tracking)
 * POST /habits/check-in
 */
export const checkInHabit: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    let body: CheckInRequest & { userId: string };
    try {
      body = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }

    const userId = body.userId || (event as any).requestContext?.authorizer?.claims?.sub;
    const { habitId } = body;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createErrorResponse(400, 'userId is required');
    }
    if (!habitId || typeof habitId !== 'string' || habitId.trim().length === 0) {
      return createErrorResponse(400, 'habitId is required in request body');
    }

    const updatedHabit = await updateHabitCheckIn(userId, habitId);

    if (!updatedHabit || Object.keys(updatedHabit).length === 0) {
      return createErrorResponse(404, 'Habit item not found or modification constraints failed');
    }

    const isCompleted = updatedHabit.progress === 0.0 || updatedHabit.progress === undefined;

    return createSuccessResponse({
      habitId: updatedHabit.habitId || habitId,
      progress: updatedHabit.progress ?? 0.0,
      streakCount: updatedHabit.streakCount ?? 0,
      lastCheckIn: updatedHabit.lastCheckIn ?? null,
      completed: isCompleted,
      updatedAt: updatedHabit.updatedAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in checkInHabit handler:', error);

    if (error instanceof Error) {
      if (error.message.includes('Habit not found')) {
        return createErrorResponse(404, 'Habit item location targets missing');
      }
      if (error.message.includes('ValidationException')) {
        return createErrorResponse(400, 'Invalid attribute schema type matching schema parameters');
      }
    }

    return createErrorResponse(500, 'Failed to complete task check-in sequence');
  }
};

export const options: APIGatewayProxyHandlerV2 = async (_event) => {
  return createSuccessResponse(null);
};

/**
 * Patch habit metadata (title, cardHeight, colors)
 * PATCH /habits/{habitId}
 */
export const patchHabit: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    let body: any = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (err) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }

    const userId = body.userId || event.queryStringParameters?.userId || (event as any).requestContext?.authorizer?.claims?.sub;
    const habitId = event.pathParameters?.habitId || body.habitId;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createErrorResponse(400, 'userId is required');
    }
    if (!habitId || typeof habitId !== 'string' || habitId.trim().length === 0) {
      return createErrorResponse(400, 'habitId is required (path param or body)');
    }

    const updates: any = {};
    if (body.title && typeof body.title === 'string') updates.title = body.title.trim();
    if (body.cardHeight !== undefined && typeof body.cardHeight === 'number') updates.cardHeight = body.cardHeight;
    if (body.colors && typeof body.colors === 'object') updates.colors = body.colors;

    if (Object.keys(updates).length === 0) {
      return createErrorResponse(400, 'No updatable fields provided');
    }

    const updated = await updateHabitInDb(userId, habitId, updates);
    if (!updated) return createErrorResponse(404, 'Habit reference targets missing');

    return createSuccessResponse(updated);
  } catch (error) {
    console.error('Error in patchHabit handler:', error);
    return createErrorResponse(500, 'Failed to update habit information properties');
  }
};

/**
 * Delete a habit
 * DELETE /habits/{habitId}
 */
export const deleteHabit: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    let parsedBody: any = {};
    if (event.body) {
      try {
        parsedBody = JSON.parse(event.body);
      } catch {
        // Fallback if payload isn't rigid JSON structure
      }
    }

    const userId = event.queryStringParameters?.userId || 
                   (event as any).requestContext?.authorizer?.claims?.sub || 
                   parsedBody.userId;
                   
    const habitId = event.pathParameters?.habitId || parsedBody.habitId;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createErrorResponse(400, 'userId configuration string validation failed');
    }
    if (!habitId || typeof habitId !== 'string' || habitId.trim().length === 0) {
      return createErrorResponse(400, 'habitId path target tracking configuration validation failed');
    }

    await deleteHabitFromDb(userId, habitId);

    return createSuccessResponse({ success: true });
  } catch (error) {
    console.error('Error in deleteHabit processing stream:', error);
    return createErrorResponse(500, 'Failed to eliminate habit partition trace');
  }
};