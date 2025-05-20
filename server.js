const path = require("path"),
  express = require("express"),
  app = express(),
  expressWs = require("express-ws")(app),
  chess = require("./chess");

const now = () => { return +(new Date); };

const START = now();

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
const games = {};

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
      connection: conn,
      last: now()
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
  },
  newGame: (conn) => {
    let user = users[conn["__userId"]];
    if (!user) {
      return conn.send(WsError("UserError", "invalid user id"));
    }

    const code = getCode();
    user.activeGame = code;
    games[code] = chess.create(conn["__userId"], code);
    conn.send(WsResponse("gameStarted", games[code]));
  },
  joinGame: (conn, code) => {
    let user = users[conn["__userId"]];
    if (!user) {
      return conn.send(WsError("UserError", "invalid user id"));
    }

    const c = code.toUpperCase();

    if (!games[c] || games[c].opponent) {
      return conn.send(WsError("CodeError", "invalid game code"));
    }

    games[c].opponent = conn["__userId"];
    users[conn["__userId"]].activeGame = c;
    conn.send(WsResponse("joinedGame", games[c]));
  },
  move: (conn, move) => {
    let user = users[conn["__userId"]];
    if (!user) {
      return conn.send(WsError("UserError", "invalid user id"));
    }

    let game = games[user.activeGame];
    if (!game) {
      return conn.send(WsError("CodeError", "invalid game code"));
    }

    if (!game.opponent) {
      return conn.send(WsError("GameError", "game not started"));
    }

    let valid = game.move(conn["__userId"] == game.opponent, move);
    if (!valid) {
      return conn.send(WsError("GameError", "invalid move"));
    }

    users[game.host].connection.send(WsResponse("moved", games[user.activeGame]));
    users[game.opponent].connection.send(WsResponse("moved", games[user.activeGame]));
  }
};

function getLetter() {
  return String.fromCharCode(65 + Math.floor(Math.random() * 25));
}

function getCode() {
  let code = getLetter() + getLetter() + getLetter() + getLetter();
  if (games[code]) {
    return getCode();
  }
  return code;
}

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
    if (ws["__userId"] && users[ws["__userId"]]) {
      users[ws["__userId"]].last = now();
    }
  });

  ws.on("close", (event) => {
    console.log(`websocket connection closed: (code: ${event}, user: ${ws["__userId"]})`);
    if (ws["__userId"]) {
      delete users[ws["__userId"]];
      Object.keys(games).forEach((code) => {
        if (games[code].host == ws["__userId"]) {
          delete games[code];
        }
      });
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

function report() {
  // console.log("======== ACTIVE USERS ========");
  // Object.keys(users).forEach((id) => {
  //   console.log(`user ${id} last seen at t=${Math.floor((users[id].last - START) / 1000)} seconds`);
  // });
  // console.log("==============================");
  console.log(users);
  console.log(games);
}

setInterval(report, 10000);