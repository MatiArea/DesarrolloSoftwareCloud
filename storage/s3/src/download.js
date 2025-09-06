import { GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import { s3 } from "./s3Client.js";

export async function descargarArchivo(bucketName, key, downloadPath) {
	try {
		const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
		const response = await s3.send(command);

		const writable = fs.createWriteStream(downloadPath);
		response.Body.pipe(writable);

		console.log(`✅ Archivo descargado en ${downloadPath}`);
	} catch (err) {
		console.error("❌ Error al descargar:", err);
	}
}
