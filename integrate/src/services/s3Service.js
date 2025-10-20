import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

/**
 * Servicio para operaciones con Amazon S3
 */
export class S3Service {
    constructor(bucketName) {
        this.bucketName = bucketName;
    }

    /**
     * Subir archivo a S3
     */
    async uploadFile(fileName, fileContent, contentType = 'application/octet-stream', metadata = {}) {
        try {
            const key = `${metadata.folder || 'uploads'}/${uuidv4()}_${fileName}`;

            const params = {
                Bucket: this.bucketName,
                Key: key,
                Body: fileContent,
                ContentType: contentType,
                Metadata: {
                    originalName: fileName,
                    uploadedAt: new Date().toISOString(),
                    ...metadata
                }
            };

            const result = await s3Client.send(new PutObjectCommand(params));

            return {
                success: true,
                key: key,
                etag: result.ETag,
                location: `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
                metadata: params.Metadata
            };
        } catch (error) {
            console.error('Error subiendo archivo a S3:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Descargar archivo de S3
     */
    async downloadFile(key) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: key
            };

            const result = await s3Client.send(new GetObjectCommand(params));

            // Convertir stream a buffer
            const chunks = [];
            for await (const chunk of result.Body) {
                chunks.push(chunk);
            }
            const fileContent = Buffer.concat(chunks);

            return {
                success: true,
                content: fileContent,
                contentType: result.ContentType,
                metadata: result.Metadata,
                lastModified: result.LastModified,
                size: result.ContentLength
            };
        } catch (error) {
            console.error('Error descargando archivo de S3:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Listar archivos en S3
     */
    async listFiles(prefix = '', maxKeys = 100) {
        try {
            const params = {
                Bucket: this.bucketName,
                Prefix: prefix,
                MaxKeys: maxKeys
            };

            const result = await s3Client.send(new ListObjectsV2Command(params));

            const files = result.Contents?.map(item => ({
                key: item.Key,
                size: item.Size,
                lastModified: item.LastModified,
                etag: item.ETag
            })) || [];

            return {
                success: true,
                files: files,
                isTruncated: result.IsTruncated,
                nextContinuationToken: result.NextContinuationToken
            };
        } catch (error) {
            console.error('Error listando archivos de S3:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Eliminar archivo de S3
     */
    async deleteFile(key) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: key
            };

            await s3Client.send(new DeleteObjectCommand(params));

            return {
                success: true,
                message: `Archivo ${key} eliminado exitosamente`
            };
        } catch (error) {
            console.error('Error eliminando archivo de S3:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generar URL firmada para acceso temporal
     */
    async generatePresignedUrl(key, expiresIn = 3600) {
        try {
            const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
            const { GetObjectCommand } = await import('@aws-sdk/client-s3');

            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            const url = await getSignedUrl(s3Client, command, { expiresIn });

            return {
                success: true,
                url: url,
                expiresIn: expiresIn
            };
        } catch (error) {
            console.error('Error generando URL firmada:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Subir archivo JSON
     */
    async uploadJsonFile(fileName, data, folder = 'data') {
        const jsonContent = JSON.stringify(data, null, 2);
        return await this.uploadFile(
            `${fileName}.json`,
            jsonContent,
            'application/json',
            { folder: folder, type: 'json' }
        );
    }

    /**
     * Subir archivo de texto
     */
    async uploadTextFile(fileName, text, folder = 'text') {
        return await this.uploadFile(
            fileName,
            text,
            'text/plain',
            { folder: folder, type: 'text' }
        );
    }

    /**
     * Obtener metadatos de archivo
     */
    async getFileMetadata(key) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: key
            };

            const result = await s3Client.send(new GetObjectCommand(params));

            return {
                success: true,
                metadata: {
                    key: key,
                    contentType: result.ContentType,
                    lastModified: result.LastModified,
                    size: result.ContentLength,
                    etag: result.ETag,
                    metadata: result.Metadata
                }
            };
        } catch (error) {
            console.error('Error obteniendo metadatos de archivo:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
