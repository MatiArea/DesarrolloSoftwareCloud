// Evento de ejemplo
// {
//     "Records": [
//       {
//         "messageId": "1",
//         "body": "{\"pedidoId\":101,\"producto\":\"Notebook\",\"cantidad\":1}"
//       }
//     ]
// }


export const handler = async (event) => {
    for (const record of event.Records) {
        const mensaje = JSON.parse(record.body);
        console.log("Procesando pedido:", mensaje);

        // Ejemplo: guardar en base de datos
        await saveToDatabase(mensaje);

        console.log("Pedido procesado con éxito:", mensaje.pedidoId);
    }

    return {
        statusCode: 200,
        body: "Mensajes procesados"
    };
};
