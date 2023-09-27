const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const express = require("express");

const app = express();
app.use(cors());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: true,
  },
});

const connectedUsers = {}; // Use an object to store usernames by socket ID

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Join lobby
  socket.on("join", (lobbyId, username) => {
    try {
      socket.join(lobbyId);
      // add the user to the connected users list
      connectedUsers[socket.id] = { username, lobbyId };

      // Send connected user to the client
      console.log(
        `${username} joined room - ${lobbyId} ${new Date(
          Date.now()
        ).toLocaleString()}`
      );
      socket.to(lobbyId).emit("user-connected", connectedUsers[socket.id]);

      // Send the list of connected users to the client
      socket.emit("connected-users", Object.values(connectedUsers));
    } catch (e) {
      console.error(e);
    }
  });

  // Handle disconnect event and remove the user from the list
  socket.on("disconnect", () => {
    const user = connectedUsers[socket.id];
    if (user) {
      console.log(`${user.username} disconnected`);
      delete connectedUsers[socket.id];
      socket.to(user.lobbyId).emit("user-disconnected", user);
    }
  });

  // Handle start game event and notify all users in the lobby
  socket.on("start-game", (lobbyId) => {
    console.log("Starting game socket");

    const usersInLobby = Object.values(connectedUsers).filter(
      (user) => user.lobbyId === lobbyId
    );

    usersInLobby.forEach((user, index) => {
      if (index === 0) {
        user.paddle = "left";
      } else if (index === 1) {
        user.paddle = "right";
      }
    });

    // Update the users in the lobby with their paddle assignments
    usersInLobby.forEach((user) => {
      // Save changes to connectedUsers object
      connectedUsers[socket.id] = user;
    });

    // Send the start game event to all users in the lobby
    io.in(lobbyId).emit("game-started", usersInLobby);
  });

  socket.on("get-assigned-users", (lobbyId) => {
    console.log("Connected users: ", connectedUsers);

    // Return the users in the lobby with their paddle assignments
    const usersInLobby = Object.values(connectedUsers).filter((user) => {
      console.log(user);
      return user.lobbyId === lobbyId;
    });

    socket.to(lobbyId).emit("assigned-users", usersInLobby);
  });

  // Handle paddle movement event and update the user from the list
  socket.on("move-paddle", (lobbyId, username, paddleY) => {
    const user = connectedUsers[socket.id];
    if (user) {
      console.log(
        `${username} moved ${user.paddle} paddle to ${paddleY} in lobby ${lobbyId}`
      );
      // Update the user's paddle position
      user.paddleY = paddleY;

      // Save changes to connectedUsers object
      connectedUsers[socket.id] = user;

      // Send the updated user to the client
      socket.to(lobbyId).emit("paddle-moved", user);
    }
  });
});

httpServer.listen(3001, () => {
  console.log("Socket.io server listening on port 3001");
});
