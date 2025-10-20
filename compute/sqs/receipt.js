import { DeleteMessageCommand, ReceiveMessageCommand } from "@aws-sdk/client-sqs";

import { client } from "./index.js";

// Reutilizamos el mismo cliente creado antes
const receiveParams = {
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/123456789012/cloud2025",
    MaxNumberOfMessages: 1, // Leer de a un mensaje
    WaitTimeSeconds: 5, // Long polling
};

const consumeMessage = async () => {
    try {
        const result = await client.send(new ReceiveMessageCommand(receiveParams));

        if (result.Messages) {
            for (const msg of result.Messages) {
                console.log("Mensaje recibido:", msg.Body);

                // Eliminamos el mensaje después de procesarlo correctamente
                await client.send(
                    new DeleteMessageCommand({
                        QueueUrl: receiveParams.QueueUrl,
                        ReceiptHandle: msg.ReceiptHandle,
                    })
                );
                console.log("Mensaje eliminado de la cola");
            }
        } else {
            console.log("No hay mensajes en la cola");
        }
    } catch (error) {
        console.error("Error recibiendo mensajes:", error);
    }
};

consumeMessage();
