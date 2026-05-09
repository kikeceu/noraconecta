import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export class R2Client {
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;
  private readonly accountId: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      throw new Error(
        'Missing R2 environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL',
      );
    }

    this.accountId = accountId;
    this.bucketName = bucketName;
    this.publicUrl = publicUrl.replace(/\/$/, '');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  generatePresignedUpload(
    folder: string,
    filename: string,
    contentType: string,
    expiresInSeconds = 3600,
  ): Promise<PresignedUploadResult> {
    const extension = this.extractExtension(filename);
    const uuid = randomUUID();
    const safeFilename = extension ? `${uuid}.${extension}` : uuid;
    const key = `${folder.replace(/^\/+|\/+$/g, '')}/${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    }).then((uploadUrl) => ({
      uploadUrl,
      publicUrl: `${this.publicUrl}/${key}`,
      key,
    }));
  }

  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ key: string; publicUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);

    return {
      key,
      publicUrl: `${this.publicUrl}/${key}`,
    };
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.client.send(command);
  }

  private extractExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) {
      return '';
    }
    return filename.substring(lastDot + 1).toLowerCase();
  }
}
