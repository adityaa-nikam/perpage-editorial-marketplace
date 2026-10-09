import { S3Client } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
dotenv.config();

export const bucketName = 'perpagedb';

export const s3Client = new S3Client({
  region: 'eu-north-1',
  endpoint: 'https://s3.eu-north-1.amazonaws.com',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});
