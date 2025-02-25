
function inventBug(config, color, canvas, muted = false) {


  // TODO: procedurally animated controllable avatars synchronized across peers

  // TODO:
  // leg movement is broken, logic is non-isotropic i think (atan?)
  // backwards should also be reverse of forwards maybe
  // i think knees are achievable
  // time to port orb simulator?


  function direction(fromP, toP) {
    let dx = toP.x - fromP.x;
    let dy = toP.y - fromP.y;
    let r = Math.sqrt(dx * dx + dy * dy);
    return {
      x: dx / r,
      y: dy / r
    };
  }

  function rotate(v, t) {
    let theta = Math.atan(v.y / v.x);
    if (v.x > 0) {
      theta += Math.PI;
    }
    return {
      x: Math.cos(theta + t),
      y: Math.sin(theta + t),
    };
  }

  function now() { return +(new Date); }

  function modulateColor(i) {
    let value = 1.2 - 0.5 * Math.cos(i * 0.8) ** 2;
    return `rgba(${color[0] * value}, ${color[1] * value}, ${color[2] * value}, 50)`;
  }

  let newPosition;
  let t = now();

  const actx = new AudioContext();
  let bug;
  const ctx = canvas.getContext("2d");

  function tap() {
    if (muted) { return; }
    let t_ = now();
    let dt = t_ - t;
    t = t_;

    let audio_buffer = actx.createBuffer(1, config.duration, 96000);
    let buffer = audio_buffer.getChannelData(0);
    let r = 1 + Math.random() * 0.1;
    let v = 1 - Math.E ** (-dt * 0.03);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.sin(i * 0.03 * r) * config.volume * v * Math.pow(2, -((i * 0.003) ** 2));
    }
    let source = actx.createBufferSource();
    source.buffer = audio_buffer;
    source.connect(actx.destination);
    source.start();
  }

  function initializeBug(N, R, p) {
    const bug = {
      root: true,
      head: {}
    };

    let nextBug = bug;

    for (let i = 0; i < N; i++) {
      let x = p.x;
      let y = p.y + config.arc_radius * i;
      nextBug.head.position = { x: x, y: y, llx: x - 50, lly: y, rlx: x + 50, rly: y };
      nextBug.head.radius = R;
      if (i < N - 1) {
        nextBug.tail = { head: {} };
        nextBug = nextBug.tail;
      }
    }

    return bug;
  }

  function moveBug(bug, p) {
    bug.head.position.x = p.x;
    bug.head.position.y = p.y;
    if (p.llx) {
      bug.head.position.llx = p.llx;
      bug.head.position.lly = p.lly;
      bug.head.position.rlx = p.rlx;
      bug.head.position.rly = p.rly;
    }

    if (!bug.tail) {
      return bug;
    }

    let d = direction(bug.head.position, bug.tail.head.position);
    let ldx = bug.tail.head.position.llx - bug.tail.head.position.x;
    let ldy = bug.tail.head.position.lly - bug.tail.head.position.y;
    let rdx = bug.tail.head.position.rlx - bug.tail.head.position.x;
    let rdy = bug.tail.head.position.rly - bug.tail.head.position.y;

    if (ldx ** 2 + ldy ** 2 > config.leg_max_length ** 2) {
      bug.tail.head.position.llx = bug.tail.head.position.x + rotate(d, Math.PI / 4).x * config.leg_min_length;
      bug.tail.head.position.lly = bug.tail.head.position.y + rotate(d, Math.PI / 4).y * config.leg_min_length;
      tap();
    }

    if (rdx ** 2 + rdy ** 2 > config.leg_max_length ** 2) {
      bug.tail.head.position.rlx = bug.tail.head.position.x + rotate(d, -Math.PI / 4).x * config.leg_min_length;
      bug.tail.head.position.rly = bug.tail.head.position.y + rotate(d, -Math.PI / 4).y * config.leg_min_length;
      tap();
    }

    let nextPosition = {
      x: bug.head.position.x + d.x * bug.head.radius,
      y: bug.head.position.y + d.y * bug.head.radius,
      llx: bug.tail.head.position.llx,
      lly: bug.tail.head.position.lly,
      rlx: bug.tail.head.position.rlx,
      rly: bug.tail.head.position.rly
    };

    return {
      head: bug.head,
      tail: moveBug(bug.tail, nextPosition)
    }
  }

  function drawCircle(ctx, x, y, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
  }

  function drawLine(ctx, x, y, u, v, r, color) {
    ctx.lineWidth = r;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(u, v);
    ctx.stroke();
  }

  function drawBug() {
    ctx.reset();
    let d = [newPosition.x - bug.head.position.x, newPosition.y - bug.head.position.y];
    let r = Math.sqrt(d[0] ** 2 + d[1] ** 2);
    let c = (1 - Math.E ** (-r * 0.01)) * config.speed / r;

    if (Math.abs(d[0]) > 4 || Math.abs(d[1]) > 4) {
      moveBug(bug, { x: bug.head.position.x + d[0] * c, y: bug.head.position.y + d[1] * c });
    }

    let value;
    let i = 0;
    let next = bug;
    let lastCenter;
    while (next) {
      let segmentColor = modulateColor(i++);
      let center = [next.head.position.x - config.segment_radius, next.head.position.y - config.segment_radius];

      drawCircle(ctx, center[0], center[1], config.segment_radius, segmentColor);

      if (i > 1) {
        drawLine(
          ctx,
          next.head.position.x - config.segment_radius,
          next.head.position.y - config.segment_radius,
          next.head.position.llx,
          next.head.position.lly,
          config.leg_width,
          segmentColor
        );
        drawLine(
          ctx,
          next.head.position.x - config.segment_radius,
          next.head.position.y - config.segment_radius,
          next.head.position.rlx,
          next.head.position.rly,
          config.leg_width,
          segmentColor
        );

        drawCircle(ctx, next.head.position.llx, next.head.position.lly, config.foot_size, segmentColor);
        drawCircle(ctx, next.head.position.rlx, next.head.position.rly, config.foot_size, segmentColor);

        const d = [lastCenter[0] - center[0], lastCenter[1] - center[1]];
        const p = [center[0] + d[0], center[1] + d[1]];
        const gradient = ctx.createLinearGradient(center[0], center[1], p[0], p[1]);
        gradient.addColorStop(config.segment_radius / config.arc_radius, ctx.fillStyle);
        gradient.addColorStop(1 - (config.segment_radius / config.arc_radius), modulateColor(i - 2));

        drawLine(
          ctx,
          center[0],
          center[1],
          p[0],
          p[1],
          config.segment_radius * 1.2,
          gradient
        );
      }

      next = next.tail;
      lastCenter = center;
    }
    requestAnimationFrame(drawBug);
  };

  return {
    update: (p) => {
      newPosition = p;
      if (!bug) {
        bug = initializeBug(config.num_segments, config.arc_radius, newPosition);
        moveBug(bug, newPosition);
        requestAnimationFrame(drawBug);
      }
    }
  };
}