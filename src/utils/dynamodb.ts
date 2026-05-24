import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
export const dynamodbClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

export const HABITS_TABLE = process.env.HABITS_TABLE || 'HabitsTable';

/**
 * Generates a unique ID using crypto
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Generates a UUID using crypto
 */
export function generateUserId(): string {
  const chars = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return chars.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a CORS-enabled response
 */
export function createSuccessResponse(data: any, statusCode: number = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(data),
  };
}

/**
 * Create a CORS-enabled error response
 */
export function createErrorResponse(statusCode: number, message: string) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify({
      error: message,
      statusCode,
      timestamp: new Date().toISOString(),
    }),
  };
}

/**
 * Get a user by userId
 */
export async function getUserById(userId: string) {
  try {
    const result = await dynamodbClient.send(
      new GetCommand({
        TableName: HABITS_TABLE,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
        },
      })
    );
    return result.Item;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
}

/**
 * Get a user by username
 */
export async function getUserByUsername(username: string) {
  try {
    const result = await dynamodbClient.send(
      new QueryCommand({
        TableName: HABITS_TABLE,
        IndexName: 'usernameIndex',
        KeyConditionExpression: 'username = :username',
        ExpressionAttributeValues: {
          ':username': username,
        },
      })
    );
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  } catch (error) {
    console.error('Error getting user by username:', error);
    throw error;
  }
}

/**
 * Create a new user
 */
export async function createUser(userId: string, username: string, email: string) {
  try {
    const now = new Date().toISOString();
    await dynamodbClient.send(
      new PutCommand({
        TableName: HABITS_TABLE,
        Item: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
          userId,
          username,
          email,
          createdAt: now,
          updatedAt: now,
        },
      })
    );
    return { userId, username, email, createdAt: now, updatedAt: now };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

/**
 * Get all habits for a user
 */
export async function getHabitsByUserId(userId: string) {
  try {
    const result = await dynamodbClient.send(
      new QueryCommand({
        TableName: HABITS_TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'HABIT#',
        },
      })
    );
    return result.Items || [];
  } catch (error) {
    console.error('Error getting habits:', error);
    throw error;
  }
}

/**
 * Create a new habit
 */
export async function createHabit(userId: string, habitId: string, title: string, cardHeight: number, colors: any) {
  try {
    const now = new Date().toISOString();
    await dynamodbClient.send(
      new PutCommand({
        TableName: HABITS_TABLE,
        Item: {
          PK: `USER#${userId}`,
          SK: `HABIT#${habitId}`,
          habitId,
          title,
          cardHeight,
          colors,
          progress: 0.0,
          streakCount: 0,
          lastCheckIn: null,
          createdAt: now,
          updatedAt: now,
        },
      })
    );
    return { habitId, title, cardHeight, colors, progress: 0.0, streakCount: 0, lastCheckIn: null, createdAt: now, updatedAt: now };
  } catch (error) {
    console.error('Error creating habit:', error);
    throw error;
  }
}

/**
 * Get a specific habit
 */
export async function getHabit(userId: string, habitId: string) {
  try {
    const result = await dynamodbClient.send(
      new GetCommand({
        TableName: HABITS_TABLE,
        Key: {
          PK: `USER#${userId}`,
          SK: `HABIT#${habitId}`,
        },
      })
    );
    return result.Item;
  } catch (error) {
    console.error('Error getting habit:', error);
    throw error;
  }
}

/**
 * Update habit with atomic check-in logic
 */
export async function updateHabitCheckIn(userId: string, habitId: string) {
  try {
    // Get current habit state
    const habit = await getHabit(userId, habitId);
    if (!habit) {
      throw new Error('Habit not found');
    }

    const now = new Date();
    const currentProgress = habit.progress || 0;
    const currentStreak = habit.streakCount || 0;
    const lastCheckIn = habit.lastCheckIn;

    // Check if 48 hours have passed since last check-in (streak broken logic)
    let streakAfterReset = currentStreak;
    if (lastCheckIn) {
      const lastCheckInDate = new Date(lastCheckIn);
      const hoursSinceLastCheckIn = (now.getTime() - lastCheckInDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastCheckIn > 48) {
        streakAfterReset = 1;
      }
    }

    // Increment progress by 0.25
    let newProgress = currentProgress + 0.25;
    let newStreakCount = streakAfterReset;

    // If progress reaches 1.0, reset it and increment streak
    if (newProgress >= 1.0) {
      newProgress = 0.0;
      newStreakCount = streakAfterReset + 1;
    }

    // Perform atomic update using UpdateCommand
    const result = await dynamodbClient.send(
      new UpdateCommand({
        TableName: HABITS_TABLE,
        Key: {
          PK: `USER#${userId}`,
          SK: `HABIT#${habitId}`,
        },
        UpdateExpression: 'SET #progress = :progress, #streakCount = :streakCount, #lastCheckIn = :lastCheckIn, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#progress': 'progress',
          '#streakCount': 'streakCount',
          '#lastCheckIn': 'lastCheckIn',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':progress': newProgress,
          ':streakCount': newStreakCount,
          ':lastCheckIn': now.toISOString(),
          ':updatedAt': now.toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    return result.Attributes;
  } catch (error) {
    console.error('Error updating habit check-in:', error);
    throw error;
  }
}

/**
 * Delete a habit
 */
export async function deleteHabit(userId: string, habitId: string) {
  try {
    await dynamodbClient.send(
      new DeleteCommand({
        TableName: HABITS_TABLE,
        Key: {
          PK: `USER#${userId}`,
          SK: `HABIT#${habitId}`,
        },
      })
    );
    return { success: true };
  } catch (error) {
    console.error('Error deleting habit:', error);
    throw error;
  }
}
