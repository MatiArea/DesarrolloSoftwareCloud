import { descargarArchivo } from "./download.js";
import dotenv from "dotenv";
import inquirer from "inquirer";
import { listarObjetos } from "./list.js";
import { subirArchivo } from "./upload.js";

dotenv.config();

const bucketName = process.env.AWS_BUCKET_NAME;

async function mainMenu() {
	const { action } = await inquirer.prompt([
		{
			type: "list",
			name: "action",
			message: "¿Qué querés hacer?",
			choices: ["📂 Listar archivos", "📤 Subir archivo", "📥 Descargar archivo", "❌ Salir"],
		},
	]);

	switch (action) {
		case "📂 Listar archivos":
			await listarObjetos(bucketName);
			break;

		case "📤 Subir archivo":
			const { filePath, key } = await inquirer.prompt([
				{ type: "input", name: "filePath", message: "Ruta local del archivo:" },
				{ type: "input", name: "key", message: "Nombre/ruta en S3:" },
			]);
			await subirArchivo(bucketName, filePath, key);
			break;

		case "📥 Descargar archivo":
			const { s3Key, downloadPath } = await inquirer.prompt([
				{ type: "input", name: "s3Key", message: "Ruta del archivo en S3:" },
				{ type: "input", name: "downloadPath", message: "Ruta destino local:" },
			]);
			await descargarArchivo(bucketName, s3Key, downloadPath);
			break;

		case "❌ Salir":
			console.log("👋 Saliendo...");
			process.exit(0);
	}

	await mainMenu();
}

mainMenu();
