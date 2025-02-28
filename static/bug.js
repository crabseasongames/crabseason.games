
function inventBug(config, color, canvas, muted = false) {


  function quadratic(a, b, c) {
    if (4 * a * c > b ** 2) { return false; }
    return [
      (-b + Math.sqrt(b ** 2 - 4 * a * c)) / (2 * a),
      (-b - Math.sqrt(b ** 2 - 4 * a * c)) / (2 * a)
    ];
  }

  function intersect(A, B) {

    // intersection of { p : |p| = 1 } with { p : |p - (A, B)| = 1 }
    // general circle intersection of unit circle with radius R circle at (A, B):
    //   x^2(4A^2 + 4B^2) + x(-8AB^2 - 4A(1 - R^2 - B^2 + A^2)) + (1 - R^2 - B^2 + A^2)^2 - 4B^2(1 - A^2) = 0
    // taking R = 1
    //   x^2(4A^2 + 4B^2) + x(-8AB^2 - 4A(A^2 - B^2)) + (A^2 - B^2)^2 - 4B^2(1 - A^2) = 0

    let a = 4 * (A ** 2 + B ** 2),
      b = -8 * A * B ** 2 - 4 * A * (A ** 2 - B ** 2),
      c = (A ** 2 - B ** 2) ** 2 - 4 * (B ** 2) * (1 - A ** 2);

    return quadratic(a, b, c);
  }

  function eq(x, y) {
    return Math.abs(x - y) < 0.0001;
  }

  function knee(S, F, K) {
    const R = (config.leg_max_length / 2),
      A = (F.x - S.x) / R,
      B = (F.y - S.y) / R,
      intersection = intersect(A, B),
      y1 = Math.sqrt(1 - intersection[0] ** 2),
      y2 = Math.sqrt(1 - intersection[1] ** 2),
      w1 = B + Math.sqrt(1 - (intersection[0] - A) ** 2),
      w2 = B + Math.sqrt(1 - (intersection[1] - A) ** 2),
      z1 = B - Math.sqrt(1 - (intersection[0] - A) ** 2),
      z2 = B - Math.sqrt(1 - (intersection[1] - A) ** 2),
      n1 = { x: intersection[0] },
      n2 = { x: intersection[1] };

      let p;

      if (eq(y1, w1) || eq(y1, z1)) {
        n1.y = y1
      } else if (eq(-y1, w1) || eq(-y1, z1)) {
        n1.y = -y1;
      } else {
        console.log("can't find intersection");
        console.log(A, B, intersection);
        return false;
      }

      if (eq(y2, w2) || eq(y2, z2)) {
        n2.y = y2;
      } else if (eq(-y2, w2) || eq(-y2, z2)) {
        n2.y = -y2;
      } else {
        console.log("can't find intersection");
        console.log(A, B, intersection);
        return false;
      }

      const k = {
        x: (K.x - S.x) / R,
        y: (K.y - S.y) / R
      };

      if ((n1.x - k.x) ** 2 + (n1.y - k.y) ** 2 <= (n2.x - k.x) ** 2 + (n2.y - k.y) ** 2) {
        p = n1;
      } else {
        p = n2;
      }

      return {
        x: p.x * R + S.x,
        y: p.y * R + S.y
      };
  }

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
  let lastTap = now();

  const actx = new AudioContext();
  let bug;
  const ctx = canvas.getContext("2d");

  function tap() {
    if (muted) { return; }
    let t = now();
    let dt = t - lastTap;
    lastTap = t;

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
      nextBug.head.position = {
        x: x,
        y: y,
        lf: { x: x - 50, y: y},
        rf: { x: x + 50, y: y },
        lk: { x: x, y: y },
        rk: { x: x, y: y }
      };
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
    if (!bug.root) {
      bug.head.position.lf = p.lf;
      bug.head.position.rf = p.rf;
      bug.head.position.lk = p.lk;
      bug.head.position.rk = p.rk;
    }

    if (!bug.tail) {
      return bug;
    }

    let d = direction(bug.head.position, bug.tail.head.position);
    let ldx = bug.tail.head.position.lf.x - bug.tail.head.position.x;
    let ldy = bug.tail.head.position.lf.y - bug.tail.head.position.y;
    let rdx = bug.tail.head.position.rf.x - bug.tail.head.position.x;
    let rdy = bug.tail.head.position.rf.y - bug.tail.head.position.y;

    if (ldx ** 2 + ldy ** 2 > config.leg_max_length ** 2) {
      bug.tail.head.position.lf.x = bug.tail.head.position.x + rotate(d, Math.PI / 4).x * config.leg_min_length;
      bug.tail.head.position.lf.y = bug.tail.head.position.y + rotate(d, Math.PI / 4).y * config.leg_min_length;
      tap();
    }

    if (rdx ** 2 + rdy ** 2 > config.leg_max_length ** 2) {
      bug.tail.head.position.rf.x = bug.tail.head.position.x + rotate(d, -Math.PI / 4).x * config.leg_min_length;
      bug.tail.head.position.rf.y = bug.tail.head.position.y + rotate(d, -Math.PI / 4).y * config.leg_min_length;
      tap();
    }

    let nextPosition = {
      x: bug.head.position.x + d.x * bug.head.radius,
      y: bug.head.position.y + d.y * bug.head.radius,
      lf: bug.tail.head.position.lf,
      rf: bug.tail.head.position.rf
    };

    const LK = knee(
      bug.tail.head.position,
      bug.tail.head.position.lf,
      bug.tail.head.position.lk
    ) || {
      x: bugtail.head.position.x,
      y: bugtail.head.position.y
    };

    const RK = knee(
      bug.tail.head.position,
      bug.tail.head.position.rf,
      bug.tail.head.position.rk
    ) || {
      x: bugtail.head.position.x,
      y: bugtail.head.position.y
    };

    nextPosition.lk = LK;
    nextPosition.rk = RK;

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

  let lastDraw;
  function drawBug() {
    ctx.reset();
    let t = now();
    let dt = Math.min((t - lastDraw) / 16.67, 2);
    lastDraw = t;
    let d = [newPosition.x - bug.head.position.x, newPosition.y - bug.head.position.y];
    let r = Math.sqrt(d[0] ** 2 + d[1] ** 2);
    let c = (1 - Math.E ** (-r * 0.01)) * config.speed * dt / r;

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
          next.head.position.lk.x,
          next.head.position.lk.y,
          config.leg_width,
          segmentColor
        );
        drawLine(
          ctx,
          next.head.position.lk.x,
          next.head.position.lk.y,
          next.head.position.lf.x,
          next.head.position.lf.y,
          config.leg_width,
          segmentColor
        );
        drawLine(
          ctx,
          next.head.position.x - config.segment_radius,
          next.head.position.y - config.segment_radius,
          next.head.position.rk.x,
          next.head.position.rk.y,
          config.leg_width,
          segmentColor
        );
        drawLine(
          ctx,
          next.head.position.rk.x,
          next.head.position.rk.y,
          next.head.position.rf.x,
          next.head.position.rf.y,
          config.leg_width,
          segmentColor
        );

        drawCircle(ctx, next.head.position.lf.x, next.head.position.lf.y, config.foot_size, segmentColor);
        drawCircle(ctx, next.head.position.rf.x, next.head.position.rf.y, config.foot_size, segmentColor);

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
        lastDraw = now();
        requestAnimationFrame(drawBug);
      }
    }
  };
}