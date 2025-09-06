import { PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import { s3 } from "./s3Client.js";

export async function subirArchivo(bucketName, filePath, key) {
	try {
		const fileStream = fs.createReadStream(filePath);

		const uploadParams = {
			Bucket: bucketName,
			Key: key,
			Body: fileStream,
		};

		const command = new PutObjectCommand(uploadParams);
		await s3.send(command);

		console.log(`✅ Archivo subido a s3://${bucketName}/${key}`);
	} catch (err) {
		console.error("❌ Error al subir:", err);
	}
}
