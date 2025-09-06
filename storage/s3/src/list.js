import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3 } from "./s3Client.js";

export async function listarObjetos(bucketName) {
	try {
		const command = new ListObjectsV2Command({ Bucket: bucketName });
		const response = await s3.send(command);

		if (response.Contents) {
			console.log("\n📂 Archivos en el bucket:");
			response.Contents.forEach((obj) => console.log(`- ${obj.Key}`));
		} else {
			console.log("El bucket está vacío.");
		}
	} catch (err) {
		console.error("❌ Error al listar:", err);
	}
}
