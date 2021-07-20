import {Server} from "socket.io";
import io from "socket.io-client";

const server = new Server();
server.of('/test').on('connection', socket => {
	console.log('test');
	socket.emit('test');
});
server.listen(3000);

const client = io('http://localhost:3000/test');
client.on('test', () => {
	console.log("TEST");
});
