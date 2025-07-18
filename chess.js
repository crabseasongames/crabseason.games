
const MAX_HP = 2;

function allowed(state, player, move) {
  if (player == state.oofTurn) { return false; }
  let piece = getPiece(state.board, move[0]);
  if (piece <= 0 || isOofPiece(piece) == player) {
    return false;
  }
  const allowedMoves = getAllowedMoves(state.board, move[0]);
  if (move[1][1] == -1 && state.oofTurn || move[1][1] == 8 && !state.oofTurn) {
    return allowedMoves[1][move[1][0]];
  } else {
    return allowedMoves[0][move[1][0]][move[1][1]];
  }
}

function getAllowedMoves(board, position) {
  if (getPiece(board, position) == 2 || getPiece(board, position) == 4) {
    return getAllowedGuyMoves(board, position);
  } else {
    return getAllowedRockMoves(board, position);
  }
}

function getAllowedRockMoves(board, position) {
  let allowedMoves = empty();
  let allowedThrows = [];
  let i = position[0];
  while (++i < 8 && !getPiece(board, [i, position[1]])) {
    allowedMoves[i][position[1]] = true;
  }
  if (i < 8) {
    allowedMoves[i][position[1]] = isOpposing(getPiece(board, position), getPiece(board, [i, position[1]]));
  }

  i = position[0];
  while (--i >= 0 && !getPiece(board, [i, position[1]])) {
    allowedMoves[i][position[1]] = true;
  }
  if (i >= 0) {
    allowedMoves[i][position[1]] = isOpposing(getPiece(board, position), getPiece(board, [i, position[1]]));
  }

  i = position[1];
  while (++i < 8 && !getPiece(board, [position[0], i])) {
    allowedMoves[position[0]][i] = true;
  }
  if (i < 8) {
    allowedMoves[position[0]][i] = isOpposing(getPiece(board, position), getPiece(board, [position[0], i]));
  } else if (!isOofPiece(getPiece(board, position))) {
    allowedThrows[position[0]] = true;
  }

  i = position[1];
  while (--i >= 0 && !getPiece(board, [position[0], i])) {
    allowedMoves[position[0]][i] = true;
  }

  if (i >= 0) {
    allowedMoves[position[0]][i] = isOpposing(getPiece(board, position), getPiece(board, [position[0], i]));
  } else if (isOofPiece(getPiece(board, position))) {
    allowedThrows[position[0]] = true;
  }
  return [allowedMoves, allowedThrows];
}

function getAllowedGuyMoves(board, position) {
  let allowedMoves = empty();
  let i = position[0] + 1;

  if (i < 8) {
    allowedMoves[i][position[1]] =
      !getPiece(board, [i, position[1]]) ||
      isOpposing(getPiece(board, position), getPiece(board, [i, position[1]]));
  }

  i = position[0] - 1;

  if (i >= 0) {
    allowedMoves[i][position[1]] =
      !getPiece(board, [i, position[1]]) ||
      isOpposing(getPiece(board, position), getPiece(board, [i, position[1]]));
  }

  i = position[1] + 1;

  if (i < 8) {
    allowedMoves[position[0]][i] =
      !getPiece(board, [position[0], i]) ||
      isOpposing(getPiece(board, position), getPiece(board, [position[0], i]));
  }

  i = position[1] - 1;

  if (i >= 0) {
    allowedMoves[position[0]][i] =
      !getPiece(board, [position[0], i]) ||
      isOpposing(getPiece(board, position), getPiece(board, [position[0], i]));
  }

  return [allowedMoves, []];
}

function isOpposing(pa, pb) {
  return (
    isOofPiece(pa) && !isOofPiece(pb)
  ) || (
    isOofPiece(pb) && !isOofPiece(pa)
  );
}

function isOofPiece(piece) {
  return piece == 1 || piece == 2;
}

function getPiece(board, position) {
  if (position[1] == -1 || position[1] == 8) {
    return -1
  } else {
    return board[position[1]][position[0]];
  }
}

function setPiece(board, position, piece) {
  board[position[1]][position[0]] = piece;
}

/// empty = 0, ORock = 1, Oguy = 2, TRock = 3, TGuy = 4
function newBoard() {
  return [
    [3, 3, 3, 4, 3, 3, 3, 3],
    [3, 3, 3, 3, 3, 3, 3, 3],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 2, 1, 1, 1, 1]
  ];
}

function empty() { return [ [], [], [], [], [], [], [], [] ]; }

module.exports = {
  create: (hostId, code) => {
    const game = {
      created: +(new Date()),
      host: hostId,
      code: code,
      state: {
        board: newBoard(),
        oofTurn: true,
        oofHp: MAX_HP,
        tuggHp: MAX_HP,
        maxHp: MAX_HP,
        winner: false
      },
      move: (player, move) => {
        if (game.state.winner || !allowed(game.state, player, move)) { return false; }
        let targetPiece = getPiece(game.state.board, move[1]);
        if (targetPiece == 4) {
          game.state.winner = 1;
        } else if (targetPiece == 2) {
          game.state.winner = 2;
        }
        if (move[1][1] == -1 || move[1][1] == 8) {
          if (game.state.oofTurn) {
            game.state.tuggHp -= 1;
            if (game.state.tuggHp <= 0) {
              game.state.winner = 1;
            }
          } else {
            game.state.oofHp -= 1;
            if (game.state.oofHp <= 0) {
              game.state.winner = 2;
            }
          }
        } else {
          setPiece(game.state.board, move[1], getPiece(game.state.board, move[0])); 
        }
        setPiece(game.state.board, move[0], 0);
        game.state.oofTurn = !game.state.oofTurn;
        return true;
      }
    };

    return game;
  }
};
