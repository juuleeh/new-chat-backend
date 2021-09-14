const express = require("express");
const app = express();
const socket = require("socket.io");
const colors = require("colors");
const multer = require("multer");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "uploads/")
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname)
    },
})

const uploadStorage = multer({ storage: storage })

app.post("/upload", uploadStorage.single("photo"), (req, res) => {
    console.log(req.file)
    return res.send("Single file")
});

const port = 8000;

var server = app.listen(
    port,
    console.log(
        `Server is running on port ${port}`
        .yellow.bold
    )
);

const io = socket(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

var users = {}

function createRoom(id, userName, roomId) {
    
    console.log(`New room ${roomId} created by ${userName}`.green);
    return joinRoom(id, userName, roomId);
}

function joinRoom(id, userName, roomId) {
    const user = { userName, roomId };
    users[id] = user;
    console.log(`New user ${userName} in room ${roomId}`.blue);
    console.log(users);
    return user;
}

function leaveRoom(id) {

    if(id in users) {
        io.to(users[id].roomId).emit("message", {
            type: "notification",
            text: `${users[id].userName} вышел`
        });
        console.log(`User ${users[id].userName} left from room ${users[id].roomId}`.red);
        delete users[id];
        console.log(users);
    }
}

io.on("connection", (socket) => {

    socket.on("createRoom", ({ userName, roomId }) => {

        if(io.sockets.adapter.rooms.get(roomId)) {

            socket.emit("error", "Комната с таким идентификатором уже существует!");
        
        } else if(socket.id in users) {

            socket.emit("error", "Вы уже находитесь в комнате!");
        
        } else {

            const user = createRoom(socket.id, userName, roomId);
            socket.join(user.roomId);
            socket.emit("connected");
            io.to(user.roomId).emit("message", {
                type: "notification",
                text: `${user.userName} присоединился`
            });
        }

    });

    socket.on("joinRoom", ({ userName, roomId }) => {

        if(!io.sockets.adapter.rooms.get(roomId)) {

            socket.emit("error", "Комнаты с таким идентификатором не существует!");

        } else if(socket.id in users) {

            socket.emit("error", "Вы уже находитесь в комнате!");

        } else {

            let userAlreadyExists = false;

            io.sockets.adapter.rooms.get(roomId).forEach((user) => {
                if(users[user].userName == userName) {
                    socket.emit("error", "Пользователь с таким именем уже находится в комнате!")
                    userAlreadyExists = true;
                }
            })

            if(!userAlreadyExists) {

                const user = joinRoom(socket.id, userName, roomId);
                socket.join(user.roomId);
                socket.emit("connected");
                io.to(user.roomId).emit("message", {
                    type: "notification",
                    text: `${user.userName} присоединился`
                });

            }

        }

    });

    socket.on("message", (text) => {

        if(socket.id in users) {

            const user = users[socket.id];

            io.to(user.roomId).emit("message", {
                type: "message",
                userName: user.userName,
                text: text,
            });

        }

    });

    socket.on("disconnect", () => {

        leaveRoom(socket.id);

    });

})