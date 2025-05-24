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

    if (!games[c]) {
      return conn.send(WsError("CodeError", "invalid game code"));
    }

    if (conn["__userId"] == games[c].host) {
      conn.send(WsResponse("joinedGame", games[c]));
      if (users[games[c].opponent]) {
        conn.send(WsResponse("opponentJoinedGame"));
        users[games[c].opponent].connection.send(WsResponse("opponentJoinedGame"));
      }
    } else {
      if (games[c].opponent && games[c].opponent != conn["__userId"]) {
        return conn.send(WsError("CodeError", "invalid game code"));
      }

      games[c].opponent = conn["__userId"];
      conn.send(WsResponse("joinedGame", games[c]));
      if (users[games[c].host]) {
        conn.send(WsResponse("opponentJoinedGame"));
        users[games[c].host].connection.send(WsResponse("opponentJoinedGame"));
      }
    }

    users[conn["__userId"]].activeGame = c;
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
    if (game.state.winner) {
      delete games[user.activeGame];
    }
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

  const intervalId = setInterval(() => {
    ws.send(WsResponse("ping"));
  }, 10000);

  ws.on("close", (event) => {
    console.log(`websocket connection closed: (code: ${event}, user: ${ws["__userId"]})`);
    let id = ws["__userId"];
    if (users[id]) {
      let game = games[users[id].activeGame];
      if (game) {
        let peer = game.host == id ? users[game.opponent] : users[game.host];
        if (peer) {
          peer.connection.send(WsResponse("disconnect"));
        }
      }
      delete users[id];
    }
    updateUsers();
    clearInterval(intervalId);
  });

  ws.on("error", (event) => {
    console.log(`websocket error: ${event}`);
  });
});

const server = app.listen(port, () => {
  console.log(`running on port ${port}`);
});

function clean() {
  Object.keys(games).forEach((code) => {
    if (!users[games[code].host] && !users[games[code].opponent] && now() - games[code].started > 1e6) {
      delete games[code];
    }
  });

  report();
}

function report() {
  if (Object.keys(users).length) {
    console.log("======== ACTIVE USERS ========");
    Object.keys(users).forEach((id) => {
      console.log(`user ${id} last seen at t=${Math.floor((users[id].last - START) / 1000)} seconds`);
    });
    console.log("==============================");
  }
  if (Object.keys(games).length) {
    console.log("======== ACTIVE GAMES ========");
    Object.keys(games).forEach((id) => {
      console.log(id, games[id]);
    });
    console.log("==============================");
  }
}

setInterval(clean, 20000);