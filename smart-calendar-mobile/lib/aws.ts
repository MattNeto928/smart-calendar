import AWS from 'aws-sdk/dist/aws-sdk-react-native';

let dynamoDB: AWS.DynamoDB.DocumentClient;
let s3: AWS.S3;
try {
  console.log('Initializing DynamoDB client with:', {
    region: process.env.EXPO_PUBLIC_AWS_REGION,
    tableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
    hasAccessKey: !!process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY
  });
  
  AWS.config.update({
    region: process.env.EXPO_PUBLIC_AWS_REGION,
    credentials: new AWS.Credentials({
      accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY!,
      dynamoDbCrc32: false,
    }),
  });

  dynamoDB = new AWS.DynamoDB.DocumentClient({
    service: new AWS.DynamoDB({ dynamoDbCrc32: false })
  });

  s3 = new AWS.S3({
    region: process.env.EXPO_PUBLIC_AWS_REGION,
    credentials: new AWS.Credentials({
      accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    }),
  });
} catch (error: unknown) {
  console.error('Failed to initialize DynamoDB client:', error);
  throw error;
}

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
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
}

export async function uploadFile(userId: string, eventId: string, file: { uri: string, name: string, type: string }) {
  try {
    const key = `${userId}/${eventId}/${file.name}`;
    const response = await fetch(file.uri);
    const blob = await response.blob();
    
    const params = {
      Bucket: process.env.EXPO_PUBLIC_S3_BUCKET_NAME!,
      Key: key,
      Body: blob,
      ContentType: file.type,
    };

    await s3.upload(params).promise();

    const url = `https://${process.env.EXPO_PUBLIC_S3_BUCKET_NAME}.s3.${process.env.EXPO_PUBLIC_AWS_REGION}.amazonaws.com/${key}`;
    return {
      name: file.name,
      url,
      type: file.type
    };
  } catch (error) {
    console.error('Failed to upload file:', error);
    throw error;
  }
}

export async function saveEvent(event: CalendarEvent) {
  const params = {
    TableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
    Item: event,
  };

  await dynamoDB.put(params).promise();
}

async function verifyTableExists() {
  try {
    const params = {
      TableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME!,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": "test",
      },
      Limit: 1
    };
    await dynamoDB.query(params).promise();
    return true;
  } catch (error: any) {
    if (error.code === 'ResourceNotFoundException') {
      console.error(`DynamoDB table '${process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME}' not found. Please create the table with:
        - Partition key: userId (String)
        - Sort key: eventId (String)`);
    }
    throw error;
  }
}

export async function getEvents(userId: string) {
  await verifyTableExists();
  const params = {
    TableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
  };

  try {
    const response = await dynamoDB.query(params).promise();
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
  const params = {
    TableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
    Key: {
      userId,
      eventId,
    },
  };

  await dynamoDB.delete(params).promise();
}

export async function updateEvent(eventId: string, eventDetails: Partial<CalendarEvent>) {
  if (!eventDetails.userId) {
    throw new Error('userId is required for updating an event');
  }

  // Create the update expression and attribute values
  let updateExpression = 'SET ';
  const expressionAttributeValues: Record<string, any> = {};
  const expressionAttributeNames: Record<string, string> = {};

  // Add updatedAt timestamp
  updateExpression += '#updatedAt = :updatedAt, ';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  expressionAttributeNames['#updatedAt'] = 'updatedAt';

  // Add all other fields to the update expression
  Object.entries(eventDetails).forEach(([key, value]) => {
    // Skip userId and eventId as they are part of the key
    if (key !== 'userId' && key !== 'eventId') {
      const attributeName = `#${key}`;
      const attributeValue = `:${key}`;
      
      updateExpression += `${attributeName} = ${attributeValue}, `;
      expressionAttributeValues[attributeValue] = value;
      expressionAttributeNames[attributeName] = key;
    }
  });

  // Remove trailing comma and space
  updateExpression = updateExpression.slice(0, -2);

  const params = {
    TableName: process.env.EXPO_PUBLIC_DYNAMODB_TABLE_NAME,
    Key: {
      userId: eventDetails.userId,
      eventId: eventId,
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames,
    ReturnValues: 'UPDATED_NEW'
  };

  try {
    await dynamoDB.update(params).promise();
  } catch (error) {
    console.error('Failed to update event:', error);
    throw error;
  }
}

export async function deleteAllEvents(userId: string) {
  const events = await getEvents(userId);
  
  // DynamoDB doesn't support batch deletes directly, so we need to delete one by one
  await Promise.all(
    events.map(event => deleteEvent(userId, event.eventId))
  );
}
