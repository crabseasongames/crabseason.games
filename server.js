const path = require("path"),
  express = require("express"),
  app = express(),
  expressWs = require("express-ws")(app);

const WsResponse = (type, body) => {
  const res = {
    type: type,
    data: body
  };
  return JSON.stringify(res);
};

const WsError = (errorType, str) => {
  return WsResponse("error", {
    type: errorType,
    description: str
  });
};

const ParseError = (str) => {
  return WsError("ParseError", `Unable to parse: ${str}`);
};

const RouterError = (type) => {
  return WsError("RouterError", `Unknown message type: ${type}`);
};

const users = {};

const Router = {
  listUsers: (conn, str) => {
    console.log(Object.keys(users).join(", "));
    conn.send(WsResponse("users", Object.keys(users)));
  },
  register: (conn, id) => {
    if (users[id]) {
      users[id].connection.close();
    }
    users[id] = {
      connection: conn
    };
    conn.send(WsResponse("registered", Object.keys(users)));
    conn["__userId"] = id;
    updateUsers();
  },
  broadcast: (conn, message) => {
    for (id in users) {
      users[id].connection.send(WsResponse("peerMessage", {
        id: conn["__userId"],
        message: message
      }));
    }
  },
  ping: (conn) => {
    conn.send(WsResponse("pong"));
  }
};

function updateUsers() {
  for (id in users) {
    users[id].connection.send(WsResponse("peers", Object.keys(users)));
  }
}

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "static")));

app.ws("/", (ws, req) => {
  console.log("got websocket connection");

  ws.on("message", (messageString) => {
    let message;
    try {
      message = JSON.parse(messageString);
    } catch (e) {
      ws.send(ParseError(messageString));
    }
    if (message) {
      if (Router[message.type]) {
        Router[message.type](ws, message.data);
      } else {
        ws.send(RouterError(message.type));
      }
    }
  });

  ws.on("close", (event) => {
    console.log(`websocket connection closed: (code: ${event}, user: ${ws["__userId"]})`);
    if (ws["__userId"]) {
      delete users[ws["__userId"]];
    }
    updateUsers();
  });

  ws.on("error", (event) => {
    console.log(`websocket error: ${event}`);
  });
});

const server = app.listen(port, () => {
  console.log(`running on port ${port}`);
});
