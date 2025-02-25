import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ServiceException } from "@aws-sdk/smithy-client";

let client: DynamoDBClient;
try {
  console.log('Initializing DynamoDB client with:', {
    region: process.env.EXPO_PUBLIC_AWS_REGION,
    tableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
    hasAccessKey: !!process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY
  });
  
  client = new DynamoDBClient({
    region: process.env.EXPO_PUBLIC_AWS_REGION,
    credentials: {
      accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    },
  });
} catch (error: unknown) {
  console.error('Failed to initialize DynamoDB client:', error);
  throw error;
}

export const docClient = DynamoDBDocumentClient.from(client);

export interface CalendarEvent {
  userId: string;
  eventId: string;
  courseCode?: string;
  courseTitle?: string;
  createdAt: string;
  date?: string;
  description?: string;
  id?: string;
  location?: string;
  priority?: string;
  selected?: string;
  time?: string;
  title: string;
  type?: string;
  updatedAt: string;
}

export async function saveEvent(event: CalendarEvent) {
  const command = new PutCommand({
    TableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
    Item: event,
  });

  await docClient.send(command);
}

async function verifyTableExists() {
  try {
    const command = new QueryCommand({
      TableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": "test",
      },
      Limit: 1
    });
    await docClient.send(command);
    return true;
  } catch (error: unknown) {
    if (error instanceof ServiceException && error.name === 'ResourceNotFoundException') {
      console.error(`DynamoDB table '${process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME}' not found. Please create the table with:
        - Partition key: userId (String)
        - Sort key: eventId (String)`);
    }
    throw error;
  }
}

export async function getEvents(userId: string) {
  await verifyTableExists();
  const command = new QueryCommand({
    TableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
  });

  try {
    const response = await docClient.send(command);
    return response.Items as CalendarEvent[];
  } catch (error: unknown) {
    console.error('DynamoDB Error:', {
      error,
      tableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
      region: process.env.EXPO_PUBLIC_AWS_REGION
    });
    throw error;
  }
}

export async function deleteEvent(userId: string, eventId: string) {
  const command = new DeleteCommand({
    TableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
    Key: {
      userId,
      eventId,
    },
  });

  await docClient.send(command);
}

export async function deleteAllEvents(userId: string) {
  const events = await getEvents(userId);
  
  // DynamoDB doesn't support batch deletes directly, so we need to delete one by one
  await Promise.all(
    events.map(event => deleteEvent(userId, event.eventId))
  );
}
