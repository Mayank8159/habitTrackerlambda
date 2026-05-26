export interface User {
  userId: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  habitId: string;
  title: string;
  cardHeight: number;
  colors: {
    primary: string;
    secondary: string;
  };
  progress: number; // 0.0 to 1.0
  streakCount: number;
  lastCheckIn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DynamoDBItem {
  PK: string;
  SK: string;
  [key: string]: any;
}

export interface CheckInRequest {
  habitId: string;
}

export interface CreateHabitRequest {
  title: string;
  cardHeight: number;
  colors: {
    primary: string;
    secondary: string;
  };
}

export interface RegisterUserRequest {
  username: string;
  email: string;
}

export interface APIResponse {
  statusCode: number;
  headers: {
    [key: string]: string;
  };
  body: string;
}
